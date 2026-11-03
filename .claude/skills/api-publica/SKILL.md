---
name: api-publica
description: API pública de Wabot para sistemas externos — contrato docs/api.md, autenticación X-API-Key, formato de errores, POST /messages, WebSocket /ws y webhooks salientes con outbox y firma HMAC. Úsala ANTES de añadir o cambiar un endpoint público, un evento de WebSocket o de webhook, o al escribir ejemplos de integración.
---

# API pública

El contrato es **`docs/api.md`**. Si el código y el doc discrepan, el doc manda y se corrige el
código (o se cambian los dos en el mismo commit).

## Superficie

| Pieza | Dónde |
|---|---|
| REST `/api/v1/*` | `app/api/` |
| `GET /health` (sin clave, fuera de `/api/v1`) | `app/main.py` |
| WebSocket `/ws` (`?key=`) | `app/realtime.py` (`Hub.connect`, `Hub.publish`) |
| Webhooks salientes | `app/webhooks.py` (`enqueue`, `sign`, `encode_body`, `backoff`, `WebhookWorker`) |
| Errores | `app/errors.py` → `{"error": {"code", "message"}}` |

## Autenticación

`X-API-Key` comparada con `hmac.compare_digest` contra `API_KEY`. Vacío = abierto (solo dev).
Excepciones: `/health` y `GET /media/{id}`.

## Enviar desde un sistema

`POST /api/v1/messages` con `SendMessageRequest` = `{to, name?, ...MessageContent}` →
`author=api`. Crea contacto/conversación si no existen. Respeta ventana de 24 h (`409
window_closed` → usar `template`).

## Eventos

| Canal | Eventos | Cuándo se emiten |
|---|---|---|
| WebSocket | `message.created`, `message.status`, `conversation.updated`, `typing` | Después del commit |
| Webhook | `message.received`, `message.sent`, `message.status`, `conversation.handoff`, `conversation.closed` | `enqueue()` dentro de la transacción |

Cuerpo del webhook: `{id, event, created_at, data}`. Cabeceras `X-Wabot-Event`,
`X-Wabot-Delivery` (= `id`), `X-Wabot-Signature: sha256=<hex>`. Reintentos con
`backoff(n) = min(5 s · 2^(n-1), 1 h)` hasta `WEBHOOK_MAX_ATTEMPTS`.

## Receta: evento de webhook nuevo

1. Nombre `recurso.accion` en inglés.
2. `webhooks.enqueue(session, ctx.settings, "contact.blocked", data)` en el servicio, antes del commit.
3. `data` serializado con los mismos `*Out` de la API (nunca el modelo ORM crudo).
4. Fila en `docs/api.md` y `docs/webhooks.md`.
5. Prueba: se encola una fila con el evento y el payload esperados.

## Receta: endpoint público nuevo

Ver `/modulo-backend`, más: versionado bajo `/api/v1`, respuesta con objetos del contrato, error
documentado, ejemplo `curl` en `docs/api.md` si es de integración.

## Compatibilidad

- No renombrar ni quitar campos ni eventos: añadir. Cambios incompatibles → `/api/v2`.
- Fechas ISO 8601 UTC. Ids uuid en string. Enums en minúsculas.

## ✅ Siempre / ❌ Nunca

- ✅ Firmar todo webhook; verificación de ejemplo en Node/PHP/Python en `docs/webhooks.md`.
- ✅ Idempotencia: el receptor deduplica por `X-Wabot-Delivery`.
- ❌ POST de webhook en línea dentro de una petición.
- ❌ Exponer secretos en `/info` o en errores.
- ❌ Devolver datos sin el formato del contrato.
