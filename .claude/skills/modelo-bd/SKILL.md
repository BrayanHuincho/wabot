---
name: modelo-bd
description: Cómo añadir o cambiar tablas, columnas, enums, índices y restricciones en Wabot (SQLAlchemy 2 + PostgreSQL 16 + Alembic), con compatibilidad SQLite para pruebas. Úsala ANTES de tocar backend/app/models.py, backend/app/enums.py o crear una migración.
---

# Modelo de datos

Fuente: `backend/app/models.py` y `backend/app/enums.py`. Explicación completa con el *porqué* de
cada restricción: `docs/base-de-datos.md`.

## Leer sin gastar tokens

```bash
sed -n '/^class Conversation/,/^class /p' backend/app/models.py
grep -n "Index\|CheckConstraint\|unique=True" backend/app/models.py
```

## Tablas

| Tabla | Clave | Restricciones que importan |
|---|---|---|
| `contacts` | `phone` E.164 único | CHECK `phone_e164` (solo Postgres, `ddl_if`) |
| `conversations` | `contact_id` | `uq_conversations_one_open_per_contact` (único parcial), `ix_conversations_inbox`, CHECK `closed_at_matches_status`, `unread_not_negative` |
| `messages` | `conversation_id`, `external_id` único | CHECK `author_matches_direction`, `ix_messages_timeline` |
| `media` | `sha256` único, `storage_key` único | CHECK `size_positive` |
| `webhook_deliveries` | outbox | `ix_webhook_deliveries_due` parcial `WHERE status='pending'`, CHECK `attempts_not_negative` |

## Plantilla de columna

```python
class Contact(Timestamped, Base):
    email: Mapped[str | None] = mapped_column(String(254))
    score: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    tags: Mapped[list[str]] = mapped_column(Json, default=list, server_default="[]")
```

- PK: `Uuid`, `default=uuid.uuid4`. Fechas: `DateTime(timezone=True)` + `utcnow`.
- Enum: `mapped_column(pg_enum(MyEnum, "my_enum"))`.
- JSON: el alias `Json` (JSONB en Postgres).
- No nullable ⇒ `default` **y** `server_default`.
- Índice parcial ⇒ `postgresql_where=text(...)` **y** `sqlite_where=text(...)`.
- Algo solo de Postgres (regex) ⇒ `.ddl_if(dialect="postgresql")`.

## Migración

```bash
cd backend
alembic revision --autogenerate -m "add_contact_email"
# revisar migrations/versions/<rev>_add_contact_email.py
alembic upgrade head
alembic downgrade -1 && alembic upgrade head
pytest -q
```

Autogenerate **no** detecta bien:

| Cambio | Qué escribir a mano |
|---|---|
| Valor nuevo de enum | `op.execute("ALTER TYPE message_type ADD VALUE IF NOT EXISTS 'poll'")` |
| CHECK nuevo | `op.create_check_constraint(...)` |
| Índice parcial | `op.create_index(..., postgresql_where=sa.text(...))` |
| Renombrar columna | `op.alter_column(..., new_column_name=...)` (si no, la borra y la crea) |

## Checklist

- [ ] Modelo + enum actualizados.
- [ ] Migración nueva revisada, con `downgrade` real.
- [ ] `schemas.py` (`*Out`) y `docs/api.md` si se expone.
- [ ] `docs/base-de-datos.md`: diagrama mermaid + fila de la tabla con el porqué.
- [ ] Prueba de la invariante nueva.

## ✅ Siempre / ❌ Nunca

- ✅ Invariantes de negocio como restricción de BD.
- ✅ Nombres en inglés snake_case; fechas `_at`.
- ❌ Editar una migración aplicada. ❌ `String` sin longitud en columnas cortas.
- ❌ Contar con un `SELECT` previo para evitar duplicados (carrera); usa UNIQUE + `IntegrityError`.
