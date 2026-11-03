# Simulador

El simulador es un **canal** más ([ADR 0004](decisiones/0004-simulador-como-canal.md)): hace de
teléfono del cliente. Permite desarrollar, hacer demos y probar flujos e IA sin cuenta de Meta.

## En el panel

La vista del simulador (`frontend/src/features/simulator/`) muestra un teléfono junto al panel del
asesor:

1. Escribe un número (E.164, ej. `+51924368603`) y un nombre. Cada número es un contacto distinto.
2. Escribe como si fueras el cliente. Puedes:
   - mandar texto, imágenes, audio, documentos, stickers y ubicación;
   - tocar botones y filas de lista que mande el bot (generan un mensaje `reply`);
   - citar un mensaje anterior.
3. Mira a la vez la bandeja: la conversación aparece, el bot responde, y los ticks del lado del
   asesor pasan de enviado a entregado y leído.

## Por API

```bash
curl -X POST http://localhost:8000/api/v1/simulator/messages \
  -H "Content-Type: application/json" \
  -d '{"phone": "+51924368603", "name": "Monica", "type": "text", "body": "hola"}'
```

Respuesta a un botón:

```json
{ "phone": "+51924368603", "type": "reply", "reply_id": "services", "reply_title": "Servicios" }
```

Archivo: primero `POST /api/v1/media` (multipart `file`), luego `{"type": "image", "media_id": "..."}`.

Ubicación:

```json
{ "phone": "+51924368603", "type": "location",
  "location": { "latitude": -12.0464, "longitude": -77.0428, "name": "Plaza Mayor", "address": "Lima" } }
```

## Qué imita y qué no

| Imita | No imita |
|---|---|
| Acuses `delivered` y `read` tras `SIMULATOR_ACK_DELAY_MS` | Fallos reales de red o de Meta |
| Ventana de 24 h (se calcula con `last_inbound_at`) | Aprobación de plantillas por Meta |
| Límites de cada tipo de mensaje | Calidad del número y límites de envío |
| `typing` del bot | Cifrado ni multidispositivo |

Para probar la ventana cerrada, baja `SERVICE_WINDOW_HOURS` o ajusta `last_inbound_at` en la BD de
desarrollo.

## Desactivarlo en producción

Cuando exista el adaptador de Meta, el canal se elegirá por configuración y la ruta
`/simulator/messages` solo se montará con el canal simulador. `GET /health` informa qué canal está
activo.
