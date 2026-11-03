# API

Base: `http://localhost:8000/api/v1` · Swagger en `/docs`.

Autenticación: cabecera `X-API-Key`. Si `API_KEY` está vacío (desarrollo) no se exige.
El WebSocket acepta la clave en `?key=`. Los archivos (`GET /media/{id}`) son públicos por id.

Errores: siempre `{"error": {"code": "window_closed", "message": "..."}}` con el status HTTP adecuado
(`404 not_found`, `409 window_closed`, `409 conversation_closed`, `413 file_too_large`,
`415 unsupported_media`, `422 invalid_message`).

## Objetos

### Contact
```json
{ "id": "uuid", "phone": "+51924368603", "name": "Brayan" }
```

### Conversation
```json
{
  "id": "uuid",
  "contact": { "...": "Contact" },
  "mode": "auto | manual",
  "status": "open | closed",
  "unread_count": 2,
  "preview": "Que servicios tiene?",
  "last_message_at": "2026-09-28T16:00:00Z",
  "window_expires_at": "2026-09-29T16:00:00Z | null",
  "window_open": true
}
```

### Media
```json
{ "id": "uuid", "filename": "brochure.pdf", "mime_type": "application/pdf",
  "size_bytes": 48211, "url": "http://localhost:8000/api/v1/media/uuid" }
```

### MessageContent (lo que se envía)
| type | campos obligatorios | límites (los de Meta) |
|---|---|---|
| `text` | `body` | 4096 caracteres |
| `image` `video` `audio` `document` `sticker` | `media_id` · `body` = pie opcional | pie 1024 |
| `buttons` | `body`, `buttons[1..3]` `{id, title}` | title 20 |
| `list` | `body`, `list_button`, `sections[]` `{title, rows[] {id, title, description}}` | 10 filas en total · title 24 · description 72 |
| `cta_url` | `body`, `url`, `url_label` | url_label 20 |
| `location` | `location {latitude, longitude, name, address}` | |
| `template` | `template`, `params[]` | nombres de `config/templates.json` |

Opcionales en interactivos: `header` (60), `footer` (60).

### Message
```json
{
  "id": "uuid",
  "conversation_id": "uuid",
  "direction": "inbound | outbound",
  "author": "contact | bot | agent | api",
  "type": "text",
  "body": "Tenemos el servicio de marketing digital.",
  "content": { "buttons": [] },
  "media": { "...": "Media | null" },
  "reply_to_id": null,
  "status": "received | pending | sent | delivered | read | failed",
  "created_at": "...", "sent_at": null, "delivered_at": null, "read_at": null
}
```
`content` guarda lo específico del tipo (botones, secciones, url, ubicación, plantilla, `reply_id` y
`reply_title` en las respuestas a botones o listas).

## Endpoints

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/health` | `{status, database, ai, channel}` (fuera de `/api/v1`, sin clave) |
| GET | `/info` | `{business_name, business_phone, channel, ai_enabled, ai_model, ai_provider, ai_status, service_window_hours}`; `ai_status`: `ok` (configurada, última llamada correcta o aún sin llamadas), `disabled` o `error` (falló la última llamada) |
| GET | `/ai/check` | prueba mínima a la IA (`"ping"`, 5 tokens) → `{ok, model, latency_ms, error?}`; actualiza `ai_status` |
| GET | `/conversations?status=open&search=&limit=50` | bandeja, más recientes primero |
| GET | `/conversations/{id}` | una conversación |
| PATCH | `/conversations/{id}` | `{mode?, status?}` cambia Manual/Auto o cierra/reabre |
| POST | `/conversations/{id}/read` | pone `unread_count` en 0 |
| GET | `/conversations/{id}/messages?before=<iso>&limit=50` | historial en orden cronológico |
| POST | `/conversations/{id}/messages` | envía como asesor (`author=agent`); pasa la conversación a `manual` |
| POST | `/messages` | `{to: "+51...", name?, ...MessageContent}` envía desde un sistema externo (`author=api`) |
| POST | `/media` | multipart `file` → Media (deduplicado por sha256) |
| GET | `/media/{id}` | descarga el archivo |
| GET | `/templates` | plantillas disponibles `[{name, body, params, buttons}]` |
| POST | `/simulator/messages` | simula al cliente: `{phone, name?, type, body?, media_id?, reply_id?, reply_title?, location?, reply_to_id?}` |
| WS | `/ws` | eventos en tiempo real |

Fuera de la ventana de 24 h solo se aceptan mensajes `template` (409 `window_closed`).

## WebSocket `/api/v1/ws`

Cada evento: `{"event": "...", "data": {...}}`.

| event | data |
|---|---|
| `message.created` | `{message, conversation}` |
| `message.status` | `{id, conversation_id, status, delivered_at, read_at}` |
| `conversation.updated` | `Conversation` |
| `typing` | `{conversation_id, author: "bot"}` |

## Webhooks salientes

Si `WEBHOOK_URL` está definido, cada evento se guarda en `webhook_deliveries` (outbox) y se entrega con
reintentos exponenciales. Eventos: `message.received`, `message.sent`, `message.status`,
`conversation.handoff`, `conversation.closed`.

```
POST <WEBHOOK_URL>
X-Wabot-Event: message.received
X-Wabot-Delivery: <uuid>
X-Wabot-Signature: sha256=<hex hmac del cuerpo con WEBHOOK_SECRET>
```
