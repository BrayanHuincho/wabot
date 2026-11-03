# Flujos

Los flujos son las respuestas predecibles: menús, preguntas frecuentes, derivar a un asesor. Viven
en `backend/config/flow.json`, los carga y valida `app/bot/flow.py` (Pydantic) y los ejecuta
`app/bot/engine.py`. Lo que el flujo no resuelve lo responde la IA, si está activa.

## Estructura

```json
{
  "start": "welcome",
  "fallback": "ai",
  "keywords": {
    "menu": "welcome",
    "precios": "prices",
    "hablar con un asesor": "handoff"
  },
  "nodes": {
    "welcome": { "messages": [ { "type": "text", "body": "¡Hola!" } ] }
  }
}
```

| Clave | Qué es |
|---|---|
| `start` | Nodo con el que se saluda en una conversación nueva. |
| `fallback` | Qué hacer cuando nada casa: `"ai"` (defecto; responde la IA si está activa) o `"start"` (vuelve al menú). Sin IA activa siempre se usa `start`. |
| `keywords` | Frase → nodo. Se normalizan (minúsculas, sin tildes) y se buscan como frase dentro del mensaje; si varias casan, gana la más larga. Funcionan desde cualquier punto. |
| `nodes` | Diccionario `id → nodo`. El id se guarda en `conversations.flow_node` (máx. 64 caracteres). |

## Nodo

| Clave | Qué hace |
|---|---|
| `messages` | Lista (mínimo 1) de mensajes a enviar en orden. Cada uno tiene el formato `MessageContent` de [`api.md`](api.md), con los mismos límites de Meta, más `asset`. |
| `routes` | Para botones y listas: `{ "<id de botón o fila>": "<nodo destino>" }`. |
| `next` | Nodo que se envía justo después (encadenar). Se protege contra ciclos. |
| `handoff` | `true`: tras enviar, la conversación pasa a `manual` y se avisa a los asesores. |
| `capture` | Guarda el título del botón o fila que trajo al cliente a este nodo en `contact.attributes.<capture>`. Cualquier `body` puede usarlo como `{capture}`. |

`asset` es una ruta relativa a `backend/config/assets/` (el ejemplo trae `welcome.png` y
`brochure.pdf`). Al usarla, el archivo se importa a `media`
(deduplicado por sha256) y se envía como `media_id`.

## Ejemplos

Menú con botones:

```json
"welcome": {
  "messages": [{
    "type": "buttons",
    "header": "Mi Empresa",
    "body": "¡Hola! 👋 Soy el asistente virtual. ¿En qué te ayudo?",
    "footer": "Elige una opción",
    "buttons": [
      { "id": "services", "title": "Servicios" },
      { "id": "prices", "title": "Precios" },
      { "id": "agent", "title": "Hablar con asesor" }
    ]
  }],
  "routes": { "services": "services", "prices": "prices", "agent": "handoff" }
}
```

Lista (hasta 10 filas en total):

```json
"services": {
  "messages": [{
    "type": "list",
    "body": "Estos son nuestros servicios:",
    "list_button": "Ver servicios",
    "sections": [{
      "title": "Marketing",
      "rows": [
        { "id": "ads", "title": "Publicidad en Meta", "description": "Campañas en Facebook e Instagram" },
        { "id": "seo", "title": "SEO", "description": "Posicionamiento en Google" }
      ]
    }]
  }],
  "routes": { "ads": "ads_info", "seo": "seo_info" }
}
```

Varios mensajes seguidos (documento + botón con enlace):

```json
"prices": {
  "messages": [
    { "type": "document", "asset": "tarifario.pdf", "body": "Te comparto nuestro tarifario 📄" },
    { "type": "cta_url", "body": "También puedes cotizar en línea:",
      "url": "https://example.com/cotizar", "url_label": "Cotizar" }
  ],
  "next": "anything_else"
}
```

Derivar a asesor:

```json
"handoff": {
  "messages": [{ "type": "text", "body": "Listo, un asesor te escribe en unos minutos 🙌" }],
  "handoff": true
}
```

### Guardar respuestas: agendar una reunión

Así se agenda dentro del chat sin mandar al cliente a otra página:

```json
"book_call": {
  "messages": [{ "type": "list", "body": "¿Qué día te acomoda?", "list_button": "Elegir día",
                 "sections": [{ "rows": [{ "id": "day_tue", "title": "Martes" }] }] }],
  "routes": { "day_tue": "book_time" }
},
"book_time": {
  "capture": "booking_day",
  "messages": [{ "type": "buttons", "body": "Perfecto, el *{booking_day}*. ¿A qué hora?",
                 "buttons": [{ "id": "time_10", "title": "10:00 am" }] }],
  "routes": { "time_10": "book_done" }
},
"book_done": {
  "capture": "booking_time",
  "messages": [{ "type": "text", "body": "Quedó agendado para el *{booking_day}* a las *{booking_time}*." }]
}
```

Los valores quedan guardados en `contacts.attributes` y se reutilizan en los siguientes mensajes del flujo.

## Cómo decide el motor (`decide()` en `app/bot/engine.py`)

1. Conversación en `manual` → silencio.
2. Mensaje `reply` (botón o fila) → `routes[reply_id]` del nodo actual; si no está, y `reply_id` es
   el id de un nodo, ese nodo. Si das a cada botón el mismo id que su nodo destino (como hace el
   `flow.json` de ejemplo), no necesitas `routes`.
3. El texto contiene una `keyword` → su nodo.
4. Primer contacto → `start`.
5. IA activa y `fallback: "ai"` → responde la IA ([ia.md](ia.md)).
6. Si no → acción "no entendido": avisa al cliente y vuelve a `start`.

`decide()` es una función pura (no toca BD ni red): se prueba con unitarias sin fixtures.

## Validación

Al arrancar, `Flow.load()` valida con Pydantic: que cada mensaje cumpla los límites de su tipo y que
`start`, `keywords`, `routes` y `next` apunten a nodos existentes. Si falla, el backend no arranca y
el error dice qué falta (`welcome.routes.agent -> handoff`). Mejor eso que descubrirlo con un cliente.

Tras editar `flow.json`, reinicia el backend.
