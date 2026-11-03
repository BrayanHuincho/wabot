# IA

La IA es opcional. Con `AI_PROVIDER=none` responden solo los flujos. Con un proveedor activo, la IA
contesta lo que el flujo no resuelve.

## Proveedores

Todos se usan con el mismo cliente (`app/ai/client.py`), que habla el protocolo
`POST {base}/chat/completions` de OpenAI. Ver [ADR 0005](decisiones/0005-ia-compatible-openai.md).

| `AI_PROVIDER` | URL base (`PROVIDER_URLS` en `app/config.py`) | ¿Clave? | Ejemplo de `AI_MODEL` |
|---|---|---|---|
| `none` | — | — | — |
| `openrouter` | `https://openrouter.ai/api/v1` | sí | `openai/gpt-4o-mini`, `anthropic/claude-3.5-haiku` |
| `openrouterperu` | `https://openrouterperu.teinor.dev/api/v1` | sí | `openai/gpt-4o-mini` |
| `openai` | `https://api.openai.com/v1` | sí | `gpt-4o-mini` |
| `ollama` | `http://localhost:11434/v1` | no | `llama3.1`, `qwen2.5` |
| `custom` | `AI_BASE_URL` | según servidor | — |

`AI_BASE_URL` sobrescribe la URL de cualquier proveedor (por ejemplo `http://ollama:11434/v1`
dentro de Docker). La IA se considera activa (`ai_enabled`) si hay URL y, salvo Ollama, clave.

## Variables

| Variable | Defecto | Uso |
|---|---|---|
| `AI_PROVIDER` | `none` | Proveedor |
| `AI_BASE_URL` | vacío | Sobrescribe la URL |
| `AI_API_KEY` | vacío | Clave (nunca se loguea) |
| `AI_MODEL` | `openai/gpt-4o-mini` | Modelo |
| `AI_FALLBACK_MODEL` | vacío | Se reintenta una vez con este modelo si el principal falla (red, 5xx, timeout o respuesta vacía) |
| `AI_TIMEOUT_SECONDS` | `45` | Espera máxima por respuesta |
| `AI_TEMPERATURE` | `0.3` | Baja = respuestas consistentes |
| `AI_MAX_TOKENS` | `600` | Tope de la respuesta |
| `AI_HISTORY_SIZE` | `16` | Mensajes previos que se envían como contexto |

Los bloques `<think>…</think>` de modelos de razonamiento (qwen3, gpt-oss) se eliminan del texto.
`GET /api/v1/info` expone `ai_status` (`ok`, `disabled`, `error`) y `GET /api/v1/ai/check` hace una
prueba mínima con el modelo principal.

## Prompt y conocimiento

`load_system_prompt()` en `app/ai/prompt.py` arma el mensaje de sistema al arrancar, uniendo:

1. `backend/config/prompt.md` — **cómo** habla el bot: tono, idioma, qué no debe hacer, cuándo
   derivar.
2. `backend/config/knowledge.md` — **qué** sabe: servicios, precios, horarios, dirección, políticas.
   Se inyecta completo, así que mantenlo corto (unas pocas páginas).

En ambos se reemplaza `{business_name}` por `BUSINESS_NAME`. Cambiarlos requiere reiniciar.

`build_messages()` añade los últimos `AI_HISTORY_SIZE` mensajes (cliente → `user`;
bot/asesor/api → `assistant`). `describe()` convierte adjuntos, botones y ubicaciones a texto
(`[imagen]`, `[documento: x.pdf]`) para que el modelo tenga contexto.

## Derivación: `[[handoff]]`

Si el modelo no sabe responder, detecta enojo o el cliente pide una persona, debe contestar
incluyendo el token `[[handoff]]` (`HANDOFF_TOKEN`). `extract_handoff()` lo detecta y:

1. Quita el token del texto. Si queda texto, lo envía (ej.: "Te paso con un asesor").
2. Pasa la conversación a `manual`.
3. Emite `conversation.handoff` por WebSocket y webhook.

Indícalo en `prompt.md`, por ejemplo:

```markdown
Si el cliente pide hablar con una persona, está molesto, o preguntan algo que no está en el
conocimiento, responde con una frase corta de cortesía y añade [[handoff]] al final.
```

## Guardas

- **Nunca inventar**: el prompt instruye a responder solo con `knowledge.md`; ante la duda, derivar.
- **Tiempo límite** en la petición HTTP; si el proveedor falla o tarda, `ChatClient.complete()`
  devuelve `None`, se registra el error y se responde como "no entendido" (vuelve a `start`). El
  cliente nunca se queda sin respuesta.
- **Formato**: la respuesta pasa por `to_whatsapp()` (`app/formatting.py`), que convierte el
  Markdown que suelen devolver los modelos (`**negrita**`, títulos, tablas, enlaces) a formato de
  WhatsApp.
- **Longitud**: si supera 4096 caracteres (límite de Meta), `split_message()` la parte en varios
  mensajes por párrafos.
- **Modo manual**: la IA nunca responde en conversaciones `manual`.
- **Sin acciones**: la IA solo produce texto. No ejecuta herramientas ni llama a tu sistema.
- **Privacidad**: el historial se envía al proveedor. Si eso no es aceptable, usa Ollama.
- `typing` se emite mientras el modelo piensa, y `TYPING_DELAY_MS` da una pausa mínima natural.

## Probar

Con el simulador abierto, escribe algo fuera del menú ("¿abren los domingos?"). En los logs del
backend verás la llamada al proveedor; `GET /api/v1/info` muestra `ai_enabled` y `ai_model`.
