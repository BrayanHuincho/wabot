import asyncio
import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager, suppress

import httpx
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.api import conversations, media, messages, simulator, system, ws
from app.api.deps import require_api_key
from app.config import Settings, get_settings
from app.context import Context, build_context
from app.db import Session
from app.errors import install_error_handlers
from app.services.messaging import apply_status
from app.webhooks import WebhookWorker

logger = logging.getLogger(__name__)

SHUTDOWN_GRACE_SECONDS = 5


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    ctx: Context = app.state.ctx
    webhooks = WebhookWorker(ctx.settings, ctx.sessions)
    worker = (
        asyncio.create_task(webhooks.run(), name="webhook-worker")
        if ctx.settings.webhook_url
        else None
    )
    logger.info("Wabot ready on channel %s (AI: %s)", ctx.channel.name, ctx.ai.enabled)
    try:
        yield
    finally:
        if worker is not None:
            worker.cancel()
            with suppress(asyncio.CancelledError):
                await worker
        await webhooks.aclose()
        try:
            async with asyncio.timeout(SHUTDOWN_GRACE_SECONDS):
                await ctx.tasks.drain()
        except TimeoutError:
            await ctx.tasks.cancel_all()
        await ctx.ai.aclose()


def create_app(
    settings: Settings | None = None,
    *,
    sessions: async_sessionmaker[AsyncSession] | None = None,
    ai_transport: httpx.AsyncBaseTransport | None = None,
) -> FastAPI:
    settings = settings or get_settings()
    ctx = build_context(settings, sessions or Session, ai_transport)
    ctx.channel.bind(lambda external_id, status: apply_status(ctx, external_id, status))

    app = FastAPI(title="Wabot", version="0.1.0", lifespan=lifespan)
    app.state.ctx = ctx
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    install_error_handlers(app)

    secured = [Depends(require_api_key)]
    app.include_router(system.health_router)
    app.include_router(ws.router, prefix="/api/v1")
    app.include_router(media.router, prefix="/api/v1")
    for module in (system, conversations, messages, simulator):
        app.include_router(module.router, prefix="/api/v1", dependencies=secured)
    return app
