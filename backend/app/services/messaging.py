import logging
import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.context import Context
from app.enums import (
    MEDIA_TYPES,
    Author,
    ConversationMode,
    ConversationStatus,
    Direction,
    MessageStatus,
    MessageType,
)
from app.errors import ConversationClosed, InvalidMessage, NotFound, WindowClosed
from app.models import Conversation, Media, Message, as_utc, utcnow
from app.schemas import MessageContent, MessageOut, OutboundContent, SimulatedInbound
from app.services import conversations
from app.storage import accepts
from app.webhooks import enqueue

logger = logging.getLogger(__name__)

PREVIEW_LABELS = {
    MessageType.IMAGE: "Imagen",
    MessageType.VIDEO: "Video",
    MessageType.AUDIO: "Audio",
    MessageType.DOCUMENT: "Documento",
    MessageType.STICKER: "Sticker",
    MessageType.LOCATION: "Ubicación",
}
STATUS_RANK = {
    MessageStatus.PENDING: 0,
    MessageStatus.SENT: 1,
    MessageStatus.DELIVERED: 2,
    MessageStatus.READ: 3,
}


def message_out(message: Message) -> MessageOut:
    return MessageOut.model_validate(message)


def status_event(message: Message) -> dict[str, Any]:
    out = message_out(message)
    return out.model_dump(mode="json", include={"id", "status", "delivered_at", "read_at"}) | {
        "conversation_id": str(message.conversation_id)
    }


def created_event(message: Message, conversation: Conversation) -> dict[str, Any]:
    return {
        "message": message_out(message).model_dump(mode="json"),
        "conversation": conversations.dump(conversation),
    }


def preview_for(message: Message) -> str:
    label = PREVIEW_LABELS.get(message.type)
    text = f"{label}: {message.body}" if label and message.body else (message.body or label or "")
    return text.replace("\n", " ")[:160]


def touch(conversation: Conversation, message: Message) -> None:
    conversation.preview = preview_for(message)
    conversation.last_message_at = message.created_at


async def load_media(session: AsyncSession, content: MessageContent) -> Media | None:
    if content.type not in MEDIA_TYPES:
        return None
    media = await session.get(Media, content.media_id)
    if media is None:
        raise NotFound("El archivo indicado no existe.")
    if not accepts(content.type, media.mime_type):
        raise InvalidMessage(f"Un archivo {media.mime_type} no puede enviarse como {content.type}.")
    return media


def inbound_body(inbound: SimulatedInbound) -> str:
    if inbound.type is MessageType.REPLY:
        return inbound.reply_title or inbound.reply_id or ""
    return inbound.body


async def record_inbound(ctx: Context, inbound: SimulatedInbound) -> tuple[Message, bool]:
    async with ctx.sessions() as session:
        contact = await conversations.upsert_contact(session, inbound.phone, inbound.name)
        conversation, first_contact = await conversations.open_conversation(session, contact)
        if inbound.reply_to_id and not await session.get(Message, inbound.reply_to_id):
            raise NotFound("El mensaje citado no existe.")
        message = Message(
            id=uuid.uuid4(),
            conversation_id=conversation.id,
            direction=Direction.INBOUND,
            author=Author.CONTACT,
            type=inbound.type,
            body=inbound_body(inbound),
            content=inbound.extras(),
            media=await load_media(session, inbound),
            reply_to_id=inbound.reply_to_id,
            status=MessageStatus.RECEIVED,
            created_at=utcnow(),
        )
        session.add(message)
        conversation.unread_count += 1
        conversation.last_inbound_at = message.created_at
        touch(conversation, message)
        enqueue(session, ctx.settings, "message.received", created_event(message, conversation))
        await session.commit()
    await ctx.hub.publish("message.created", created_event(message, conversation))
    return message, first_contact


def ensure_sendable(conversation: Conversation, content: OutboundContent) -> None:
    if conversation.status is ConversationStatus.CLOSED:
        raise ConversationClosed("La conversación está cerrada.")
    if (
        content.type is not MessageType.TEMPLATE
        and not conversations.conversation_out(conversation).window_open
    ):
        raise WindowClosed(
            "Pasaron más de 24 h desde el último mensaje del cliente: solo se permiten plantillas."
        )


async def send(
    ctx: Context,
    session: AsyncSession,
    conversation: Conversation,
    content: OutboundContent,
    author: Author,
) -> Message:
    ensure_sendable(conversation, content)
    body, extras = content.body, content.extras()
    if content.type is MessageType.TEMPLATE:
        template = ctx.templates.get(content.template or "")
        body = template.render(content.params)
        if template.buttons:
            extras["buttons"] = [{"id": title, "title": title} for title in template.buttons]

    took_over = author is Author.AGENT and conversations.switch_mode(
        ctx, session, conversation, ConversationMode.MANUAL
    )
    message = Message(
        id=uuid.uuid4(),
        conversation_id=conversation.id,
        direction=Direction.OUTBOUND,
        author=author,
        type=content.type,
        body=body,
        content=extras,
        media=await load_media(session, content),
        status=MessageStatus.PENDING,
        created_at=utcnow(),
    )
    session.add(message)
    touch(conversation, message)
    await session.commit()
    await ctx.hub.publish("message.created", created_event(message, conversation))
    if took_over:
        await conversations.publish_conversation(ctx, conversation)

    await dispatch(ctx, session, conversation, message)
    return message


async def dispatch(
    ctx: Context, session: AsyncSession, conversation: Conversation, message: Message
) -> None:
    try:
        message.external_id = await ctx.channel.deliver(message, conversation.contact.phone)
    except Exception as exc:
        logger.exception("Channel %s failed to deliver %s", ctx.channel.name, message.id)
        message.status = MessageStatus.FAILED
        message.error = str(exc)[:500]
    else:
        message.status = MessageStatus.SENT
        message.sent_at = utcnow()
        enqueue(session, ctx.settings, "message.sent", created_event(message, conversation))
    await session.commit()
    await ctx.hub.publish("message.status", status_event(message))


async def apply_status(ctx: Context, external_id: str, status: MessageStatus) -> None:
    async with ctx.sessions() as session:
        message = await session.scalar(select(Message).where(Message.external_id == external_id))
        if message is None:
            logger.info("Status %s for unknown message %s ignored", status, external_id)
            return
        if not advance(message, status):
            return
        enqueue(session, ctx.settings, "message.status", status_event(message))
        await session.commit()
        await ctx.hub.publish("message.status", status_event(message))


def advance(message: Message, status: MessageStatus) -> bool:
    current = STATUS_RANK.get(message.status)
    target = STATUS_RANK.get(status)
    if current is None or target is None or target <= current:
        return False
    now = utcnow()
    message.status = status
    if target >= STATUS_RANK[MessageStatus.DELIVERED]:
        message.delivered_at = as_utc(message.delivered_at) or now
    if status is MessageStatus.READ:
        message.read_at = now
    return True


async def history(
    session: AsyncSession, conversation_id: uuid.UUID, before: datetime | None, limit: int
) -> list[Message]:
    query = select(Message).where(Message.conversation_id == conversation_id)
    if before is not None:
        query = query.where(Message.created_at < before)
    rows = await session.scalars(query.order_by(Message.created_at.desc()).limit(limit))
    return list(reversed(list(rows)))
