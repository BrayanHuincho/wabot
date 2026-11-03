---
name: modulo-backend
description: Cómo crear o modificar endpoints, servicios y tareas de fondo en el backend FastAPI de Wabot — capas router/servicio/puerto, Context, transacciones, eventos después del commit, outbox y errores AppError. Úsala ANTES de añadir una ruta a /api/v1, un caso de uso en app/services/ o una tarea en segundo plano.
---

# Módulo de backend — FastAPI

## Capas

```
app/api/<recurso>.py      router delgado: CtxDep + SessionDep → servicio → schemas out
app/services/             messaging.py · conversations.py · bot.py: lógica + commit + eventos
app/bot/, app/ai/,        decisiones puras / puertos
app/channels/, storage.py
```

Las dependencias viven en `Context` (`app/context.py`): `settings`, `sessions`, `tasks`, `hub`,
`channel`, `store`, `flow`, `templates`, `ai`, `system_prompt`. Se construye una vez en
`build_context()`, se guarda en `app.state.ctx` y los routers lo reciben con `CtxDep`
(`app/api/deps.py`). La sesión llega con `SessionDep`; la clave se exige con
`require_api_key`. No crees instancias propias.

## Receta: endpoint nuevo

1. **Contrato.** Añade la fila en `docs/api.md` (método, ruta, cuerpo, errores).
2. **Esquemas** en `app/schemas.py`: `XxxRequest` / `XxxOut` (Pydantic v2, límites con `Field`).
3. **Servicio** en `app/services/`:

```python
async def block_contact(ctx: Context, session: AsyncSession, conversation_id: UUID) -> Conversation:
    conversation = await get_conversation(session, conversation_id)
    conversation.contact.blocked_at = utcnow()
    webhooks.enqueue(session, ctx.settings, "contact.blocked", dump(conversation))
    await session.commit()
    await publish_conversation(ctx, conversation)
    return conversation
```

Modelo real: `update_conversation()` y `hand_off()` en `services/conversations.py`.

4. **Router** en `app/api/`: valida, llama, devuelve `XxxOut`. Sin consultas.
5. **Error nuevo** → subclase de `AppError` en `app/errors.py` (`status_code`, `code`).
6. **Prueba** en `backend/tests/` (ver `/pruebas`).
7. **Frontend**: tipo en `frontend/src/lib/types.ts` y método en `lib/api.ts`.

## Orden de efectos (no negociable)

| Momento | Qué |
|---|---|
| Dentro de la transacción | Cambios de BD + `webhooks.enqueue(...)` (outbox) |
| `await session.commit()` | |
| Después del commit | `ctx.hub.publish(...)` (WebSocket) y `ctx.tasks.spawn(...)` |

Publicar antes del commit muestra fantasmas en el panel si hay rollback.

## Tareas en segundo plano

`ctx.tasks.spawn(coro, name="bot-reply")`. Cada tarea abre **su propia sesión**; nunca reutilices
la de la petición. En pruebas: `await ctx.tasks.drain()`.

## Envío de mensajes

No llames a `ctx.channel.deliver()` desde un router ni desde el bot. Usa
`messaging.send(ctx, session, conversation, content, author)`: `ensure_sendable()` valida ventana
de 24 h y estado (`409 window_closed` / `conversation_closed`), renderiza plantillas, pasa a
`manual` si escribe un asesor, persiste `pending`, publica `message.created` y `dispatch()` entrega
y marca `sent`/`failed`. Los acuses entran por `apply_status()` y `advance()` (solo hacia
delante). Entrada del cliente: `bot.handle_inbound()` → `messaging.record_inbound()` → `run_bot()`.

## Errores

| Excepción | HTTP | `code` |
|---|---|---|
| `NotFound` | 404 | `not_found` |
| `WindowClosed` | 409 | `window_closed` |
| `ConversationClosed` | 409 | `conversation_closed` |
| `FileTooLarge` | 413 | `file_too_large` |
| `UnsupportedMedia` | 415 | `unsupported_media` |
| `InvalidMessage` / validación | 422 | `invalid_message` |
| `Unauthorized` | 401 | `unauthorized` |

Mensaje en español, código en inglés.

## ✅ Siempre / ❌ Nunca

- ✅ `StrEnum` de `app/enums.py`, nunca `"open"` literal.
- ✅ `utcnow()` de `app/models.py` para fechas.
- ✅ `ruff check . && ruff format .` antes de terminar.
- ❌ `HTTPException` en servicios. ❌ `requests` o I/O bloqueante. ❌ `asyncio.create_task` suelto.
- ❌ Lógica en routers. ❌ Docstrings y comentarios de relleno.
