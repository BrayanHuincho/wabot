# 0005 — IA a través de la API compatible con OpenAI

- **Estado:** aceptada
- **Fecha:** 2026-09

## Contexto

Cada usuario tendrá un proveedor distinto: OpenRouter, OpenRouter Perú, OpenAI directo, o un modelo
local con Ollama.

## Decisión

Un solo cliente HTTP (`app/ai/client.py` con httpx) que habla `POST /chat/completions` del
formato de OpenAI. El proveedor solo cambia la URL base y la clave (`PROVIDER_URLS` en
`app/config.py`), con `custom` + `AI_BASE_URL` para cualquier otro.

## Por qué

- Es el formato de facto: lo exponen OpenRouter, Ollama, vLLM, LM Studio, Groq, etc.
- Sin SDKs de proveedor: menos dependencias, mismo código para todos.
- Solo necesitamos completions de texto; no usamos herramientas ni streaming.

## Consecuencias

- Funciones específicas de un proveedor no se aprovechan.
- La derivación a humano se resuelve con un token en el texto (`[[handoff]]`), no con tool calling,
  para que funcione con modelos pequeños locales.

