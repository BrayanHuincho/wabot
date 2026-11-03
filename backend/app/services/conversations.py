import uuid
from typing import Any

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.context import Context
from app.enums import ConversationMode, ConversationStatus
from app.errors import NotFound
from app.models import Contact, Conversation, utcnow
from app.schemas import ConversationOut, ConversationPatch
from app.webhooks import enqueue


def conversation_out(conversation: Conversation) -> ConversationOut:
    return ConversationOut.model_validate(conversation)


async def publish_conversation(ctx: Context, conversation: Conversation) -> None:
    await ctx.hub.publish("conversation.updated", conversation_out(conversation))


async def get_conversation(session: AsyncSession, conversation_id: uuid.UUID) -> Conversation:
    conversation = await session.get(Conversation, conversation_id)
    if conversation is None:
        raise NotFound("La conversación no existe.")
    return conversation


async def list_conversations(
    session: AsyncSession, status: ConversationStatus | None, search: str, limit: int
) -> list[Conversation]:
    query = select(Conversation).join(Conversation.contact)
    if status is not None:
        query = query.where(Conversation.status == status)
    if term := search.strip():
        pattern = f"%{term}%"
        query = query.where(or_(Contact.name.ilike(pattern), Contact.phone.ilike(pattern)))
    query = query.order_by(Conversation.last_message_at.desc()).limit(limit)
    return list(await session.scalars(query))


async def upsert_contact(session: AsyncSession, phone: str, name: str | None) -> Contact:
    contact = await session.scalar(select(Contact).where(Contact.phone == phone))
    if contact is None:
        contact = Contact(phone=phone, name=name or "")
        session.add(contact)
        await session.flush()
    elif name and contact.name != name:
        contact.name = name
    return contact


async def open_conversation(session: AsyncSession, contact: Contact) -> tuple[Conversation, bool]:
    latest = await session.scalar(
        select(Conversation)
        .where(Conversation.contact_id == contact.id)
        .order_by(Conversation.status == ConversationStatus.CLOSED, Conversation.created_at.desc())
        .limit(1)
    )
    if latest is not None and latest.status is ConversationStatus.OPEN:
        return latest, False
    if latest is not None:
        reopen(latest)
        return latest, True
    conversation = Conversation(contact=contact)
    session.add(conversation)
    await session.flush()
    return conversation, True


def reopen(conversation: Conversation) -> None:
    conversation.status = ConversationStatus.OPEN
    conversation.closed_at = None
    conversation.mode = ConversationMode.AUTO
    conversation.flow_node = None


def switch_mode(
    ctx: Context, session: AsyncSession, conversation: Conversation, mode: ConversationMode
) -> bool:
    if conversation.mode is mode:
        return False
    conversation.mode = mode
    if mode is ConversationMode.MANUAL:
        enqueue(session, ctx.settings, "conversation.handoff", dump(conversation))
    return True


def close(ctx: Context, session: AsyncSession, conversation: Conversation) -> None:
    conversation.status = ConversationStatus.CLOSED
    conversation.closed_at = utcnow()
    conversation.unread_count = 0
    enqueue(session, ctx.settings, "conversation.closed", dump(conversation))


def dump(conversation: Conversation) -> dict[str, Any]:
    return conversation_out(conversation).model_dump(mode="json")


async def update_conversation(
    ctx: Context, session: AsyncSession, conversation: Conversation, patch: ConversationPatch
) -> Conversation:
    if patch.status is ConversationStatus.CLOSED and conversation.status is ConversationStatus.OPEN:
        close(ctx, session, conversation)
    elif (
        patch.status is ConversationStatus.OPEN and conversation.status is ConversationStatus.CLOSED
    ):
        reopen(conversation)
    if patch.mode is not None:
        switch_mode(ctx, session, conversation, patch.mode)
    await session.commit()
    await publish_conversation(ctx, conversation)
    return conversation


async def hand_off(ctx: Context, session: AsyncSession, conversation: Conversation) -> None:
    if switch_mode(ctx, session, conversation, ConversationMode.MANUAL):
        await session.commit()
        await publish_conversation(ctx, conversation)


async def mark_read(
    ctx: Context, session: AsyncSession, conversation: Conversation
) -> Conversation:
    if conversation.unread_count:
        conversation.unread_count = 0
        await session.commit()
        await publish_conversation(ctx, conversation)
    return conversation
