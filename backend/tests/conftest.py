import os
import tempfile
from collections.abc import AsyncIterator, Callable
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import httpx
import pytest

ROOT = Path(__file__).resolve().parents[1]
WORKDIR = Path(tempfile.mkdtemp(prefix="wabot-tests-"))

os.environ.update(
    ENVIRONMENT="test",
    DATABASE_URL=f"sqlite+aiosqlite:///{(WORKDIR / 'test.db').as_posix()}",
    CONFIG_DIR=str(ROOT / "config"),
    MEDIA_DIR=str(WORKDIR / "media"),
    API_KEY="",
    AI_PROVIDER="none",
    AI_BASE_URL="",
    AI_API_KEY="",
    AI_MODEL="test/model",
    AI_FALLBACK_MODEL="",
    AI_TEMPERATURE="0.3",
    AI_MAX_TOKENS="600",
    WEBHOOK_URL="",
    TYPING_DELAY_MS="0",
    SIMULATOR_ACK_DELAY_MS="40",
)

from app.config import Settings, get_settings  # noqa: E402
from app.context import Context  # noqa: E402
from app.db import Base, Session, engine  # noqa: E402
from app.main import create_app  # noqa: E402


@dataclass
class Harness:
    client: httpx.AsyncClient
    ctx: Context

    async def simulate(self, phone: str = "+51924368603", **fields: Any) -> dict[str, Any]:
        fields.setdefault("type", "text")
        response = await self.client.post(
            "/api/v1/simulator/messages", json={"phone": phone, **fields}
        )
        assert response.status_code == 201, response.text
        await self.ctx.tasks.drain()
        return response.json()

    async def messages(self, conversation_id: str) -> list[dict[str, Any]]:
        response = await self.client.get(f"/api/v1/conversations/{conversation_id}/messages")
        assert response.status_code == 200, response.text
        return response.json()

    async def conversation(self, conversation_id: str) -> dict[str, Any]:
        response = await self.client.get(f"/api/v1/conversations/{conversation_id}")
        return response.json()


@pytest.fixture(autouse=True)
async def database() -> AsyncIterator[None]:
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.drop_all)
        await connection.run_sync(Base.metadata.create_all)
    yield
    await engine.dispose()


HarnessFactory = Callable[..., Any]


@pytest.fixture
async def make_harness() -> AsyncIterator[HarnessFactory]:
    harnesses: list[Harness] = []

    async def build(
        ai_transport: httpx.AsyncBaseTransport | None = None, **overrides: Any
    ) -> Harness:
        settings = Settings(**(get_settings().model_dump() | overrides))
        app = create_app(settings, sessions=Session, ai_transport=ai_transport)
        client = httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app), base_url="http://testserver"
        )
        harness = Harness(client, app.state.ctx)
        harnesses.append(harness)
        return harness

    yield build
    for harness in harnesses:
        await harness.ctx.tasks.drain()
        await harness.client.aclose()
        await harness.ctx.ai.aclose()


@pytest.fixture
async def harness(make_harness: HarnessFactory) -> Harness:
    return await make_harness()
