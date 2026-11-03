import hashlib
import hmac
import json

import httpx
from sqlalchemy import select

from app.enums import DeliveryStatus
from app.models import WebhookDelivery
from app.webhooks import WebhookWorker, sign
from tests.conftest import HarnessFactory

SECRET = "shh"


def test_signature_is_hmac_sha256() -> None:
    body = b'{"event":"message.received"}'
    expected = hmac.new(SECRET.encode(), body, hashlib.sha256).hexdigest()
    assert sign(SECRET, body) == f"sha256={expected}"


async def test_events_are_delivered_signed(make_harness: HarnessFactory) -> None:
    received: list[httpx.Request] = []

    def receiver(request: httpx.Request) -> httpx.Response:
        received.append(request)
        return httpx.Response(204)

    harness = await make_harness(webhook_url="https://hooks.test/wabot", webhook_secret=SECRET)
    await harness.simulate(body="Hola")
    worker = WebhookWorker(
        harness.ctx.settings, harness.ctx.sessions, httpx.MockTransport(receiver)
    )
    await worker.deliver_due()
    await worker.aclose()

    events = [request.headers["x-wabot-event"] for request in received]
    assert events[0] == "message.received"
    assert "message.sent" in events
    first = received[0]
    assert first.headers["x-wabot-signature"] == sign(SECRET, first.content)
    payload = json.loads(first.content)
    assert payload["id"] == first.headers["x-wabot-delivery"]
    assert payload["data"]["message"]["body"] == "Hola"


async def test_failed_delivery_is_retried_with_backoff(make_harness: HarnessFactory) -> None:
    harness = await make_harness(
        webhook_url="https://hooks.test/wabot", webhook_secret=SECRET, webhook_max_attempts=2
    )
    await harness.simulate(body="Hola")
    failing = httpx.MockTransport(lambda request: httpx.Response(500))
    worker = WebhookWorker(harness.ctx.settings, harness.ctx.sessions, failing)
    await worker.deliver_due()

    async with harness.ctx.sessions() as session:
        deliveries = list(await session.scalars(select(WebhookDelivery)))
        assert all(d.status is DeliveryStatus.PENDING and d.attempts == 1 for d in deliveries)
        assert all(d.last_error for d in deliveries)
        for delivery in deliveries:
            delivery.next_attempt_at = delivery.created_at
        await session.commit()

    await worker.deliver_due()
    await worker.aclose()
    async with harness.ctx.sessions() as session:
        statuses = set(await session.scalars(select(WebhookDelivery.status)))
    assert statuses == {DeliveryStatus.FAILED}


async def test_no_outbox_without_url(make_harness: HarnessFactory) -> None:
    harness = await make_harness()
    await harness.simulate(body="Hola")
    async with harness.ctx.sessions() as session:
        assert list(await session.scalars(select(WebhookDelivery))) == []
