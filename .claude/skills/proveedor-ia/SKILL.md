---
name: proveedor-ia
description: IA de Wabot — proveedores OpenAI-compatibles (OpenRouter, OpenRouter Perú, OpenAI, Ollama, custom), variables AI_*, prompt.md y knowledge.md, token [[handoff]], formato y guardas. Úsala ANTES de cambiar app/ai/, añadir un proveedor, ajustar el prompt o depurar por qué el bot responde mal o no responde.
---

# Proveedor de IA

| Archivo | Rol |
|---|---|
| `app/config.py` | `AIProvider`, `PROVIDER_URLS`, `Settings.ai_url`, `Settings.ai_enabled` |
| `app/ai/client.py` | `ChatClient(settings, transport)`, `ChatMessage`, `complete(messages) -> str \| None` |
| `app/ai/prompt.py` | `HANDOFF_TOKEN`, `load_system_prompt()`, `describe()`, `build_messages()`, `extract_handoff()` |
| `app/formatting.py` | `to_whatsapp()` y `split_message()` sobre la respuesta |
| `backend/config/prompt.md` | Cómo habla el bot |
| `backend/config/knowledge.md` | Qué sabe el bot |

Docs: `docs/ia.md`. Decisión: `docs/decisiones/0005-ia-compatible-openai.md`.

## Proveedores

| `AI_PROVIDER` | URL | Clave |
|---|---|---|
| `openrouter` | `https://openrouter.ai/api/v1` | sí |
| `openrouterperu` | `https://openrouterperu.teinor.dev/api/v1` | sí |
| `openai` | `https://api.openai.com/v1` | sí |
| `ollama` | `http://localhost:11434/v1` | no |
| `custom` | `AI_BASE_URL` | opcional |
| `none` | — | IA apagada |

`AI_BASE_URL` siempre sobrescribe. `ai_enabled` = proveedor ≠ none, hay URL y (Ollama o clave).

## Receta: proveedor nuevo

1. Si habla `/chat/completions`: añade el literal a `AIProvider` y su URL a `PROVIDER_URLS`. Fin.
2. Si necesita cabeceras extra: en `ChatClient._headers()`, condicionado al proveedor.
3. Si **no** es compatible con OpenAI: no. Usa un proxy compatible (LiteLLM) con `custom`.
4. Documenta en `docs/ia.md`, `README.md` y `backend/.env.example`.

## Flujo de una respuesta

`decide()` → `Action.AI` → `typing` → `build_messages(system_prompt, history[-AI_HISTORY_SIZE:])`
→ `ai.complete()` → `None`? "no entendido" → `extract_handoff()` → `to_whatsapp()` →
`split_message()` → servicio de envío (`author=bot`) → si handoff: `mode=manual` +
`conversation.handoff`.

## Guardas

- Nunca responde en `manual`.
- Fallo/timeout → `None`, se registra y se responde como no entendido. Nunca excepción al cliente.
- La IA solo produce texto; nada de tool calling.
- El prompt instruye a no inventar y a usar `[[handoff]]` ante duda, enojo o petición de humano.
- Claves `SecretStr`; jamás en logs.

## Pruebas

```python
def handler(request: httpx.Request) -> httpx.Response:
    return httpx.Response(200, json={"choices": [{"message": {"content": "Hola [[handoff]]"}}]})

ctx = build_context(settings, sessions, ai_transport=httpx.MockTransport(handler))
```

## ✅ Siempre / ❌ Nunca

- ✅ Cambios de tono/datos en `prompt.md`/`knowledge.md`, no en código.
- ✅ `temperature` baja para atención al cliente.
- ❌ SDKs de proveedor (`openai`, `anthropic`): solo httpx.
- ❌ Red real en pruebas. ❌ Loguear el historial completo.
