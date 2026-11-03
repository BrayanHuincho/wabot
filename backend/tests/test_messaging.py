import asyncio
import uuid
from datetime import timedelta

from sqlalchemy import update

from app.models import Conversation, utcnow
from tests.conftest import Harness, HarnessFactory


async def expire_window(harness: Harness, conversation_id: str) -> None:
    async with harness.ctx.sessions() as session:
        await session.execute(
            update(Conversation)
            .where(Conversation.id == uuid.UUID(conversation_id))
            .values(last_inbound_at=utcnow() - timedelta(hours=25))
        )
        await session.commit()


async def test_agent_send_switches_to_manual(harness: Harness) -> None:
    first = await harness.simulate(body="Hola")
    conversation_id = first["conversation_id"]

    response = await harness.client.post(
        f"/api/v1/conversations/{conversation_id}/messages",
        json={"type": "text", "body": "Hola, soy Ana del equipo comercial."},
    )

    assert response.status_code == 201
    assert response.json()["author"] == "agent"
    assert response.json()["status"] == "sent"
    conversation = await harness.conversation(conversation_id)
    assert conversation["mode"] == "manual"
    assert conversation["window_open"] is True


async def test_window_closed_rejects_text_but_allows_template(harness: Harness) -> None:
    first = await harness.simulate(body="Hola")
    conversation_id = first["conversation_id"]
    await expire_window(harness, conversation_id)
    url = f"/api/v1/conversations/{conversation_id}/messages"

    rejected = await harness.client.post(url, json={"type": "text", "body": "¿Sigues ahí?"})
    assert rejected.status_code == 409
    assert rejected.json()["error"]["code"] == "window_closed"

    accepted = await harness.client.post(
        url, json={"type": "template", "template": "reactivar_conversacion", "params": ["Monica"]}
    )
    assert accepted.status_code == 201, accepted.text
    assert accepted.json()["body"].startswith("Hola Monica,")


async def test_template_param_count_is_validated(harness: Harness) -> None:
    response = await harness.client.post(
        "/api/v1/messages",
        json={"to": "+51999888777", "type": "template", "template": "recordatorio_reunion"},
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_message"


async def test_api_send_to_new_contact_requires_template(harness: Harness) -> None:
    text = await harness.client.post(
        "/api/v1/messages", json={"to": "+51999888777", "type": "text", "body": "Hola"}
    )
    assert text.status_code == 409

    template = await harness.client.post(
        "/api/v1/messages",
        json={
            "to": "+51 999 888 777",
            "name": "Luis",
            "type": "template",
            "template": "seguimiento_cotizacion",
            "params": ["Luis", "SEO"],
        },
    )
    assert template.status_code == 201
    assert template.json()["author"] == "api"
    assert [b["title"] for b in template.json()["content"]["buttons"]] == [
        "Sí, hablemos",
        "Más adelante",
    ]


async def test_closed_conversation_rejects_send_and_inbound_reopens(harness: Harness) -> None:
    first = await harness.simulate(body="Hola")
    conversation_id = first["conversation_id"]
    closed = await harness.client.patch(
        f"/api/v1/conversations/{conversation_id}", json={"status": "closed"}
    )
    assert closed.json()["status"] == "closed"

    response = await harness.client.post(
        f"/api/v1/conversations/{conversation_id}/messages", json={"type": "text", "body": "x"}
    )
    assert response.json()["error"]["code"] == "conversation_closed"

    again = await harness.simulate(body="Hola de nuevo")
    assert again["conversation_id"] == conversation_id
    assert (await harness.conversation(conversation_id))["status"] == "open"


async def test_status_moves_forward_to_read(harness: Harness) -> None:
    first = await harness.simulate(body="Hola")
    await asyncio.sleep(0.1)
    await harness.ctx.tasks.drain()

    replies = [m for m in await harness.messages(first["conversation_id"]) if m["author"] == "bot"]
    assert all(reply["status"] == "read" for reply in replies)
    assert all(reply["delivered_at"] and reply["read_at"] for reply in replies)


async def test_inbox_lists_unread_and_search(harness: Harness) -> None:
    first = await harness.simulate(body="Hola", name="Monica")
    await harness.simulate(phone="+51911222333", body="Hola", name="Pedro")

    inbox = (await harness.client.get("/api/v1/conversations", params={"status": "open"})).json()
    assert len(inbox) == 2
    found = (await harness.client.get("/api/v1/conversations", params={"search": "moni"})).json()
    assert [c["contact"]["name"] for c in found] == ["Monica"]
    assert found[0]["unread_count"] == 1

    read = await harness.client.post(f"/api/v1/conversations/{first['conversation_id']}/read")
    assert read.json()["unread_count"] == 0


async def test_api_key_is_enforced(make_harness: HarnessFactory) -> None:
    harness = await make_harness(api_key="secret")
    denied = await harness.client.get("/api/v1/info")
    assert denied.status_code == 401
    assert denied.json()["error"]["code"] == "unauthorized"

    allowed = await harness.client.get("/api/v1/info", headers={"X-API-Key": "secret"})
    assert allowed.json()["channel"] == "simulator"
    assert (await harness.client.get("/health")).json()["database"] == "ok"
