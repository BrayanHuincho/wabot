import uuid
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Query, status

from app.api.deps import CtxDep, SessionDep
from app.enums import Author, ConversationStatus
from app.schemas import ConversationOut, ConversationPatch, MessageOut, OutboundContent
from app.services import conversations, messaging

router = APIRouter(prefix="/conversations", tags=["conversations"])


@router.get("", response_model=list[ConversationOut])
async def list_conversations(
    session: SessionDep,
    status_: Annotated[ConversationStatus | None, Query(alias="status")] = None,
    search: str = "",
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
) -> list[ConversationOut]:
    rows = await conversations.list_conversations(session, status_, search, limit)
    return [conversations.conversation_out(row) for row in rows]


@router.get("/{conversation_id}", response_model=ConversationOut)
async def get_conversation(conversation_id: uuid.UUID, session: SessionDep) -> ConversationOut:
    conversation = await conversations.get_conversation(session, conversation_id)
    return conversations.conversation_out(conversation)


@router.patch("/{conversation_id}", response_model=ConversationOut)
async def update_conversation(
    conversation_id: uuid.UUID, patch: ConversationPatch, ctx: CtxDep, session: SessionDep
) -> ConversationOut:
    conversation = await conversations.get_conversation(session, conversation_id)
    updated = await conversations.update_conversation(ctx, session, conversation, patch)
    return conversations.conversation_out(updated)


@router.post("/{conversation_id}/read", response_model=ConversationOut)
async def mark_read(
    conversation_id: uuid.UUID, ctx: CtxDep, session: SessionDep
) -> ConversationOut:
    conversation = await conversations.get_conversation(session, conversation_id)
    return conversations.conversation_out(await conversations.mark_read(ctx, session, conversation))


@router.get("/{conversation_id}/messages", response_model=list[MessageOut])
async def list_messages(
    conversation_id: uuid.UUID,
    session: SessionDep,
    before: datetime | None = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
) -> list[MessageOut]:
    await conversations.get_conversation(session, conversation_id)
    rows = await messaging.history(session, conversation_id, before, limit)
    return [messaging.message_out(row) for row in rows]


@router.post(
    "/{conversation_id}/messages", response_model=MessageOut, status_code=status.HTTP_201_CREATED
)
async def send_as_agent(
    conversation_id: uuid.UUID, content: OutboundContent, ctx: CtxDep, session: SessionDep
) -> MessageOut:
    conversation = await conversations.get_conversation(session, conversation_id)
    message = await messaging.send(ctx, session, conversation, content, Author.AGENT)
    return messaging.message_out(message)
