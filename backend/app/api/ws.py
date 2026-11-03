from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status

from app.api.deps import key_is_valid
from app.context import Context

router = APIRouter()


@router.websocket("/ws")
async def events(websocket: WebSocket, key: str | None = None) -> None:
    ctx: Context = websocket.app.state.ctx
    if not key_is_valid(ctx, key):
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    await ctx.hub.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        ctx.hub.disconnect(websocket)
