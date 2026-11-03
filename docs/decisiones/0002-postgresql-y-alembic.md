# 0002 — PostgreSQL y Alembic

- **Estado:** aceptada
- **Fecha:** 2026-09

## Contexto

Necesitamos garantías que una app de chat rompe fácil con concurrencia: una sola conversación
abierta por contacto, no duplicar mensajes reenviados por el canal, estados coherentes.

## Decisión

**PostgreSQL 16** con **SQLAlchemy 2 async** y migraciones con **Alembic**.

## Por qué

- Índices únicos **parciales** (`UNIQUE (contact_id) WHERE status = 'open'`) para invariantes de
  negocio en la BD, no en Python.
- **JSONB** para el contenido variable de cada tipo de mensaje.
- CHECKs y enums nativos.
- Alembic es el estándar con SQLAlchemy y deja historial versionado del esquema.

## Consecuencias

- Las pruebas corren en SQLite en memoria por velocidad; los modelos usan variantes
  (`JSON().with_variant(JSONB())`, `sqlite_where`, `ddl_if`). Lo específico de Postgres (CHECK de
  teléfono) solo se prueba contra Postgres.
- Cambiar un enum requiere migración manual (`ALTER TYPE ... ADD VALUE`).

