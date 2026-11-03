import json

import httpx

from tests.conftest import Harness, HarnessFactory


def bot_messages(messages: list[dict]) -> list[dict]:
    return [message for message in messages if message["author"] == "bot"]


async def test_first_message_gets_welcome_menu(harness: Harness) -> None:
    inbound = await harness.simulate(body="Buenas tardes", name="Monica")
    replies = bot_messages(await harness.messages(inbound["conversation_id"]))

    assert [reply["type"] for reply in replies] == ["image", "buttons"]
    assert replies[0]["media"]["mime_type"] == "image/png"
    assert [b["id"] for b in replies[1]["content"]["buttons"]] == ["services", "brochure", "human"]
    assert all(reply["status"] in {"sent", "delivered", "read"} for reply in replies)


async def test_button_reply_routes_to_node(harness: Harness) -> None:
    first = await harness.simulate(body="Hola")
    await harness.simulate(type="reply", reply_id="brochure", reply_title="Recibir brochure")

    replies = bot_messages(await harness.messages(first["conversation_id"]))
    document = replies[2]
    assert document["type"] == "document"
    assert document["media"]["filename"] == "brochure.pdf"
    assert replies[-1]["type"] == "buttons"


async def test_list_reply_routes_through_current_node(harness: Harness) -> None:
    first = await harness.simulate(body="Hola")
    await harness.simulate(type="reply", reply_id="services", reply_title="Ver servicios")
    await harness.simulate(type="reply", reply_id="svc_seo", reply_title="SEO y Google Ads")

    replies = bot_messages(await harness.messages(first["conversation_id"]))
    assert replies[-2]["body"].startswith("¡Excelente elección!")


async def test_booking_collects_day_and_time_in_chat(harness: Harness) -> None:
    first = await harness.simulate(body="agendar")
    await harness.simulate(type="reply", reply_id="day_tue", reply_title="Martes")
    await harness.simulate(type="reply", reply_id="time_10", reply_title="10:00 am")

    replies = bot_messages(await harness.messages(first["conversation_id"]))
    assert replies[0]["type"] == "list"
    assert replies[1]["body"] == "Perfecto, el *Martes*. ¿A qué hora prefieres?"
    assert "agendado para el *Martes* a las *10:00 am*" in replies[2]["body"]


async def test_keyword_match_ignores_accents_and_punctuation(harness: Harness) -> None:
    first = await harness.simulate(body="Hola")
    await harness.simulate(body="¿Me pasas el CATÁLOGO, porfa?")

    replies = bot_messages(await harness.messages(first["conversation_id"]))
    assert replies[-2]["type"] == "document"


async def test_unknown_text_without_ai_repeats_menu(harness: Harness) -> None:
    first = await harness.simulate(body="Hola")
    await harness.simulate(body="xyz")

    replies = bot_messages(await harness.messages(first["conversation_id"]))
    assert replies[-3]["body"].startswith("Disculpa, no entendí")
    assert replies[-1]["type"] == "buttons"


async def test_handoff_node_switches_to_manual(harness: Harness) -> None:
    first = await harness.simulate(body="Hola")
    await harness.simulate(type="reply", reply_id="human", reply_title="Hablar con asesor")

    conversation = await harness.conversation(first["conversation_id"])
    assert conversation["mode"] == "manual"


async def test_manual_mode_silences_bot(harness: Harness) -> None:
    first = await harness.simulate(body="Hola")
    conversation_id = first["conversation_id"]
    await harness.client.patch(f"/api/v1/conversations/{conversation_id}", json={"mode": "manual"})
    before = len(await harness.messages(conversation_id))

    await harness.simulate(body="menu")

    messages = await harness.messages(conversation_id)
    assert len(messages) == before + 1
    assert messages[-1]["author"] == "contact"


def fake_provider(reply: str, seen: list[dict]) -> httpx.MockTransport:
    def handler(request: httpx.Request) -> httpx.Response:
        seen.append({"headers": dict(request.headers), "body": json.loads(request.content)})
        return httpx.Response(200, json={"choices": [{"message": {"content": reply}}]})

    return httpx.MockTransport(handler)


async def test_ai_fallback_answers_free_text(make_harness: HarnessFactory) -> None:
    seen: list[dict] = []
    harness = await make_harness(
        ai_transport=fake_provider("Hacemos **SEO** desde S/ 990 al mes.", seen),
        ai_provider="openrouter",
        ai_api_key="sk-test",
    )
    first = await harness.simulate(body="Hola")
    await harness.simulate(body="Cuánto cuesta posicionar mi web?")

    replies = bot_messages(await harness.messages(first["conversation_id"]))
    assert replies[-1]["body"] == "Hacemos *SEO* desde S/ 990 al mes."
    request = seen[0]
    assert request["headers"]["authorization"] == "Bearer sk-test"
    assert request["headers"]["x-title"]
    roles = [message["role"] for message in request["body"]["messages"]]
    assert roles[0] == "system" and roles[-1] == "user"
    assert "[eligió" not in request["body"]["messages"][-1]["content"]


async def test_first_message_that_is_a_question_goes_to_ai(make_harness: HarnessFactory) -> None:
    harness = await make_harness(
        ai_transport=fake_provider("Sí, hacemos tiendas online.", []),
        ai_provider="openrouter",
        ai_api_key="sk-test",
    )
    first = await harness.simulate(body="¿Hacen tiendas online?")

    replies = bot_messages(await harness.messages(first["conversation_id"]))
    assert [reply["body"] for reply in replies] == ["Sí, hacemos tiendas online."]


async def test_ai_handoff_token_switches_to_manual(make_harness: HarnessFactory) -> None:
    harness = await make_harness(
        ai_transport=fake_provider("Te paso con un asesor. [[handoff]]", []),
        ai_provider="openai",
        ai_api_key="sk-test",
    )
    first = await harness.simulate(body="Hola")
    await harness.simulate(body="Quiero contratar ya")

    conversation = await harness.conversation(first["conversation_id"])
    replies = bot_messages(await harness.messages(first["conversation_id"]))
    assert conversation["mode"] == "manual"
    assert replies[-1]["body"] == "Te paso con un asesor."


async def test_ai_failure_falls_back_to_menu(make_harness: HarnessFactory) -> None:
    failing = httpx.MockTransport(lambda request: httpx.Response(502, text="bad gateway"))
    harness = await make_harness(ai_transport=failing, ai_provider="openai", ai_api_key="k")
    first = await harness.simulate(body="Hola")
    await harness.simulate(body="algo raro")

    replies = bot_messages(await harness.messages(first["conversation_id"]))
    assert replies[-1]["type"] == "buttons"


async def test_ai_retries_with_fallback_model(make_harness: HarnessFactory) -> None:
    models: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        model = json.loads(request.content)["model"]
        models.append(model)
        if model == "primary":
            return httpx.Response(503, text="overloaded")
        reply = "<think>pienso</think>Respuesta del respaldo"
        return httpx.Response(200, json={"choices": [{"message": {"content": reply}}]})

    harness = await make_harness(
        ai_transport=httpx.MockTransport(handler),
        ai_provider="openai",
        ai_api_key="k",
        ai_model="primary",
        ai_fallback_model="backup",
    )
    first = await harness.simulate(body="Hola")
    await harness.simulate(body="tienen oficina?")

    replies = bot_messages(await harness.messages(first["conversation_id"]))
    assert models == ["primary", "backup"]
    assert replies[-1]["body"] == "Respuesta del respaldo"
    info = (await harness.client.get("/api/v1/info")).json()
    assert info["ai_status"] == "ok" and info["ai_provider"] == "openai"


async def test_ai_empty_reply_marks_status_error(make_harness: HarnessFactory) -> None:
    empty = httpx.MockTransport(
        lambda request: httpx.Response(
            200, json={"choices": [{"message": {"content": "<think>solo razono</think>"}}]}
        )
    )
    harness = await make_harness(ai_transport=empty, ai_provider="openai", ai_api_key="k")
    assert (await harness.client.get("/api/v1/info")).json()["ai_status"] == "ok"
    first = await harness.simulate(body="Hola")
    await harness.simulate(body="algo raro")

    replies = bot_messages(await harness.messages(first["conversation_id"]))
    assert replies[-1]["type"] == "buttons"
    assert (await harness.client.get("/api/v1/info")).json()["ai_status"] == "error"


async def test_ai_check_reports_latency_and_recovers_status(make_harness: HarnessFactory) -> None:
    seen: list[dict] = []
    harness = await make_harness(
        ai_transport=fake_provider("pong", seen),
        ai_provider="openai",
        ai_api_key="k",
        ai_model="gpt-4o-mini",
    )
    response = await harness.client.get("/api/v1/ai/check")

    body = response.json()
    assert body["ok"] is True and body["model"] == "gpt-4o-mini"
    assert "error" not in body and body["latency_ms"] >= 0
    assert seen[0]["body"]["max_tokens"] == 5


async def test_ai_check_when_disabled(harness: Harness) -> None:
    body = (await harness.client.get("/api/v1/ai/check")).json()
    info = (await harness.client.get("/api/v1/info")).json()
    assert body["ok"] is False and body["error"]
    assert info["ai_status"] == "disabled"
