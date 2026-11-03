# 0006 — Outbox para los webhooks salientes

- **Estado:** aceptada
- **Fecha:** 2026-09

## Contexto

Si al recibir un mensaje hacemos el POST al sistema del cliente en la misma petición: si su servidor
está caído el evento se pierde; si es lento, frena al bot; y si el POST sale pero la transacción
hace rollback, avisamos de algo que no existe.

## Decisión

**Patrón outbox transaccional.** Cada evento se inserta en `webhook_deliveries` en la misma
transacción que el cambio que lo genera. Un trabajador en segundo plano (`app/tasks.py` +
`app/webhooks.py`) entrega lo pendiente, firma con HMAC-SHA256 y reintenta con espera exponencial
hasta `WEBHOOK_MAX_ATTEMPTS`.

## Consecuencias

- Ningún evento se pierde ni se inventa: existe si y solo si el cambio se confirmó.
- Entrega **al menos una vez**: el receptor debe deduplicar por `X-Wabot-Delivery`.
- Sin dependencia extra (Redis, colas): la propia BD es la cola, con un índice parcial sobre lo
  pendiente.
- La tabla crece; conviene purgar periódicamente las filas `delivered` antiguas.

