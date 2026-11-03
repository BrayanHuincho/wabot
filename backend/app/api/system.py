from typing import Any

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.api.deps import CtxDep
from app.schemas import TemplateOut

health_router = APIRouter(tags=["system"])
router = APIRouter(tags=["system"])


@health_router.get("/health")
async def health(ctx: CtxDep) -> JSONResponse:
    try:
        async with ctx.sessions() as session:
            await session.execute(text("SELECT 1"))
        database = "ok"
    except Exception:
        database = "unavailable"
    healthy = database == "ok"
    body = {
        "status": "ok" if healthy else "degraded",
        "database": database,
        "ai": ctx.settings.ai_provider if ctx.ai.enabled else "disabled",
        "channel": ctx.channel.name,
    }
    return JSONResponse(body, status_code=200 if healthy else 503)


@router.get("/info")
async def info(ctx: CtxDep) -> dict[str, Any]:
    settings = ctx.settings
    return {
        "business_name": settings.business_name,
        "business_phone": settings.business_phone,
        "channel": ctx.channel.name,
        "ai_enabled": ctx.ai.enabled,
        "ai_model": settings.ai_model if ctx.ai.enabled else None,
        "ai_provider": settings.ai_provider,
        "ai_status": ctx.ai.status,
        "service_window_hours": settings.service_window_hours,
    }


@router.get("/ai/check")
async def ai_check(ctx: CtxDep) -> dict[str, Any]:
    result = await ctx.ai.check()
    body: dict[str, Any] = {"ok": result.ok, "model": result.model, "latency_ms": result.latency_ms}
    if result.error:
        body["error"] = result.error
    return body


@router.get("/templates", response_model=list[TemplateOut])
async def templates(ctx: CtxDep) -> list[TemplateOut]:
    return [TemplateOut.model_validate(item.model_dump()) for item in ctx.templates.all()]
