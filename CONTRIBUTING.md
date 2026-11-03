# Cómo contribuir

Gracias por el interés. Wabot es pequeño a propósito: preferimos pocas piezas bien hechas a muchas a
medias.

## Antes de empezar

1. Abre un issue si el cambio no es trivial. Así acordamos el enfoque antes de que escribas código.
2. Lee [`docs/arquitectura.md`](docs/arquitectura.md) y las reglas de [`.agents/rules/`](.agents/rules/).
3. Si el cambio toca la API, el contrato manda: actualiza [`docs/api.md`](docs/api.md) en el mismo PR.

## Entorno

Sigue "Desarrollo local" del [README](README.md). Todo se puede probar con el simulador; no hace
falta cuenta de Meta.

## Estilo

- Identificadores en inglés; textos de la interfaz y documentación en español.
- Código que se explique solo. Uno o dos comentarios por archivo como máximo, y solo para explicar
  un *porqué* que no se deduce del código.
- Backend: `ruff check` y `ruff format`. Frontend: `npm run lint` y `npm run typecheck`.
- Commits semánticos: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`.

## Pull requests

- Un PR, un tema.
- Pruebas para la lógica nueva en `backend/tests/`.
- Cambios de base de datos siempre con una migración nueva de Alembic; nunca edites una ya publicada.
- Rellena la plantilla del PR. La CI debe estar en verde.

## Seguridad

Si encuentras una vulnerabilidad, no abras un issue público: escribe al mantenedor por correo
(perfil de GitHub) con los detalles.
