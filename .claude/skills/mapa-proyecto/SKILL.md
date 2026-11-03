---
name: mapa-proyecto
description: Mapa de Wabot — dónde vive cada cosa en backend, frontend, config y docs, y qué skill usar para cada tarea. Úsala ANTES de explorar el repo, cuando no sepas en qué archivo está algo o cuando empieces una tarea nueva. Ahorra leer carpetas enteras.
---

# Mapa del proyecto — Wabot

Microservicio de chatbot para WhatsApp. Un mensaje entra por un **canal** (hoy el simulador),
el **motor** decide (flujo → IA → asesor), sale por el **servicio de envío** y todo se refleja en
el **panel** por WebSocket y en tu sistema por **webhooks**.

## Backend (`backend/app/`)

| Archivo / carpeta | Qué tiene | Skill |
|---|---|---|
| `main.py` | App FastAPI, routers, CORS, `/health`, ciclo de vida | `/modulo-backend` |
| `context.py` | `Context` + `build_context()`: cableado de todas las dependencias | `/modulo-backend` |
| `config.py` | `Settings`, `PROVIDER_URLS`, `ai_url`, `ai_enabled` | `/proveedor-ia` |
| `db.py` | Motor async, `Base`, sesiones | `/modelo-bd` |
| `enums.py` | `MessageType`, `MEDIA_TYPES`, `Direction`, `Author`, `MessageStatus`, `ConversationMode`, `ConversationStatus`, `DeliveryStatus` | `/modelo-bd` |
| `models.py` | `Contact`, `Conversation`, `Media`, `Message`, `WebhookDelivery` | `/modelo-bd` |
| `schemas.py` | Pydantic: `MessageContent`, `OutboundContent`, `SendMessageRequest`, `SimulatedInbound`, `*Out` | `/tipos-mensaje` |
| `errors.py` | `AppError` y subclases, handlers | `/modulo-backend` |
| `api/` | `conversations.py`, `messages.py`, `media.py`, `simulator.py`, `system.py` (`/health`, `/info`, `/templates`), `ws.py`, `deps.py` (`CtxDep`, `SessionDep`, `require_api_key`) | `/modulo-backend`, `/api-publica` |
| `services/messaging.py` | `record_inbound`, `send`, `ensure_sendable`, `dispatch`, `apply_status`, `advance`, `history`, `preview_for` | `/modulo-backend` |
| `services/conversations.py` | `upsert_contact`, `open_conversation`, `switch_mode`, `hand_off`, `close`, `mark_read`, `list_conversations` | `/modulo-backend` |
| `services/bot.py` | `handle_inbound`, `run_bot`, `play_node`, `materialize`, `answer_with_ai` | `/motor-flujos` |
| `bot/flow.py` · `bot/engine.py` · `bot/text.py` | `Flow`, `decide()`, `normalize()` | `/motor-flujos` |
| `ai/client.py` · `ai/prompt.py` | `ChatClient`, `HANDOFF_TOKEN`, `build_messages()` | `/proveedor-ia` |
| `channels/base.py` · `channels/simulator.py` | Puerto `Channel`, `SimulatorChannel` | `/canal-whatsapp` |
| `realtime.py` | `Hub` del WebSocket | `/api-publica` |
| `webhooks.py` | Outbox: `enqueue`, `sign`, `backoff`, entregador | `/api-publica` |
| `tasks.py` | `TaskRegistry` (`spawn`, `drain`) | `/modulo-backend` |
| `storage.py` | `MediaStore`, `accepts()`, `message_type_for()` | `/tipos-mensaje` |
| `formatting.py` | `to_whatsapp()`, `split_message()` | `/formato-whatsapp` |
| `templates.py` | `TemplateCatalog` de `config/templates.json` | `/tipos-mensaje` |

Otros: `backend/config/` (`flow.json`, `prompt.md`, `knowledge.md`, `templates.json`,
`assets/brochure.pdf`, `assets/welcome.png`), `backend/migrations/` + `alembic.ini`,
`backend/tests/` (`conftest.py`, `test_bot.py`, `test_messaging.py`, `test_schemas.py`,
`test_formatting.py`, `test_media.py`, `test_webhooks.py`).

## Frontend (`frontend/src/`)

| Ruta | Qué tiene | Skill |
|---|---|---|
| `app/` | `App.tsx`, `providers.tsx`, `store.ts` (zustand), `useRealtime.ts` | `/feature-frontend` |
| `lib/api.ts` · `queries.ts` · `cache.ts` | Cliente HTTP, hooks de TanStack Query, mutación de caché | `/feature-frontend` |
| `lib/types.ts` · `limits.ts` | Tipos del contrato y límites de Meta | `/tipos-mensaje` |
| `lib/whatsapp.tsx` | `formatWhatsApp()`, `stripWhatsApp()` | `/formato-whatsapp` |
| `components/` | Avatar, Button, Icon, Modal, Sheet, Skeleton, Toasts, Toggle | `/diseno-whatsapp` |
| `features/inbox/` | `ConversationList.tsx` | `/feature-frontend` |
| `features/chat/` | `ChatPanel`, `ChatHeader`, `MessageList`, `TypingBubble`, `bubble/` (`Bubble`, `MessageBody`, `AudioPlayer`, `Lightbox`, `ListSheet`) | `/diseno-whatsapp` |
| `features/composer/` | `AttachMenu`, `EmojiPicker`, `UploadPreview`, `useRecorder` | `/feature-frontend` |
| `features/simulator/` · `features/templates/` | Teléfono simulado · selector de plantillas | `/canal-whatsapp` |
| `styles/tokens.css` | Variables de diseño (`--wa-*`, `--brand`…) | `/diseno-whatsapp` |

## Docs

`docs/api.md` (contrato — manda), `arquitectura.md`, `base-de-datos.md`, `flujos.md`, `ia.md`,
`webhooks.md`, `simulador.md`, `despliegue.md`, `conectar-meta.md`, `decisiones/000X-*.md`.

## ✅ Siempre / ❌ Nunca

- ✅ Buscar con `grep -n "def nombre" backend/app -r` antes de abrir archivos.
- ✅ Leer un modelo con `sed -n '/^class Message/,/^class /p' backend/app/models.py`.
- ❌ Listar o leer `.venv/`, `node_modules/`, `dist/`, `data/`, `*.egg-info/`.
- ❌ Leer `package-lock.json` o `.env`.
