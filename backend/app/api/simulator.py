from fastapi import APIRouter, status

from app.api.deps import CtxDep
from app.schemas import MessageOut, SimulatedInbound
from app.services import messaging
from app.services.bot import handle_inbound

router = APIRouter(prefix="/simulator", tags=["simulator"])


@router.post("/messages", response_model=MessageOut, status_code=status.HTTP_201_CREATED)
async def simulate_inbound(inbound: SimulatedInbound, ctx: CtxDep) -> MessageOut:
    return messaging.message_out(await handle_inbound(ctx, inbound))
