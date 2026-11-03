# Despliegue

## Docker Compose

```bash
cp backend/.env.example backend/.env    # edita los valores
docker compose up -d --build
docker compose logs -f backend
```

| Servicio | Imagen | Puerto | Volumen |
|---|---|---|---|
| `db` | `postgres:16-alpine` | 5432 | `pgdata` |
| `backend` | `./backend` | 8000 | `media` → `/app/data/media`, `./backend/config` → `/app/config` |
| `frontend` | `./frontend` (nginx) | 5173 → 80 | — |
| `ollama` | `ollama/ollama` (perfil `ia-local`) | 11434 | `ollama` |

`config/` se monta desde el host para editar flujos, prompt y conocimiento sin reconstruir la imagen
(basta `docker compose restart backend`).

El frontend se compila con `VITE_API_URL` y `VITE_API_KEY` en tiempo de build: si cambian, hay que
reconstruirlo.

## Variables de entorno (`backend/.env`)

| Variable | Defecto | Descripción |
|---|---|---|
| `ENVIRONMENT` | `development` | `development` / `production` / `test` |
| `DATABASE_URL` | `postgresql+asyncpg://wabot:wabot@localhost:5432/wabot` | Conexión async |
| `API_KEY` | vacío | Clave de `X-API-Key`. **Obligatoria en producción** |
| `CORS_ORIGINS` | `["http://localhost:5173"]` | Orígenes del panel (lista JSON) |
| `PUBLIC_URL` | `http://localhost:8000` | Base para construir `media.url` |
| `BUSINESS_NAME` | `Mi Empresa` | Nombre que ve el cliente y el prompt |
| `BUSINESS_PHONE` | `+51900000000` | Número del negocio |
| `SERVICE_WINDOW_HOURS` | `24` | Ventana de atención |
| `TYPING_DELAY_MS` | `700` | Pausa mínima antes de que responda el bot |
| `SIMULATOR_ACK_DELAY_MS` | `600` | Retraso de los acuses del simulador |
| `MEDIA_DIR` | `./data/media` | Carpeta de archivos |
| `MAX_UPLOAD_MB` | `100` | Tamaño máximo de subida |
| `CONFIG_DIR` | `./config` | Carpeta con `flow.json`, `prompt.md`… |
| `AI_PROVIDER` … `AI_HISTORY_SIZE` | | Ver [ia.md](ia.md) |
| `WEBHOOK_URL` | vacío | Destino de los webhooks |
| `WEBHOOK_SECRET` | vacío | Secreto HMAC |
| `WEBHOOK_MAX_ATTEMPTS` | `6` | Reintentos antes de `failed` |

## Checklist de producción

- [ ] `ENVIRONMENT=production` y `API_KEY` larga y aleatoria (`openssl rand -hex 32`).
- [ ] Contraseña de PostgreSQL distinta de `wabot`; puerto 5432 **no** expuesto a Internet.
- [ ] HTTPS delante (Caddy, Traefik o nginx). El WebSocket necesita `Upgrade` en el proxy.
- [ ] `CORS_ORIGINS` solo con el dominio real del panel.
- [ ] `PUBLIC_URL` con el dominio HTTPS real.
- [ ] `WEBHOOK_SECRET` definido si usas `WEBHOOK_URL`, y `WEBHOOK_URL` en HTTPS.
- [ ] Copias de seguridad de `pgdata` (`pg_dump` diario) y del volumen `media`.
- [ ] Las migraciones corren solas al arrancar el contenedor (`alembic upgrade head` en el `CMD`); revisa el log si falla.
- [ ] Revisado `config/prompt.md` y `config/knowledge.md` con datos reales del negocio.
- [ ] Una sola réplica del backend (el hub de WebSocket y las tareas de fondo son en proceso).
- [ ] Monitoreo de `GET /health` y alerta si hay muchas filas `failed` en `webhook_deliveries`.

## Actualizar

```bash
git pull
docker compose build
docker compose up -d
```
