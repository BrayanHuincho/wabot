---
name: canal-whatsapp
description: Puerto Channel de Wabot y sus implementaciones — el simulador actual (SimulatorChannel) y el futuro adaptador de Meta WhatsApp Cloud API (webhook verify token, firma X-Hub-Signature-256, mapeo de estados, ventana de 24 h). Úsala ANTES de tocar app/channels/, el endpoint /simulator/messages, los acuses de estado o empezar el adaptador de Meta.
---

# Canal WhatsApp

## El puerto (`app/channels/base.py`)

```python
StatusCallback = Callable[[str, MessageStatus], Awaitable[None]]

class Channel(Protocol):
    name: str
    def bind(self, on_status: StatusCallback) -> None: ...
    async def deliver(self, message: Message, to: str) -> str: ...   # devuelve external_id
```

- `deliver()` recibe el `Message` ya persistido (`pending`) y el teléfono E.164; devuelve el id del
  proveedor, que se guarda en `messages.external_id`. Si lanza, el servicio marca `failed`.
- `bind()` registra el callback que el servicio usa para aplicar acuses
  (`external_id, delivered|read|failed`). Avance monotónico: nunca retroceder.
- Se instancia **solo** en `build_context()` (`app/context.py`).

## Simulador (`app/channels/simulator.py`)

`SimulatorChannel(tasks, ack_delay_ms)`:

- `deliver()` genera `sim.<hex>` y programa `_acknowledge()` con `TaskRegistry.spawn`.
- `_acknowledge()` espera `SIMULATOR_ACK_DELAY_MS` y emite `delivered`, luego otra vez y `read`.
- La **entrada** del cliente simulado es `POST /api/v1/simulator/messages`
  (`SimulatedInbound`: `phone`, `name`, `type`, `body`, `media_id`, `reply_id`, `reply_title`,
  `location`, `reply_to_id`) → `bot.handle_inbound()` → `messaging.record_inbound()`, el mismo
  camino que usará Meta. Acuses → `messaging.apply_status()`.
- Frontend: `src/features/simulator/` + `useSimulate()`.
- Docs: `docs/simulador.md`, ADR 0004.

## Adaptador de Meta (roadmap)

Plan completo: `docs/conectar-meta.md`. Resumen:

| Pieza | Qué hacer |
|---|---|
| `app/channels/meta.py` | `MetaChannel` con `httpx.AsyncClient`; `deliver()` → `POST /{PHONE_NUMBER_ID}/messages`, devuelve `messages[0].id` (wamid) |
| Router webhook | `GET` verify: `hub.mode == "subscribe"` y `hub.verify_token == META_VERIFY_TOKEN` → `hub.challenge`; si no 403 |
| Firma | `X-Hub-Signature-256` = HMAC-SHA256(cuerpo crudo, `META_APP_SECRET`); `hmac.compare_digest`; si falla 401 |
| Entrada | `messages[]` → mismo servicio que el simulador; `wamid` → `external_id` (idempotencia) |
| Estados | `statuses[]`: `sent/delivered/read/failed` → callback de `bind()` |
| Media | Descargar por id con el token y guardar en `MediaStore` |
| Ventana 24 h | Ya aplicada en el servicio de envío; fuera solo `template` aprobada |
| Selección | `CHANNEL=simulator\|meta` en `Settings`; `build_context()` elige |

## Checklist para un canal nuevo

- [ ] Implementa `Channel` sin importar `app/services/`.
- [ ] Ningún `if channel.name == ...` fuera de `app/channels/` y `context.py`.
- [ ] Traduce entrada al formato de `SimulatedInbound`/servicio de entrada.
- [ ] Estados por `bind()`, monotónicos.
- [ ] Secretos `SecretStr`, nunca en logs.
- [ ] Pruebas con payloads reales en fixtures y `httpx.MockTransport`.
- [ ] `/health` y `/info` muestran `channel`.

## ✅ Siempre / ❌ Nunca

- ✅ Solo API oficial de Meta (ADR 0003).
- ❌ Llamar a `channel.deliver()` fuera del servicio de envío.
- ❌ Lógica de simulador en `services/` o `bot/`.
