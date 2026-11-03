---
name: pruebas
description: Cómo escribir y ejecutar pruebas en Wabot — pytest + pytest-asyncio con SQLite en memoria, cliente ASGI, IA con httpx.MockTransport, drenar tareas de fondo, y qué casos son obligatorios por área. Úsala ANTES de escribir o arreglar una prueba en backend/tests/ o cuando la CI falle.
---

# Pruebas

## Ejecutar

```bash
cd backend
pytest -q                          # todo
pytest tests/test_bot.py -q        # un archivo
pytest -k window -q                # por nombre
ruff check . && ruff format --check .

cd frontend
npm run lint && npm run typecheck && npm run build
```

La CI (`.github/workflows/ci.yml`) corre exactamente esto.

## Infraestructura

| Pieza | Cómo |
|---|---|
| Entorno | `conftest.py` fija variables antes de importar la app: `ENVIRONMENT=test`, `AI_PROVIDER=none`, `WEBHOOK_URL=""`, `TYPING_DELAY_MS=0`, `SIMULATOR_ACK_DELAY_MS=40`, `CONFIG_DIR` = `backend/config` real |
| BD | SQLite (aiosqlite) en un archivo temporal; la fixture autouse `database` recrea las tablas con `Base.metadata` en cada prueba |
| App | `create_app()` + `httpx.AsyncClient` con `ASGITransport` |
| Arnés | fixture `harness` (o `make_harness(...)` para settings/IA propios): `harness.client`, `harness.ctx`, `await harness.simulate(body="hola")`, `await harness.messages(id)`, `await harness.conversation(id)` |
| IA | `httpx.MockTransport(handler)` pasado como `ai_transport` |
| Tareas | `simulate()` ya drena; si lanzas algo más, `await harness.ctx.tasks.drain()` |

Archivos: `test_bot.py`, `test_messaging.py`, `test_schemas.py`, `test_formatting.py`,
`test_media.py`, `test_webhooks.py`. Añade a uno existente antes de crear otro.

## Plantillas

Unitaria pura:

```python
def test_manual_conversation_stays_silent(flow: Flow) -> None:
    conversation = Conversation(mode=ConversationMode.MANUAL, flow_node=None)
    inbound = Message(type=MessageType.TEXT, body="hola", content={})
    assert decide(flow, conversation, inbound, first_contact=False, ai_enabled=True) == SILENT
```

API:

```python
async def test_closed_conversation_rejects_text(harness: Harness) -> None:
    inbound = await harness.simulate(body="hola")
    url = f"/api/v1/conversations/{inbound['conversation_id']}"
    await harness.client.patch(url, json={"status": "closed"})
    response = await harness.client.post(f"{url}/messages", json={"type": "text", "body": "hola"})
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "conversation_closed"
```

## Casos obligatorios

| Área | Casos |
|---|---|
| `decide()` | manual, reply con `routes`, reply a id de nodo, keyword más larga, primer contacto, IA, no entendido, `fallback: "start"` |
| `Flow` | carga válida; destino inexistente → error con el nombre |
| Esquemas | cada límite: en el límite pasa, +1 falla |
| Ventana 24 h | dentro OK; fuera solo `template` |
| Conversación | una abierta por contacto (incluida concurrencia) |
| Idempotencia | mismo `external_id` → un mensaje |
| Estados | avance `sent→delivered→read`; acuse viejo no retrocede |
| Webhooks | `sign()` conocida; `backoff()`; `failed` al agotar intentos; sin `WEBHOOK_URL` no encola |
| IA | `extract_handoff()`; error del proveedor → no entendido |
| Formato | `to_whatsapp()`, `split_message()` en 4096/4097 |
| Media | dedupe por sha256; 413; 415 |

## ✅ Siempre / ❌ Nunca

- ✅ Un comportamiento por prueba; nombre `test_<qué>_<resultado>`.
- ✅ Teléfonos ficticios (`+51900000001`).
- ❌ Red real. ❌ `sleep` para esperar. ❌ `skip` para pasar la CI.
- ❌ Probar lo que solo existe en Postgres (CHECK regex) contra SQLite.
