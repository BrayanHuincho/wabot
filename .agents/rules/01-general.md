---
activation: always_on
---
# Reglas generales — Wabot

## 1. Idioma

| Qué | Idioma | Ejemplo |
|---|---|---|
| Identificadores (variables, funciones, clases, archivos de código) | inglés | `last_inbound_at`, `useConversation` |
| Tablas, columnas, enums de BD | inglés snake_case | `webhook_deliveries`, `message_status` |
| Códigos de error de la API | inglés snake_case | `window_closed` |
| Mensajes de error de la API (`message`) | español | `"La ventana de 24 h está cerrada."` |
| Textos de UI, documentación, commits y comentarios | español | |

## 2. La ley del estilo de código

El código de este repo se lee como escrito por una persona con criterio, no por un generador.

- **Máximo 1–2 comentarios por archivo.** Solo para un *porqué* que el código no puede decir
  (`# Meta reenvía webhooks: el UNIQUE de external_id evita duplicados`). Excepción:
  `.env.example`, donde cada variable puede llevar su línea explicativa.
- Prohibido el boilerplate con pinta de IA:
  - comentarios que repiten el código (`# Create the user`, `// Import React`);
  - docstrings en cada función por obligación; banners `# ===== SECTION =====`;
  - `try/except` que solo relanza o loguea y sigue; `print` de depuración;
  - variables `result`, `data`, `temp` cuando hay un nombre mejor;
  - código "por si acaso": parámetros, ramas o abstracciones que nadie usa.
- Funciones cortas con nombres que dicen lo que hacen. Retorno temprano antes que anidar.
- Una sola forma de hacer cada cosa. Si ya existe un helper (`to_whatsapp`, `normalize`,
  `formatBytes`), se usa; no se duplica.
- Sin código muerto ni comentado. Git guarda la historia.
- Sin emojis en el código salvo en textos de cara al cliente (flujos, UI).

## 3. Contrato

`docs/api.md` es la fuente de verdad. Respuestas de error siempre
`{"error": {"code": "...", "message": "..."}}` vía `AppError` (`app/errors.py`). Un cambio de API
actualiza `docs/api.md`, `app/schemas.py` y `frontend/src/lib/types.ts` en el mismo commit.

## 4. Configuración

Nunca hardcodear secretos ni URLs de entorno. Todo pasa por `Settings` (`app/config.py`); secretos
como `SecretStr`. Variable nueva → `backend/.env.example` + tabla de `docs/despliegue.md`.

## 5. Commits

Semánticos y en español: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`. Un commit, un tema.

## 6. Ahorro de contexto

- Usa las skills de `.claude/skills/` antes de explorar.
- `grep` antes de abrir; lee solo el módulo afectado.
- No leer `.venv/`, `node_modules/`, `dist/`, `data/`, `__pycache__/`, `*.egg-info/`, `package-lock.json`.
- No leer `.env` con valores reales.

## 7. No hacer

- No editar migraciones ya aplicadas.
- No añadir dependencias sin justificarlo en el PR.
- No usar librerías no oficiales de WhatsApp (ver ADR 0003).
