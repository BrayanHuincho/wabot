# Wabot — Instrucciones para Claude Code

Microservicio de chatbot para WhatsApp: flujos en JSON + IA opcional + panel del asesor estilo
WhatsApp Web + API/webhooks para que otros sistemas lo integren. Canal actual: **simulador**. El
adaptador de Meta Cloud API está en el roadmap y entra por el mismo puerto `Channel`.

## Optimización de tokens — LEER ANTES DE EXPLORAR

**Antes de buscar por el repo, usa las skills locales.** Ya contienen la arquitectura, rutas reales
y plantillas. Explorar para "entender cómo se hace algo aquí" es gasto puro.

| Necesitas | Invoca |
|-----------|--------|
| Saber dónde vive algo | `/mapa-proyecto` |
| Endpoint, servicio o cambio en el backend | `/modulo-backend` |
| Tabla, columna, índice o migración | `/modelo-bd` |
| Pantalla o componente del panel | `/feature-frontend` |
| Que algo "se vea como WhatsApp" | `/diseno-whatsapp` |
| Añadir o cambiar un tipo de mensaje | `/tipos-mensaje` |
| Tocar `flow.json` o el motor de flujos | `/motor-flujos` |
| Proveedor de IA, prompt o derivación | `/proveedor-ia` |
| Negritas, cursivas, saltos en mensajes | `/formato-whatsapp` |
| Simulador, puerto `Channel`, adaptador de Meta | `/canal-whatsapp` |
| Endpoint público, API key, webhooks salientes | `/api-publica` |
| Escribir o arreglar pruebas | `/pruebas` |

### ✅ Siempre
1. El contrato es `docs/api.md`. Si cambias la API, cámbialo en el mismo commit.
2. Leer solo el módulo afectado; `grep` antes de abrir archivos grandes.
3. En cambios pequeños, revisar el diff, no el archivo completo.
4. Reglas detalladas en `.agents/rules/` (ya cargadas; no hace falta releerlas).

### ❌ Nunca
1. Leer `.venv/`, `node_modules/`, `dist/`, `data/`, `__pycache__/`, `.ruff_cache/`.
2. Leer `.env` con valores reales.
3. Editar una migración ya aplicada en `backend/migrations/versions/`.
4. Abrir `models.py` entero para tocar un modelo: `sed -n '/^class Message/,/^class /p' backend/app/models.py`.

## Stack

- **Backend:** Python 3.12 · FastAPI · SQLAlchemy 2 async (asyncpg) · Alembic · PostgreSQL 16 · httpx
- **Frontend:** React 19 · Vite · TypeScript estricto · CSS Modules · Plus Jakarta Sans
- **IA:** cliente compatible con OpenAI (OpenRouter, OpenRouter Perú, OpenAI, Ollama, custom)
- **Pruebas:** pytest + pytest-asyncio (SQLite en memoria) · **Calidad:** ruff, eslint, tsc

## Comandos

```bash
docker compose up --build              # todo: db, backend :8000, panel :5173
docker compose up -d db                # solo PostgreSQL
docker compose --profile ia-local up   # añade Ollama

cd backend
uvicorn app.main:app --reload          # API en http://localhost:8000 (Swagger en /docs)
alembic upgrade head                   # aplicar migraciones
alembic revision --autogenerate -m "add_x"
pytest -q
ruff check . && ruff format .

cd frontend
npm run dev                            # Panel en http://localhost:5173
npm run lint && npm run typecheck && npm run build
```

## Estructura

```
.
├── backend/
│   ├── app/
│   │   ├── main.py  config.py  db.py  enums.py  models.py  schemas.py  errors.py
│   │   ├── tasks.py  realtime.py  storage.py  formatting.py  templates.py  webhooks.py
│   │   ├── api/         routers: conversations · messages · media · simulator · system · ws · deps
│   │   ├── services/    messaging.py (entrada, envío, estados) · conversations.py · bot.py
│   │   ├── bot/         flow.py (carga flow.json) · engine.py (decide la respuesta)
│   │   ├── ai/          client.py (OpenAI-compatible) · prompt.py
│   │   └── channels/    base.py (puerto Channel) · simulator.py
│   ├── config/          flow.json · prompt.md · knowledge.md · templates.json · assets/
│   ├── migrations/      Alembic
│   └── tests/
├── frontend/src/
│   ├── app/  lib/  components/  styles/
│   └── features/        inbox · chat · composer · simulator · templates
├── docs/                api.md (contrato) · arquitectura · base-de-datos · decisiones/ …
├── .claude/skills/      skills de este repo
└── .agents/rules/       reglas obligatorias
```

## Las reglas que no se rompen

1. **Todo mensaje saliente pasa por el servicio de envío.** Ahí se validan límites de Meta, la
   ventana de 24 h y se registra en BD antes de tocar el canal. Nadie llama a `Channel` directo.
2. **El núcleo no conoce el canal.** `services/` y `bot/` hablan con el puerto `channels/base.py`,
   nunca con `simulator.py` ni con Meta.
3. **Una sola conversación abierta por contacto** (índice único parcial). No lo esquives.
4. **Los webhooks salen por el outbox** (`webhook_deliveries`), nunca con un POST en línea.
5. **Solo API oficial de Meta.** Nada de librerías que automatizan WhatsApp Web.

## Seguridad

- `X-API-Key` obligatoria cuando `API_KEY` está definido (siempre en producción).
- Webhooks firmados con HMAC-SHA256 (`WEBHOOK_SECRET`).
- Las claves (`AI_API_KEY`, `WEBHOOK_SECRET`) son `SecretStr`: nunca se loguean ni se devuelven.
- Archivos subidos: tamaño máximo `MAX_UPLOAD_MB`, MIME validado, nombre en disco = sha256.

---
**Estado:** v0.1 — simulador, flujos, IA, panel, API y webhooks. Siguiente: adaptador de Meta.
