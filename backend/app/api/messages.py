from fastapi import APIRouter, status

from app.api.deps import CtxDep, SessionDep
from app.enums import Author
from app.schemas import MessageOut, OutboundContent, SendMessageRequest
from app.services import conversations, messaging

router = APIRouter(tags=["messages"])


@router.post("/messages", response_model=MessageOut, status_code=status.HTTP_201_CREATED)
async def send_from_api(
    request: SendMessageRequest, ctx: CtxDep, session: SessionDep
) -> MessageOut:
    contact = await conversations.upsert_contact(session, request.to, request.name)
    conversation, _ = await conversations.open_conversation(session, contact)
    content = OutboundContent.model_validate(request.model_dump(exclude={"to", "name"}))
    message = await messaging.send(ctx, session, conversation, content, Author.API)
    return messaging.message_out(message)
