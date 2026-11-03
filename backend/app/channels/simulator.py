import asyncio
import logging
import secrets

from app.channels.base import StatusCallback
from app.enums import MessageStatus
from app.models import Message
from app.tasks import TaskRegistry

logger = logging.getLogger(__name__)


class SimulatorChannel:
    name = "simulator"

    def __init__(self, tasks: TaskRegistry, ack_delay_ms: int) -> None:
        self._tasks = tasks
        self._delay = ack_delay_ms / 1000
        self._on_status: StatusCallback | None = None

    def bind(self, on_status: StatusCallback) -> None:
        self._on_status = on_status

    async def deliver(self, message: Message, to: str) -> str:
        external_id = f"sim.{secrets.token_hex(12)}"
        logger.debug("Simulated delivery of %s to %s", message.id, to)
        self._tasks.spawn(self._acknowledge(external_id), name=f"ack-{external_id}")
        return external_id

    async def _acknowledge(self, external_id: str) -> None:
        for status in (MessageStatus.DELIVERED, MessageStatus.READ):
            await asyncio.sleep(self._delay)
            if self._on_status is not None:
                await self._on_status(external_id, status)
