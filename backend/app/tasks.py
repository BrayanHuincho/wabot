import asyncio
import logging
from collections.abc import Coroutine
from typing import Any

logger = logging.getLogger(__name__)


class TaskRegistry:
    def __init__(self) -> None:
        self._tasks: set[asyncio.Task[Any]] = set()

    def spawn(
        self, coro: Coroutine[Any, Any, Any], *, name: str | None = None
    ) -> asyncio.Task[Any]:
        task = asyncio.create_task(coro, name=name)
        self._tasks.add(task)
        task.add_done_callback(self._finished)
        return task

    def _finished(self, task: asyncio.Task[Any]) -> None:
        self._tasks.discard(task)
        if not task.cancelled() and (error := task.exception()) is not None:
            logger.error("Background task %s failed", task.get_name(), exc_info=error)

    async def drain(self) -> None:
        while self._tasks:
            await asyncio.gather(*self._tasks, return_exceptions=True)

    async def cancel_all(self) -> None:
        for task in self._tasks:
            task.cancel()
        await asyncio.gather(*self._tasks, return_exceptions=True)
