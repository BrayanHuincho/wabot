import asyncio
import hashlib
import hmac
import json
import logging
from datetime import timedelta
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.config import Settings
from app.enums import DeliveryStatus
from app.models import WebhookDelivery, utcnow

logger = logging.getLogger(__name__)

MAX_BACKOFF = timedelta(hours=1)
BATCH_SIZE = 20


def enqueue(session: AsyncSession, settings: Settings, event: str, data: dict[str, Any]) -> None:
    if settings.webhook_url:
        session.add(WebhookDelivery(event=event, payload=data))


def sign(secret: str, body: bytes) -> str:
    return "sha256=" + hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()


def encode_body(delivery: WebhookDelivery) -> bytes:
    envelope = {
        "id": str(delivery.id),
        "event": delivery.event,
        "created_at": delivery.created_at.isoformat(),
        "data": delivery.payload,
    }
    return json.dumps(envelope, ensure_ascii=False, separators=(",", ":")).encode()


def backoff(attempts: int) -> timedelta:
    return min(timedelta(seconds=5 * 2 ** (attempts - 1)), MAX_BACKOFF)


class WebhookWorker:
    def __init__(
        self,
        settings: Settings,
        sessions: async_sessionmaker[AsyncSession],
        transport: httpx.AsyncBaseTransport | None = None,
        poll_interval: float = 1.0,
    ) -> None:
        self._settings = settings
        self._sessions = sessions
        self._poll_interval = poll_interval
        self._client = httpx.AsyncClient(timeout=10.0, transport=transport)

    async def run(self) -> None:
        while True:
            try:
                processed = await self.deliver_due()
            except Exception:
                logger.exception("Webhook worker iteration failed")
                processed = 0
            if not processed:
                await asyncio.sleep(self._poll_interval)

    async def deliver_due(self) -> int:
        async with self._sessions() as session:
            due = await session.scalars(
                select(WebhookDelivery)
                .where(
                    WebhookDelivery.status == DeliveryStatus.PENDING,
                    WebhookDelivery.next_attempt_at <= utcnow(),
                )
                .order_by(WebhookDelivery.next_attempt_at)
                .limit(BATCH_SIZE)
                .with_for_update(skip_locked=True)
            )
            deliveries = list(due)
            await asyncio.gather(*(self._attempt(delivery) for delivery in deliveries))
            await session.commit()
            return len(deliveries)

    async def _attempt(self, delivery: WebhookDelivery) -> None:
        body = encode_body(delivery)
        headers = {
            "Content-Type": "application/json",
            "X-Wabot-Event": delivery.event,
            "X-Wabot-Delivery": str(delivery.id),
            "X-Wabot-Signature": sign(self._settings.webhook_secret.get_secret_value(), body),
        }
        delivery.attempts += 1
        try:
            response = await self._client.post(
                self._settings.webhook_url, content=body, headers=headers
            )
            response.raise_for_status()
        except httpx.HTTPError as exc:
            self._schedule_retry(delivery, str(exc) or exc.__class__.__name__)
            return
        delivery.status = DeliveryStatus.DELIVERED
        delivery.delivered_at = utcnow()
        delivery.last_error = None

    def _schedule_retry(self, delivery: WebhookDelivery, error: str) -> None:
        delivery.last_error = error[:500]
        if delivery.attempts >= self._settings.webhook_max_attempts:
            delivery.status = DeliveryStatus.FAILED
            logger.warning("Webhook %s gave up after %s attempts", delivery.id, delivery.attempts)
        else:
            delivery.next_attempt_at = utcnow() + backoff(delivery.attempts)

    async def aclose(self) -> None:
        await self._client.aclose()
