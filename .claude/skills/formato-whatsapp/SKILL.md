---
name: formato-whatsapp
description: Formato de texto de WhatsApp en Wabot — sintaxis (*negrita*, _cursiva_, ~tachado~, ```mono```), conversión de Markdown de la IA con to_whatsapp(), partición con split_message() y render en el panel con formatWhatsApp(). Úsala ANTES de escribir textos de flujos o prompts, tocar app/formatting.py o lib/whatsapp.tsx, o cuando un mensaje se vea con asteriscos dobles, títulos # o tablas rotas.
---

# Formato WhatsApp

## Sintaxis

| Efecto | WhatsApp | ❌ Markdown (no funciona) |
|---|---|---|
| Negrita | `*texto*` | `**texto**` |
| Cursiva | `_texto_` | `*texto*` |
| Tachado | `~texto~` | `~~texto~~` |
| Monoespaciado | ```` ```texto``` ```` | `` `texto` `` |
| Lista | `• item` o `1. item` | `- item` funciona a medias |
| Enlace | URL desnuda `https://…` | `[texto](url)` |
| Título | `*TÍTULO*` en su línea | `# Título` |
| Tabla | no existe: líneas `a · b · c` | `\| a \| b \|` |

Saltos de línea `\n` sí funcionan. Máximo 4096 caracteres por mensaje de texto.

## Backend: `app/formatting.py`

| Función | Hace |
|---|---|
| `to_whatsapp(markdown)` | `**x**`/`__x__` → `*x*`, `# T` → `*T*`, `~~x~~` → `~x~`, `[t](u)` → `t (u)`, `![](u)` → `u`, viñetas → `•`, tablas → `a · b`, quita `---`, colapsa saltos triples |
| `split_message(text, limit=4096)` | Parte por párrafos (`\n\n`); si un párrafo no cabe, corta en el último espacio |

Se aplica a toda respuesta de la IA antes de enviarla. Los textos de `flow.json` y las plantillas se
escriben ya en formato WhatsApp.

## Frontend: `src/lib/whatsapp.tsx`

| Función | Hace |
|---|---|
| `formatWhatsApp(text, term?)` | Devuelve nodos React: `<strong>`, `<em>`, `<s>`, `<code>`, enlaces `target=_blank rel=noreferrer`; resalta `term` de búsqueda con `<mark>` |
| `stripWhatsApp(text)` | Quita marcas para la vista previa de la bandeja |

Nunca `dangerouslySetInnerHTML`. El texto del cliente es dato.

## Escribir para WhatsApp

- Mensajes cortos: 1–3 frases. Si hay más, varios mensajes (`messages[]` del nodo).
- Negrita solo para lo que el cliente debe ver primero (precio, hora, acción).
- Emojis con moderación (0–2 por mensaje) y con sentido.
- Nada de "Estimado cliente": tono de conversación.

## Pruebas

Al tocar `formatting.py`, añade casos en `backend/tests/` para: negrita doble, títulos, tablas con
separador, enlaces, texto de exactamente 4096 y 4097 caracteres.

## ✅ Siempre / ❌ Nunca

- ✅ Pasar la salida de la IA por `to_whatsapp()` y `split_message()`.
- ❌ Truncar en silencio un mensaje largo.
- ❌ Duplicar el parser en otro componente: usa `formatWhatsApp`.
