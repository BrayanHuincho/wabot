---
activation: always_on
---
# Reglas de seguridad

## 1. Autenticación

- `X-API-Key` en toda ruta de `/api/v1` excepto `GET /media/{id}` y `/health`. WebSocket: `?key=`.
- Comparación con `hmac.compare_digest`, nunca `==`.
- `API_KEY` vacío solo se admite en `development`/`test`.

## 2. Secretos

- `AI_API_KEY`, `WEBHOOK_SECRET`, `API_KEY` (y futuros tokens de Meta) son `SecretStr`.
  `.get_secret_value()` solo en el punto exacto de uso.
- Nunca en logs, respuestas, mensajes de error ni en el frontend (`/info` no expone claves).
- `.env` nunca se commitea ni se lee en sesiones de IA.

## 3. Webhooks

- Salientes firmados: `X-Wabot-Signature: sha256=<hmac del cuerpo>` (`webhooks.sign`).
- Entrantes de Meta (futuro): verificar `X-Hub-Signature-256` sobre el cuerpo **crudo** antes de
  parsear. Sin firma válida → 401.

## 4. Archivos

- Tamaño máximo `MAX_UPLOAD_MB` → `413 file_too_large`.
- MIME normalizado y validado contra el tipo de mensaje (`storage.accepts`) → `415`.
- El nombre en disco lo decide el servidor (`storage_key`), nunca el `filename` del usuario: evita
  path traversal. `filename` solo se usa en `Content-Disposition`, escapado.
- Las URLs de media son públicas por id (uuid no adivinable); no subir nada que no deba verse.

## 5. Entradas

- Toda entrada pasa por Pydantic. Teléfonos normalizados a E.164.
- Texto del cliente nunca se interpreta como HTML en el panel (React escapa; prohibido
  `dangerouslySetInnerHTML`). El formato de WhatsApp se renderiza con `lib/whatsapp.tsx`.
- URLs de `cta_url` solo `https://` o `http://`.

## 6. IA

- El contenido del cliente es dato, no instrucción: el prompt de sistema va primero y no se mezcla.
- La IA no ejecuta acciones; solo produce texto que pasa por el servicio de envío.
- Documentar que el historial se envía al proveedor (`docs/ia.md`).

## 7. Datos personales

- No loguear cuerpos de mensaje ni teléfonos completos en nivel INFO.
- Borrar un contacto borra sus conversaciones y mensajes (`ON DELETE CASCADE`).
- En issues y pruebas, teléfonos de ejemplo (`+51900000000`), nunca reales.
