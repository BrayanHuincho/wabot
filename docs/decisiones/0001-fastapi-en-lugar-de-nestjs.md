# 0001 — FastAPI en lugar de NestJS

- **Estado:** aceptada
- **Fecha:** 2026-09

## Contexto

Wabot es un microservicio pequeño cuyo trabajo pesado es I/O: recibir mensajes, llamar a un LLM,
llamar a un canal, empujar eventos por WebSocket. El ecosistema de IA (clientes, ejemplos, Ollama)
es más natural en Python. El proyecto hermano (un CRM) usa NestJS.

## Decisión

Backend en **Python 3.12 + FastAPI**, con Pydantic v2 para validar el contrato y SQLAlchemy 2 async.

## Consecuencias

- Swagger gratis en `/docs` a partir de los esquemas de `app/schemas.py`.
- `async` de punta a punta (asyncpg, httpx): una sola instancia aguanta muchas conversaciones.
- Menos ceremonia que NestJS (sin módulos/decoradores de DI); la estructura la imponen las reglas de
  `.agents/rules/02-backend.md`.
- No se comparten tipos con el frontend por generación automática: el contrato es `docs/api.md` y
  `frontend/src/lib/types.ts` lo refleja a mano.

