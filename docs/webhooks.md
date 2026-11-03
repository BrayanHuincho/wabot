# Webhooks salientes

Wabot avisa a tu sistema de lo que pasa en las conversaciones con un `POST` firmado.

## Configuración

```env
WEBHOOK_URL=https://mi-sistema.com/wabot
WEBHOOK_SECRET=una-cadena-larga-y-aleatoria
WEBHOOK_MAX_ATTEMPTS=6
```

Sin `WEBHOOK_URL` no se encola nada.

## Petición

```
POST <WEBHOOK_URL>
Content-Type: application/json
X-Wabot-Event: message.received
X-Wabot-Delivery: 3f0c...-uuid
X-Wabot-Signature: sha256=<hex>
```

```json
{
  "id": "3f0c...-uuid",
  "event": "message.received",
  "created_at": "2026-09-28T16:00:00+00:00",
  "data": { "message": { "...": "Message" }, "conversation": { "...": "Conversation" } }
}
```

## Eventos

| Evento | Cuándo | `data` |
|---|---|---|
| `message.received` | Llega un mensaje del cliente | `{message, conversation}` |
| `message.sent` | Sale un mensaje (bot, asesor o API) | `{message, conversation}` |
| `message.status` | Cambia a `delivered`, `read` o `failed` | `{id, conversation_id, status, delivered_at, read_at}` |
| `conversation.handoff` | El bot deriva a un asesor | `Conversation` |
| `conversation.closed` | Se cierra una conversación | `Conversation` |

Los objetos son los de [`api.md`](api.md).

## Entrega y reintentos

- Patrón outbox ([ADR 0006](decisiones/0006-outbox-para-webhooks.md)): el evento se guarda en
  `webhook_deliveries` en la misma transacción que lo provoca. Si tu sistema está caído, nada se
  pierde.
- Éxito = cualquier `2xx`. Cualquier otra cosa (o timeout) se reintenta con espera exponencial
  (`backoff()` en `app/webhooks.py`: 5 s, 10 s, 20 s, 40 s… con tope de 1 h) hasta
  `WEBHOOK_MAX_ATTEMPTS`; después queda `failed` con `last_error`.
- `id` del cuerpo y `X-Wabot-Delivery` son el mismo uuid (la fila de `webhook_deliveries`).
- **Entrega al menos una vez**: puedes recibir el mismo evento dos veces. Usa `X-Wabot-Delivery`
  como clave de idempotencia.
- El orden no está garantizado entre reintentos; usa los timestamps del payload.

## Verificar la firma

`X-Wabot-Signature` es `sha256=` + HMAC-SHA256 en hex del **cuerpo crudo** con `WEBHOOK_SECRET`.
Calcula el HMAC sobre los bytes recibidos, no sobre el JSON reserializado, y compara en tiempo
constante.

### Node

```js
import crypto from "node:crypto";

export function verify(rawBody, header, secret) {
  const expected = "sha256=" + crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const given = header ?? "";
  return given.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}
```

Con Express usa `express.raw({ type: "application/json" })` en esa ruta para tener el cuerpo crudo.

### PHP

```php
<?php
function wabot_verify(string $raw, string $header, string $secret): bool {
    return hash_equals('sha256=' . hash_hmac('sha256', $raw, $secret), $header);
}

$raw = file_get_contents('php://input');
if (!wabot_verify($raw, $_SERVER['HTTP_X_WABOT_SIGNATURE'] ?? '', getenv('WABOT_SECRET'))) {
    http_response_code(401);
    exit;
}
```

En Laravel: `$request->getContent()` y `$request->header('X-Wabot-Signature')`.

### Python

```python
import hashlib
import hmac


def verify(raw: bytes, header: str, secret: str) -> bool:
    expected = "sha256=" + hmac.new(secret.encode(), raw, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, header or "")
```

## Buenas prácticas del receptor

1. Verifica la firma antes de nada.
2. Responde `2xx` en menos de unos segundos; procesa en una cola propia.
3. Descarta duplicados por `X-Wabot-Delivery`.
4. Usa HTTPS.
