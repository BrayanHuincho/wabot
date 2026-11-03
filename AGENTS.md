# Reglas del Proyecto — Wabot

Microservicio de chatbot para WhatsApp con panel de asesor, flujos, IA opcional, API y webhooks.
La IA debe seguir estas instrucciones al programar en este directorio.

1. **Stack:** FastAPI + SQLAlchemy 2 async + Alembic + PostgreSQL 16 en `backend/`; React 19 + Vite +
   TypeScript + CSS Modules en `frontend/`.
2. **Contrato:** `docs/api.md` es la fuente de verdad de la API. Backend y frontend lo siguen; si
   cambia, se actualiza en el mismo commit.
3. **Arquitectura:** hexagonal. El núcleo (`app/services/`, `app/bot/`) habla con puertos
   (`app/channels/base.py`, `app/ai/client.py`, `app/storage.py`), nunca con implementaciones.
4. **Base de datos:** tablas y columnas en inglés snake_case. Todo cambio con migración nueva de
   Alembic.
5. **Estilo:** código limpio, máximo 1–2 comentarios por archivo, identificadores en inglés, UI y
   documentación en español. Nada de boilerplate con pinta de generado.
6. **WhatsApp:** solo API oficial de Meta. Límites y ventana de 24 h se aplican en el backend.
7. **Contexto:** no leer todo el proyecto. Usa `.claude/skills/` (índice en `CLAUDE.md`) y las
   reglas detalladas de `.agents/rules/`.
