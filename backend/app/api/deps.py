import secrets
from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import Depends, Header, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.context import Context
from app.errors import Unauthorized


def get_ctx(request: Request) -> Context:
    return request.app.state.ctx


CtxDep = Annotated[Context, Depends(get_ctx)]


async def get_session(ctx: CtxDep) -> AsyncIterator[AsyncSession]:
    async with ctx.sessions() as session:
        yield session


SessionDep = Annotated[AsyncSession, Depends(get_session)]


def key_is_valid(ctx: Context, provided: str | None) -> bool:
    expected = ctx.settings.api_key.get_secret_value()
    return not expected or secrets.compare_digest(provided or "", expected)


def require_api_key(
    ctx: CtxDep, x_api_key: Annotated[str | None, Header(alias="X-API-Key")] = None
) -> None:
    if not key_is_valid(ctx, x_api_key):
        raise Unauthorized("Falta la cabecera X-API-Key o no es válida.")
