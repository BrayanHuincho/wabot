# Arquitectura

Wabot es un monolito pequeño con forma **hexagonal**: un núcleo de casos de uso que no sabe con qué
canal, qué proveedor de IA ni qué almacenamiento está hablando. Esas piezas entran por puertos.

```
               ┌───────────────────────── backend ─────────────────────────┐
 Panel React ──┤ app/api/  (REST /api/v1 + WS /ws)                         │
 Tu sistema ───┤        │                                                  │
               │        ▼                                                  │
               │ app/services/  ◄── casos de uso (recibir, enviar, ...)    │
               │   │      │      │          │                │           │
               │   ▼      ▼      ▼          ▼                ▼           │
               │ bot/   ai/   storage.py  realtime.py    webhooks.py      │
               │ engine client (puerto)   (WebSocket)    (outbox)         │
               │   │                                                       │
               │   ▼                                                       │
               │ channels/base.py  ◄── puerto Channel                      │
               │   ├── simulator.py   (hoy)                                │
               │   └── meta.py        (roadmap)                            │
               └──────────────────────────┬────────────────────────────────┘
                                          ▼
                                    PostgreSQL 16
```

## Puertos

| Puerto | Archivo | Implementaciones | Qué abstrae |
|---|---|---|---|
| `Channel` (`Protocol`) | `app/channels/base.py` | `SimulatorChannel` en `simulator.py` (hoy), `meta.py` (roadmap) | `deliver(message, to) -> external_id` y `bind(on_status)` para recibir acuses |
| IA | `app/ai/client.py` | `ChatClient` (httpx) | `complete(messages) -> str \| None` contra cualquier `/chat/completions` |
| Storage | `app/storage.py` | `MediaStore` en disco local (`MEDIA_DIR`) | `save()`, `import_asset()`, `path_for(media)` |

Todas las implementaciones se cablean en un solo sitio: `build_context()` en `app/context.py`,
que arma el `Context` (settings, sesiones, hub, canal, store, flujo, plantillas, IA). Cambiar el simulador por Meta, o el disco por S3, es escribir otra implementación del puerto. Nada
en `services/` o `bot/` debería cambiar. Ver [ADR 0004](decisiones/0004-simulador-como-canal.md).

## Módulos

| Ruta | Responsabilidad |
|---|---|
| `app/context.py` | `Context` y `build_context()`: composición de dependencias |
| `app/main.py` | Crea la app, monta routers, CORS, `/health`, arranca tareas de fondo |
| `app/config.py` | `Settings` (pydantic-settings) leído de `.env` |
| `app/db.py` | Motor async, `Base`, dependencia de sesión |
| `app/models.py` / `app/enums.py` | Modelo de datos ([base-de-datos.md](base-de-datos.md)) |
| `app/schemas.py` | Pydantic de entrada/salida; refleja `docs/api.md` |
| `app/errors.py` | `AppError` con `code` y handler que produce `{"error": {code, message}}` |
| `app/api/` | Routers delgados (`conversations`, `messages`, `media`, `simulator`, `system`, `ws`); `deps.py` da `CtxDep`, `SessionDep`, `require_api_key` |
| `app/services/messaging.py` | Entrada (`record_inbound`), envío (`send`, `ensure_sendable`, `dispatch`), acuses (`apply_status`, `advance`) |
| `app/services/conversations.py` | Contactos, apertura/cierre, modo, derivación (`hand_off`), leídos |
| `app/services/bot.py` | `handle_inbound` → `run_bot`: ejecuta la decisión del motor |
| `app/bot/flow.py` | `Flow.load()` carga y valida `config/flow.json` |
| `app/bot/text.py` | `normalize()` y `contains_phrase()` para casar palabras clave |
| `app/bot/engine.py` | Dado un mensaje entrante, decide la respuesta (flujo → IA → derivación) |
| `app/ai/` | Cliente OpenAI-compatible y armado del prompt |
| `app/channels/` | Puerto `Channel` y simulador |
| `app/realtime.py` | Hub de WebSocket: difunde eventos al panel |
| `app/webhooks.py` | Encola eventos en `webhook_deliveries` y los entrega firmados |
| `app/tasks.py` | Tareas de fondo (respuesta del bot, entrega del outbox, acuses del simulador) |
| `app/formatting.py` | Formato de WhatsApp (`*negrita*`, `_cursiva_`…) y recorte de vistas previas |
| `app/templates.py` | Carga `config/templates.json` y rellena parámetros |
| `app/storage.py` | Almacenamiento de archivos |

## Mensaje entrante, paso a paso

Ejemplo: el cliente escribe "hola" desde el simulador.

1. **Entrada.** El simulador hace `POST /api/v1/simulator/messages`
   `{phone, name, type: "text", body: "hola"}`. Con Meta sería su webhook; el adaptador lo
   traduce al mismo formato interno.
2. **Contacto.** El servicio busca el contacto por `phone` (E.164) o lo crea.
3. **Conversación.** Busca la conversación `open` del contacto; si no hay, crea una en modo `auto`.
   El índice único parcial garantiza que nunca haya dos abiertas, incluso con peticiones
   concurrentes.
4. **Idempotencia.** Si el mensaje trae `external_id` y ya existe, se ignora (Meta reenvía
   webhooks). La restricción `UNIQUE` es la última barrera.
5. **Persistencia.** Inserta `Message` (`direction=inbound`, `author=contact`, `status=received`).
   Actualiza `last_inbound_at` (abre la ventana de 24 h), `last_message_at`, `preview` y suma
   `unread_count`. Todo en una transacción.
6. **Eventos.** Tras el commit: WebSocket `message.created` + `conversation.updated`; outbox
   `message.received`.
7. **Bot.** Si la conversación está en `auto`, se lanza la respuesta del bot con
   `TaskRegistry.spawn()` (`tasks.py`), sin bloquear la petición. `decide()` en `bot/engine.py`
   (función pura) devuelve una `Decision`:
   1. `reply` a botón/lista → `routes` del nodo actual; o una `keyword`; o `start` si es el primer
      contacto → acción `node`: envía los `messages` del nodo (y su cadena `next`) y guarda
      `flow_node`.
   2. Si no, IA activa y `fallback: "ai"` → acción `ai`: emite `typing` y pide la respuesta al
      modelo con `prompt.md` + `knowledge.md` + historial.
   3. Si la IA incluye `[[handoff]]`, o el nodo tiene `handoff: true` → la conversación pasa a
      `manual` y se emite `conversation.handoff`.
   4. Si nada aplica → `not_understood`: aviso y vuelta a `start`.
8. **Salida.** Cada respuesta del bot va por el mismo servicio de envío que usa un asesor (abajo).

## Mensaje saliente y estados

Origen posible: asesor (`POST /conversations/{id}/messages`, `author=agent`), sistema externo
(`POST /messages`, `author=api`) o bot (`author=bot`).

1. **Validación** de contenido con los límites de Meta (`schemas.py`). Error `422 invalid_message`.
2. **Ventana de 24 h.** Si `now - last_inbound_at > SERVICE_WINDOW_HOURS` y el tipo no es
   `template` → `409 window_closed`. Conversación cerrada → `409 conversation_closed`.
3. **Modo.** Si escribe un asesor, la conversación pasa a `manual` (el bot deja de responder).
4. **Persistencia** con `status=pending` y eventos `message.created`.
5. **Canal.** `channel.deliver(message, to)` devuelve el `external_id`. Se guarda y el estado pasa a `sent`
   (`sent_at`). Si falla → `failed` con `error`.
6. **Acuses.** El canal llama al callback registrado con `bind(on_status)` con `(external_id, status)` (el simulador lo hace a los
   `SIMULATOR_ACK_DELAY_MS`; Meta, por webhook). Cada acuse actualiza el estado **solo hacia
   adelante** (`sent → delivered → read`), rellena su timestamp y emite `message.status`.

```
pending ──► sent ──► delivered ──► read
   └──────────┴──► failed
```

## Tiempo real

`app/realtime.py` mantiene las conexiones de `WS /ws` (clave en `?key=`). Los servicios publican
eventos **después del commit**, nunca antes: si la transacción falla, el panel no ve fantasmas.
Eventos: `message.created`, `message.status`, `conversation.updated`, `typing`. Es un hub en memoria
de un solo proceso; para varias réplicas haría falta un bus (Redis pub/sub o `LISTEN/NOTIFY`).

## Outbox de webhooks

Los webhooks no se envían en línea. Cada evento se inserta en `webhook_deliveries` **en la misma
transacción** que el cambio que lo origina. Un bucle en `tasks.py` toma las filas `pending` con
`next_attempt_at <= now()`, firma el cuerpo con HMAC-SHA256 y hace el POST. Si falla, suma
`attempts` y reprograma con espera exponencial; al llegar a `WEBHOOK_MAX_ATTEMPTS` queda `failed`.
Por qué: [ADR 0006](decisiones/0006-outbox-para-webhooks.md).

## Decisiones

Ver [`decisiones/`](decisiones/).
