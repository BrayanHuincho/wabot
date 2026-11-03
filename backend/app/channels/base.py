from collections.abc import Awaitable, Callable
from typing import Protocol

from app.enums import MessageStatus
from app.models import Message

StatusCallback = Callable[[str, MessageStatus], Awaitable[None]]


class Channel(Protocol):
    name: str

    def bind(self, on_status: StatusCallback) -> None: ...

    async def deliver(self, message: Message, to: str) -> str:
        """Hand the message to the provider and return its external id."""
        ...
