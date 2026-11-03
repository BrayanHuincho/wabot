import logging
import re
import time
from dataclasses import dataclass
from typing import Literal

import httpx

from app.config import Settings

logger = logging.getLogger(__name__)

ChatMessage = dict[str, str]
AIStatus = Literal["ok", "disabled", "error"]

THINK_BLOCK = re.compile(r"<think(?:ing)?>.*?(?:</think(?:ing)?>|\Z)", re.DOTALL | re.IGNORECASE)


class CompletionError(Exception):
    pass


@dataclass(frozen=True, slots=True)
class CheckResult:
    ok: bool
    model: str
    latency_ms: int
    error: str | None = None


def clean_reply(content: object) -> str | None:
    if not isinstance(content, str):
        return None
    text = THINK_BLOCK.sub("", content).strip()
    return text or None


class ChatClient:
    def __init__(
        self, settings: Settings, transport: httpx.AsyncBaseTransport | None = None
    ) -> None:
        self._settings = settings
        self._failed = False
        self._client = httpx.AsyncClient(
            base_url=settings.ai_url,
            headers=self._headers(settings),
            timeout=httpx.Timeout(settings.ai_timeout_seconds, connect=10.0),
            transport=transport,
        )

    @property
    def enabled(self) -> bool:
        return self._settings.ai_enabled

    @property
    def status(self) -> AIStatus:
        if not self.enabled:
            return "disabled"
        return "error" if self._failed else "ok"

    @property
    def models(self) -> list[str]:
        fallback = self._settings.ai_fallback_model
        primary = self._settings.ai_model
        return [primary, fallback] if fallback and fallback != primary else [primary]

    @staticmethod
    def _headers(settings: Settings) -> dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if key := settings.ai_api_key.get_secret_value():
            headers["Authorization"] = f"Bearer {key}"
        if settings.ai_provider in {"openrouter", "openrouterperu"}:
            headers["HTTP-Referer"] = settings.public_url
            headers["X-Title"] = settings.business_name
        return headers

    async def _request(
        self, model: str, messages: list[ChatMessage], max_tokens: int
    ) -> str | None:
        payload = {
            "model": model,
            "messages": messages,
            "temperature": self._settings.ai_temperature,
            "max_tokens": max_tokens,
        }
        try:
            response = await self._client.post("/chat/completions", json=payload)
            response.raise_for_status()
            content = response.json()["choices"][0]["message"].get("content")
        except httpx.HTTPStatusError as exc:
            status = exc.response.status_code
            raise CompletionError(f"HTTP {status}: {exc.response.text[:200]}") from exc
        except httpx.TimeoutException as exc:
            raise CompletionError("timeout") from exc
        except httpx.HTTPError as exc:
            raise CompletionError(type(exc).__name__) from exc
        except (ValueError, KeyError, IndexError, TypeError, AttributeError) as exc:
            raise CompletionError("respuesta con formato inesperado") from exc
        return clean_reply(content)

    async def complete(self, messages: list[ChatMessage]) -> str | None:
        if not self.enabled:
            return None
        for model in self.models:
            try:
                reply = await self._request(model, messages, self._settings.ai_max_tokens)
            except CompletionError as exc:
                logger.warning("AI model %s failed: %s", model, exc)
                continue
            if reply is None:
                logger.warning("AI model %s returned an empty reply", model)
                continue
            self._failed = False
            logger.info("AI reply from %s", model)
            return reply
        self._failed = True
        return None

    async def check(self) -> CheckResult:
        model = self._settings.ai_model
        if not self.enabled:
            return CheckResult(False, model, 0, "IA desactivada")
        started = time.perf_counter()
        error: str | None = None
        try:
            await self._request(model, [{"role": "user", "content": "ping"}], 5)
        except CompletionError as exc:
            error = str(exc)
        latency_ms = round((time.perf_counter() - started) * 1000)
        self._failed = error is not None
        return CheckResult(error is None, model, latency_ms, error)

    async def aclose(self) -> None:
        await self._client.aclose()
