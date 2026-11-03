## Qué cambia

<!-- Resumen corto. Enlaza el issue si existe: Closes #123 -->

## Por qué

## Cómo se probó

- [ ] `ruff check` y `ruff format --check` en `backend/`
- [ ] `pytest` en `backend/`
- [ ] `npm run lint`, `npm run typecheck` y `npm run build` en `frontend/`
- [ ] Probado a mano en el simulador

## Checklist

- [ ] Si cambia la API, actualicé `docs/api.md`
- [ ] Si cambia la BD, añadí una migración nueva (no edité una existente)
- [ ] Si añadí una variable de entorno, está en `backend/.env.example` y en `docs/despliegue.md`
- [ ] Sin comentarios de relleno ni código muerto
