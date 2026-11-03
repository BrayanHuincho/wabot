---
activation: glob
globs: backend/app/models.py, backend/app/enums.py, backend/migrations/**
---
# Reglas de base de datos — PostgreSQL + SQLAlchemy 2 + Alembic

## 1. Nombres

Tablas en plural, columnas en singular, todo en **inglés snake_case**. FK `<tabla_singular>_id`.
Fechas terminadas en `_at`. Índices `ix_<tabla>_<propósito>`, únicos `uq_...`.

## 2. Modelos (`app/models.py`)

- `Mapped[...]` + `mapped_column` (estilo SQLAlchemy 2). PK `Uuid` con `default=uuid.uuid4`.
- `DateTime(timezone=True)` siempre; valores con `utcnow()`.
- Tablas que se modifican heredan `Timestamped`.
- Enums con `pg_enum(EnumCls, "nombre_tipo")` (guarda el **valor**, no el nombre).
- JSON con el alias `Json` (JSONB en Postgres, JSON en SQLite).
- Defaults en Python **y** `server_default` cuando la columna no es nullable.

## 3. Invariantes en la BD, no en Python

| Invariante | Cómo |
|---|---|
| Una conversación abierta por contacto | Índice único parcial `uq_conversations_one_open_per_contact` |
| Mensaje no duplicado | `UNIQUE(external_id)` |
| `closed_at` coherente con `status` | CHECK `closed_at_matches_status` |
| Entrante ⇔ autor `contact` | CHECK `author_matches_direction` |
| Contadores no negativos | CHECK `>= 0` |

Si añades una regla de negocio que deba cumplirse siempre, exprésala como restricción.
Índices parciales con `postgresql_where` **y** `sqlite_where` (las pruebas usan SQLite).

## 4. Migraciones

- Toda modificación del esquema → `alembic revision --autogenerate -m "verbo_objeto"` y **revisar**
  el archivo: autogenerate no detecta valores nuevos de enum ni siempre los CHECK o índices parciales.
- Valor nuevo de enum: `op.execute("ALTER TYPE message_type ADD VALUE IF NOT EXISTS 'x'")`.
- `downgrade()` real en cada migración.
- **Nunca editar una migración ya aplicada o publicada.** Se crea otra.

## 5. Consultas

- Siempre con `select()` de SQLAlchemy; nunca SQL concatenado. `text()` solo con parámetros bind.
- Paginación por cursor de tiempo (`before=<iso>`), no `OFFSET`.
- Evitar N+1: las relaciones que se serializan siempre ya son `lazy="joined"`
  (`Conversation.contact`, `Message.media`).

## 6. Documentación

Cambio de esquema → actualizar `docs/base-de-datos.md` (diagrama y tabla) en el mismo PR.
