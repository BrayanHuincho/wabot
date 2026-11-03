# Conectar con Meta WhatsApp Cloud API

> **Roadmap.** Este adaptador todavía no existe. Este documento describe cómo se enchufará para que
> quien lo implemente no toque el núcleo.

Wabot solo usará la **API oficial** de Meta ([ADR 0003](decisiones/0003-solo-api-oficial-de-meta.md)).

## Dónde encaja

Un archivo nuevo, `backend/app/channels/meta.py`, implementa el puerto `Channel` de
`app/channels/base.py`, igual que `simulator.py`. Más un router para el webhook de entrada.

| Pieza | Simulador | Meta |
|---|---|---|
| Enviar | Guarda y programa acuses | `POST https://graph.facebook.com/v21.0/{PHONE_NUMBER_ID}/messages` |
| `external_id` | uuid propio | `wamid.…` devuelto por Meta |
| Entrada | `POST /api/v1/simulator/messages` | `POST /api/v1/channels/meta/webhook` |
| Acuses | Temporizador | Webhook `statuses` |
| Archivos | `media_id` local | Subir a `/{PHONE_NUMBER_ID}/media` o enviar `link` público |

Variables previstas: `CHANNEL=meta`, `META_PHONE_NUMBER_ID`, `META_ACCESS_TOKEN`,
`META_APP_SECRET`, `META_VERIFY_TOKEN`, `META_API_VERSION`.

## Verificación del webhook

Meta hace `GET` con `hub.mode=subscribe`, `hub.verify_token` y `hub.challenge`. Si el token coincide
con `META_VERIFY_TOKEN`, se responde el `hub.challenge` en texto plano con 200; si no, 403.

## Firma de entrada

Cada `POST` de Meta trae `X-Hub-Signature-256: sha256=<hex>`, HMAC-SHA256 del cuerpo crudo con
`META_APP_SECRET`. Se verifica con `hmac.compare_digest` **antes** de parsear. Sin firma válida: 401.

## Mapeo de entrada

| Meta `messages[].type` | `MessageType` | Notas |
|---|---|---|
| `text` | `text` | `text.body` |
| `image`/`video`/`audio`/`document`/`sticker` | igual | Descargar el archivo por su id y guardarlo en `media` |
| `location` | `location` | |
| `interactive.button_reply` | `reply` | `reply_id`, `reply_title` |
| `interactive.list_reply` | `reply` | `reply_id`, `reply_title` |
| `button` (de plantilla) | `reply` | `payload` → `reply_id` |
| `context.id` | `reply_to_id` | Buscar el mensaje por `external_id` |

El `wamid` va a `external_id`: el `UNIQUE` hace que los reenvíos de Meta no dupliquen mensajes.

## Mapeo de estados

| Meta `statuses[].status` | `MessageStatus` | Columna |
|---|---|---|
| `sent` | `sent` | `sent_at` |
| `delivered` | `delivered` | `delivered_at` |
| `read` | `read` | `read_at` |
| `failed` | `failed` | `error` = `errors[0].title` |

Los estados pueden llegar desordenados (un `read` antes que `delivered`): solo se avanza, nunca se
retrocede.

## Ventana de 24 h

Ya está aplicada en el servicio de envío con `last_inbound_at`. Con Meta, fuera de la ventana solo
salen plantillas **aprobadas** en el WhatsApp Manager; `config/templates.json` tendrá que coincidir
con los nombres e idiomas aprobados.

## Salida: tipos

| `MessageType` | Meta |
|---|---|
| `buttons` | `interactive.type=button` |
| `list` | `interactive.type=list` |
| `cta_url` | `interactive.type=cta_url` |
| `template` | `template` con `components` |
| resto | tipo homónimo |

Los límites de [`api.md`](api.md) ya son los de Meta, así que lo que valida Wabot no debería ser
rechazado por Meta por tamaño.

## Checklist del adaptador

- [ ] `channels/meta.py` implementa `Channel` sin importar nada de `services/`.
- [ ] Router de webhook con verificación GET y firma POST.
- [ ] Traductor de entrada → el mismo servicio que usa el simulador.
- [ ] Mapeo de estados con avance monotónico.
- [ ] Token de acceso nunca logueado (`SecretStr`).
- [ ] Pruebas con payloads reales de Meta en `tests/fixtures/`.
- [ ] `/health` reporta `channel: "meta"`.
