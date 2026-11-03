---
activation: glob
globs: backend/**
---
# Reglas del backend — FastAPI

## 1. Capas

| Capa | Ruta | Puede | No puede |
|---|---|---|---|
| Router | `app/api/*.py` | Validar con `schemas.py`, inyectar dependencias, llamar a un servicio, serializar | Consultar la BD directamente, tener lógica de negocio |
| Servicio | `app/services/*.py` | Abrir transacciones, decidir, llamar a puertos, publicar eventos | Importar `fastapi`, devolver `JSONResponse` |
| Bot | `app/bot/` | Decidir con funciones puras (`decide()`) | Tocar BD o red |
| Puertos | `app/channels/base.py`, `app/ai/client.py`, `app/storage.py` | Hablar con el exterior | Importar `services/` |

Las dependencias se cablean en `build_context()` (`app/context.py`). No crear singletons globales
nuevos ni instanciar `SimulatorChannel`/`ChatClient` fuera de ahí.

## 2. Async

- Todo I/O es `async`: SQLAlchemy async (`AsyncSession`), `httpx.AsyncClient`. Nada de `requests`
  ni llamadas bloqueantes en el event loop (usa `asyncio.to_thread` para disco pesado).
- Trabajo en segundo plano solo con `TaskRegistry.spawn()` (`app/tasks.py`), nunca
  `asyncio.create_task` suelto: el registro permite drenar y cancelar al apagar y en las pruebas.

## 3. Transacciones y eventos

- Una transacción por caso de uso. El servicio hace `commit`; el router no.
- **Eventos WebSocket después del commit** (`Hub.publish`). Webhooks **dentro** de la transacción
  con `webhooks.enqueue(session, ...)` (outbox).
- Al crear una conversación, contar con que el índice único parcial puede rechazar el INSERT por
  concurrencia: capturar `IntegrityError` y releer.

## 4. Errores

- Lanzar subclases de `AppError` (`NotFound`, `WindowClosed`, `ConversationClosed`,
  `FileTooLarge`, `UnsupportedMedia`, `InvalidMessage`). Nunca `HTTPException` en servicios.
- Error nuevo → subclase en `app/errors.py` con `status_code` y `code`, y fila en `docs/api.md`.
- No silenciar excepciones. Si se captura, es para traducirla o para un reintento con sentido.

## 5. Mensajes salientes

Todo mensaje saliente (bot, asesor, API) pasa por el mismo servicio de envío, que valida límites,
ventana de 24 h y estado de la conversación, persiste `pending` y luego llama a
`channel.deliver()`. Nadie más llama al canal.

## 6. Esquemas

- Pydantic v2 en `app/schemas.py`. Los límites de Meta se expresan con `Field(max_length=...)` y
  validadores de modelo, no con `if` en el servicio.
- Fechas de salida en UTC con `Z` (`UtcDatetime`).

## 7. Estilo

- `ruff check .` y `ruff format .` (línea 100, py312). Type hints en todo lo público.
- `StrEnum` de `app/enums.py`; nunca strings mágicos (`"open"`) en lógica.
- Logs con `logging.getLogger(__name__)`, sin datos personales ni secretos.
