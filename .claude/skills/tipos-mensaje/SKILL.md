---
name: tipos-mensaje
description: Tipos de mensaje de WhatsApp en Wabot — tabla de límites de Meta, dónde se valida cada uno y receta para añadir o cambiar un tipo de punta a punta (enum, migración, schema, canal, IA, frontend, docs). Úsala ANTES de tocar MessageType, schemas.MessageContent, lib/limits.ts o el render de una burbuja.
---

# Tipos de mensaje

## Límites de Meta (los aplica Wabot)

| Tipo | Obligatorio | Límite | Dónde se valida |
|---|---|---|---|
| `text` | `body` | 4096 | `schemas.py`, `limits.text` |
| `image` | `media_id` | pie 1024 · JPEG/PNG · 5 MB | `schemas.py` + `storage.accepts()` |
| `video` | `media_id` | pie 1024 · MP4/3GPP · 16 MB | idem |
| `audio` | `media_id` | sin pie · AAC/MP3/OGG/AMR · 16 MB | idem |
| `document` | `media_id` | pie 1024 · 100 MB | idem |
| `sticker` | `media_id` | WebP · sin pie | idem |
| `buttons` | `body`, `buttons[1..3]` | title 20, id 256 | `Button` |
| `list` | `body`, `list_button` (20), `sections` | 10 filas en total · row title 24 · description 72 · section title 24 | `ListRow`, `ListSection` |
| `cta_url` | `body`, `url`, `url_label` | `url_label` 20 | `MessageContent` |
| `location` | `location{latitude, longitude}` | lat ±90, lng ±180 | `Location` |
| `template` | `template`, `params[]` | nombre en `config/templates.json`; `{{n}}` = nº de params | `templates.py` |
| `reply` | `reply_id`, `reply_title` (72) | solo entrante | `SimulatedInbound` |
| interactivos | `header` 60, `footer` 60 opcionales | | `MessageContent` |

Frontend: los mismos números en `frontend/src/lib/limits.ts`. Si cambias uno, cambia los dos.

`MEDIA_TYPES` (`app/enums.py`) = image, video, audio, document, sticker. `message_type_for(mime)`
(`app/storage.py`) elige el tipo al subir un archivo.

## Dónde se guarda

`messages.type` + `messages.body` (texto o pie) + `messages.content` JSONB con lo específico
(`buttons`, `sections`, `list_button`, `url`, `url_label`, `location`, `template`, `params`,
`reply_id`, `reply_title`, `header`, `footer`) + `media_id`.

## Receta: añadir un tipo (ej. `poll`)

1. **Enum** `MessageType.POLL = "poll"` en `app/enums.py`.
2. **Migración** manual: `op.execute("ALTER TYPE message_type ADD VALUE IF NOT EXISTS 'poll'")`
   (ver `/modelo-bd`).
3. **Schema** en `app/schemas.py`: campos nuevos en `MessageContent` + validación del tipo en el
   validador de modelo (obligatorios y límites de Meta).
4. **Contrato**: fila en la tabla `MessageContent` de `docs/api.md`.
5. **Servicio de envío** (`app/services/messaging.py`): `content.extras()` decide qué va a
   `content`; `preview_for()` el texto de la bandeja; `inbound_body()` si también puede entrar.
6. **Canal**: `SimulatorChannel` lo acepta tal cual; anota el mapeo para Meta en
   `docs/conectar-meta.md`.
7. **IA**: `describe()` en `app/ai/prompt.py` para que el modelo entienda el mensaje en el historial.
8. **Flujos**: funciona solo si hereda de `OutboundContent`; añade ejemplo en `docs/flujos.md`.
9. **Frontend**: `MessageType` y contenido en `lib/types.ts`, límites en `lib/limits.ts`, burbuja en
   `features/chat/bubble/MessageBody.tsx`, formulario en `features/composer/`, vista en `features/simulator/`.
10. **Pruebas**: límite exacto pasa, +1 falla; ida y vuelta por la API.

## ✅ Siempre / ❌ Nunca

- ✅ Si Meta no lo permite, Wabot tampoco (ADR 0003).
- ✅ Validar en Pydantic, no con `if` sueltos en servicios.
- ❌ Columnas nuevas en `messages` para datos de un solo tipo: van en `content`.
- ❌ Aceptar un MIME que Meta rechaza.
