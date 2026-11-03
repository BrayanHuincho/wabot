import logging
from typing import Any

from fastapi import WebSocket
from fastapi.encoders import jsonable_encoder

logger = logging.getLogger(__name__)


class Hub:
    def __init__(self) -> None:
        self._clients: set[WebSocket] = set()

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self._clients.add(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        self._clients.discard(websocket)

    async def publish(self, event: str, data: Any) -> None:
        payload = {"event": event, "data": jsonable_encoder(data)}
        for client in list(self._clients):
            try:
                await client.send_json(payload)
            except Exception:
                logger.debug("Dropping websocket client after failed send", exc_info=True)
                self.disconnect(client)
