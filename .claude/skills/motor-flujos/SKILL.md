---
name: motor-flujos
description: Motor de flujos de Wabot — formato de backend/config/flow.json (start, fallback, keywords, nodes con messages/routes/next/handoff), validación con Pydantic y la función pura decide() de app/bot/engine.py. Úsala ANTES de editar flow.json, cambiar cómo el bot elige respuesta o añadir una capacidad nueva a los nodos.
---

# Motor de flujos

| Archivo | Rol |
|---|---|
| `backend/config/flow.json` | Datos del flujo |
| `backend/config/assets/` | Archivos referenciados con `asset` |
| `app/bot/flow.py` | `FlowMessage`, `Node`, `Flow` (Pydantic), `Flow.load()`, `Flow.chain()` |
| `app/bot/engine.py` | `Action`, `Decision`, `route_reply()`, `match_keyword()`, `decide()` |
| `app/bot/text.py` | `normalize()` (minúsculas, sin tildes), `contains_phrase()` |

Documentación de usuario: `docs/flujos.md`.

## Formato

```json
{
  "start": "welcome",
  "fallback": "ai",
  "keywords": { "menu": "welcome", "asesor": "handoff" },
  "nodes": {
    "welcome": {
      "messages": [{ "type": "buttons", "body": "¿En qué te ayudo?",
        "buttons": [{ "id": "prices", "title": "Precios" }] }],
      "routes": { "prices": "prices" }
    },
    "prices": {
      "messages": [{ "type": "document", "asset": "tarifario.pdf", "body": "Tarifario" }],
      "next": "anything_else"
    },
    "handoff": { "messages": [{ "type": "text", "body": "Te paso con un asesor." }], "handoff": true }
  }
}
```

| Campo | Tipo | Nota |
|---|---|---|
| `start` | id | Primer contacto y destino de "no entendido" |
| `fallback` | `"ai"` \| `"start"` | `"ai"` solo actúa si la IA está activa |
| `keywords` | frase → id | Se normalizan; gana la frase más larga que aparezca |
| `node.messages` | `FlowMessage[]` (≥1) | `OutboundContent` + `asset` |
| `node.routes` | id opción → id nodo | Para `reply` de botones/listas |
| `node.next` | id | Encadena; `chain()` corta ciclos |
| `node.handoff` | bool | Pasa a `manual` tras enviar |

## Orden de decisión (`decide`)

1. `mode == manual` → `Action.NONE`.
2. `type == reply` → `route_reply()`: `routes` del nodo actual o, si `reply_id` es un nodo, ese.
3. `match_keyword()` sobre `body`.
4. `first_contact` → `start`.
5. `ai_enabled and fallback == "ai"` → `Action.AI`.
6. `Action.NOT_UNDERSTOOD` con `start`.

`decide()` es **pura**: recibe `Flow`, `Conversation`, `Message` y flags; no toca BD ni red.
`run_bot()` en `app/services/bot.py` ejecuta la `Decision`: `play_node()` (envía la cadena de
`messages`; `materialize()` convierte `asset` en `media_id`; guarda `flow_node`; `hand_off()` si
toca), `answer_with_ai()` o `say()` para el no entendido. Mantén esa separación.

## Receta: capacidad nueva en nodos (ej. guardar un atributo)

1. Campo en `Node` (`flow.py`) con default, para no romper flujos existentes.
2. Validación en `check_targets` si apunta a otros nodos.
3. Ejecución en `play_node()` (`app/services/bot.py`), no en `decide()`.
4. Prueba unitaria de `decide()` y prueba del servicio.
5. Documentar en `docs/flujos.md` con ejemplo.

## ✅ Siempre / ❌ Nunca

- ✅ Ids de nodo en snake_case inglés, ≤ 64 caracteres (`flow_node`).
- ✅ Respetar límites de Meta en cada mensaje (los valida Pydantic al arrancar).
- ✅ Reiniciar el backend tras editar `flow.json`.
- ❌ Lógica de BD o HTTP en `engine.py`.
- ❌ Ids de botón repetidos dentro de un mismo nodo.
