from dataclasses import dataclass
from pathlib import Path

import httpx
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.ai.client import ChatClient
from app.ai.prompt import load_system_prompt
from app.bot.flow import Flow
from app.channels.base import Channel
from app.channels.simulator import SimulatorChannel
from app.config import Settings
from app.realtime import Hub
from app.storage import MediaStore
from app.tasks import TaskRegistry
from app.templates import TemplateCatalog


@dataclass(slots=True)
class Context:
    settings: Settings
    sessions: async_sessionmaker[AsyncSession]
    tasks: TaskRegistry
    hub: Hub
    channel: Channel
    store: MediaStore
    flow: Flow
    templates: TemplateCatalog
    ai: ChatClient
    system_prompt: str

    @property
    def assets_dir(self) -> Path:
        return self.settings.config_dir / "assets"


def build_context(
    settings: Settings,
    sessions: async_sessionmaker[AsyncSession],
    ai_transport: httpx.AsyncBaseTransport | None = None,
) -> Context:
    tasks = TaskRegistry()
    config_dir = settings.config_dir
    return Context(
        settings=settings,
        sessions=sessions,
        tasks=tasks,
        hub=Hub(),
        channel=SimulatorChannel(tasks, settings.simulator_ack_delay_ms),
        store=MediaStore(settings.media_dir),
        flow=Flow.load(config_dir / "flow.json"),
        templates=TemplateCatalog.load(config_dir / "templates.json"),
        ai=ChatClient(settings, ai_transport),
        system_prompt=load_system_prompt(config_dir, settings.business_name),
    )
