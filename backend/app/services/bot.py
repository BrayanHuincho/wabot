import asyncio
import logging
import re
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.prompt import build_messages, extract_handoff
from app.bot.engine import Action, decide
from app.bot.flow import FlowMessage
from app.context import Context
from app.enums import Author, ConversationMode, ConversationStatus, MessageType
from app.formatting import split_message, to_whatsapp
from app.models import Conversation, Message
from app.schemas import OutboundContent, SimulatedInbound
from app.services import conversations, messaging

logger = logging.getLogger(__name__)

NOT_UNDERSTOOD = "Disculpa, no entendí tu mensaje. Elige una de estas opciones:"
AI_CHUNK_LIMIT = 1500
PLACEHOLDER = re.compile(r"\{([a-z][a-z0-9_]*)\}")


async def handle_inbound(ctx: Context, inbound: SimulatedInbound) -> Message:
    message, first_contact = await messaging.record_inbound(ctx, inbound)
    ctx.tasks.spawn(
        run_bot(ctx, message.conversation_id, message.id, first_contact=first_contact),
        name=f"bot-{message.id}",
    )
    return message


async def run_bot(
    ctx: Context, conversation_id: uuid.UUID, message_id: uuid.UUID, *, first_contact: bool
) -> None:
    async with ctx.sessions() as session:
        conversation = await conversations.get_conversation(session, conversation_id)
        inbound = await session.get(Message, message_id)
        if inbound is None:
            return
        decision = decide(
            ctx.flow,
            conversation,
            inbound,
            first_contact=first_contact,
            ai_enabled=ctx.ai.enabled,
        )
        if decision.action is Action.NONE:
            return

        await ctx.hub.publish("typing", {"conversation_id": conversation.id, "author": "bot"})
        await asyncio.sleep(ctx.settings.typing_delay_ms / 1000)
        await session.refresh(conversation)
        if not bot_may_speak(conversation):
            return

        if decision.action is Action.AI:
            await answer_with_ai(ctx, session, conversation)
        elif decision.action is Action.NOT_UNDERSTOOD:
            await say(ctx, session, conversation, NOT_UNDERSTOOD)
            await play_node(ctx, session, conversation, ctx.flow.start)
        elif decision.node is not None:
            await play_node(ctx, session, conversation, decision.node, inbound)


def bot_may_speak(conversation: Conversation) -> bool:
    return (
        conversation.mode is ConversationMode.AUTO
        and conversation.status is ConversationStatus.OPEN
    )


async def say(ctx: Context, session: AsyncSession, conversation: Conversation, text: str) -> None:
    content = OutboundContent(type=MessageType.TEXT, body=text)
    await messaging.send(ctx, session, conversation, content, Author.BOT)


async def play_node(
    ctx: Context,
    session: AsyncSession,
    conversation: Conversation,
    node_id: str,
    inbound: Message | None = None,
) -> None:
    chain = ctx.flow.chain(node_id)
    conversation.flow_node = chain[-1]
    capture(conversation, ctx.flow.nodes[node_id].capture, inbound)
    answers = {key: str(value) for key, value in conversation.contact.attributes.items()}
    for current in chain:
        node = ctx.flow.nodes[current]
        for template in node.messages:
            content = await materialize(ctx, session, template, answers)
            await messaging.send(ctx, session, conversation, content, Author.BOT)
        if node.handoff:
            await conversations.hand_off(ctx, session, conversation)


def capture(conversation: Conversation, key: str | None, inbound: Message | None) -> None:
    if not key or inbound is None:
        return
    value = (inbound.content or {}).get("reply_title") or inbound.body
    if value:
        contact = conversation.contact
        contact.attributes = {**contact.attributes, key: value}


def fill(text: str, answers: dict[str, str]) -> str:
    return PLACEHOLDER.sub(lambda m: answers.get(m.group(1), m.group(0)), text)


async def materialize(
    ctx: Context, session: AsyncSession, message: FlowMessage, answers: dict[str, str]
) -> OutboundContent:
    data = message.model_dump(exclude={"asset"})
    data["body"] = fill(data["body"], answers)
    if message.asset:
        media = await ctx.store.import_asset(session, ctx.assets_dir / message.asset)
        data["media_id"] = media.id
    return OutboundContent.model_validate(data)


async def answer_with_ai(ctx: Context, session: AsyncSession, conversation: Conversation) -> None:
    recent = await session.scalars(
        select(Message)
        .where(Message.conversation_id == conversation.id)
        .order_by(Message.created_at.desc())
        .limit(ctx.settings.ai_history_size)
    )
    prompt = build_messages(ctx.system_prompt, list(reversed(list(recent))))
    reply = await ctx.ai.complete(prompt)
    if reply is None:
        await say(ctx, session, conversation, NOT_UNDERSTOOD)
        await play_node(ctx, session, conversation, ctx.flow.start)
        return

    text, wants_human = extract_handoff(reply)
    for chunk in split_message(to_whatsapp(text), AI_CHUNK_LIMIT):
        await say(ctx, session, conversation, chunk)
    if wants_human:
        await conversations.hand_off(ctx, session, conversation)
