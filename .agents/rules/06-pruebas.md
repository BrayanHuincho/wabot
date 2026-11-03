---
activation: glob
globs: backend/tests/**, backend/app/**
---
# Reglas de pruebas

## 1. Herramientas

pytest + pytest-asyncio (`asyncio_mode = "auto"`). Base de datos **SQLite** (aiosqlite, archivo
temporal) recreada con `Base.metadata` en cada prueba: rápido y sin servicios externos. Las
variantes de `models.py` existen para esto. Fixtures en `backend/tests/conftest.py` (`harness`,
`make_harness`).

## 2. Qué se prueba siempre

| Área | Mínimo |
|---|---|
| `bot/engine.py` `decide()` | Unitarias puras: manual, reply con `routes`, keyword, primer contacto, IA, no entendido |
| `bot/flow.py` | Flujo válido carga; destino inexistente falla con mensaje claro |
| `schemas.py` | Cada límite de Meta: justo en el límite pasa, uno más falla |
| Ventana de 24 h | Dentro pasa; fuera solo `template`, resto `409 window_closed` |
| Conversaciones | Una sola abierta por contacto, también con dos entrantes concurrentes |
| Idempotencia | Mismo `external_id` dos veces → un mensaje |
| Estados | `sent → delivered → read`; un acuse viejo no hace retroceder |
| Webhooks | Firma correcta, reintento con `backoff`, `failed` al agotar intentos |
| `formatting.py` | `to_whatsapp()` con negritas, títulos, tablas, enlaces; `split_message()` en el límite |
| IA | `extract_handoff()`; cliente con `httpx.MockTransport` (nunca red real) |

## 3. Cómo

- Pruebas de API con el arnés: `harness.client` (ASGI) y `harness.simulate(...)`.
- La IA se inyecta con `httpx.MockTransport(handler)` como `ai_transport`.
- Tareas en segundo plano: `await harness.ctx.tasks.drain()` antes de afirmar, nunca `sleep`.
- `conftest.py` fija `TYPING_DELAY_MS=0` y un `SIMULATOR_ACK_DELAY_MS` mínimo.
- Una prueba, un comportamiento. Nombre que lo diga: `test_outside_window_rejects_text`.
- Datos de prueba con teléfonos ficticios.

## 4. Prohibido

- Llamadas de red reales (proveedores de IA, webhooks).
- `time.sleep`/`asyncio.sleep` para esperar efectos.
- Pruebas que dependen del orden de ejecución.
- Bajar una prueba a `skip` para que pase la CI.

## 5. Frontend

Hoy la garantía es `npm run typecheck` + `npm run lint` + `npm run build`. La lógica pura de
`src/lib/` es la primera candidata a pruebas cuando se añadan (Vitest).
