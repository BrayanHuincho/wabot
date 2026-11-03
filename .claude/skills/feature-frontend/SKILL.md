---
name: feature-frontend
description: Cómo crear o modificar una feature del panel de Wabot (React 19 + Vite + TS + CSS Modules) — estructura en src/features, datos con TanStack Query, tiempo real que actualiza la caché, estado de UI con zustand. Úsala ANTES de crear una pantalla, un hook de datos o tocar inbox, chat, composer, simulator o templates.
---

# Feature de frontend

## Dónde va cada cosa

| Necesitas | Archivo |
|---|---|
| Llamar a un endpoint | `src/lib/api.ts` (`api.xxx()`; lanza `ApiError` con `code`) |
| Hook de lectura/mutación | `src/lib/queries.ts` (`useConversations`, `useMessages`, `useSendMessage`, `useSimulate`, `useUpload`, `useTemplates`, `useInfo`…) |
| Claves y mutación de caché | `src/lib/cache.ts` (`keys`, `upsertConversation`, `appendMessage`, `updateMessage`, `flattenPages`) |
| Eventos de WebSocket | `src/lib/realtime.ts` + `src/app/useRealtime.ts` |
| Estado de UI global | `src/app/store.ts` (zustand) |
| Tipos | `src/lib/types.ts` (reflejo de `docs/api.md`) |
| Límites de Meta | `src/lib/limits.ts` |
| Pantalla | `src/features/<dominio>/` |

Dominios: `inbox` (lista), `chat` (hilo y burbujas), `composer` (escribir, adjuntar, plantillas),
`simulator` (teléfono), `templates` (selector de plantillas).

## Estructura de una feature

```
features/chat/
├── ChatPanel.tsx  ChatPanel.module.css
├── ChatHeader.tsx  MessageList.tsx  TypingBubble.tsx  doodle.ts
└── bubble/
    ├── Bubble.tsx  MessageBody.tsx      # switch por message.type
    └── AudioPlayer.tsx  Lightbox.tsx  ListSheet.tsx
```

Una feature no importa de otra. Si dos la necesitan, sube a `components/` o `lib/`.

## Datos

```tsx
const { data, isPending } = useConversations('open', search)
const send = useSendMessage(conversationId)
send.mutate({ type: 'text', body })
```

- Nunca `useEffect` + `fetch`.
- El WebSocket es la fuente de cambios: `message.created` → `appendMessage`,
  `message.status` → `updateMessage`, `conversation.updated` → `upsertConversation`. No invalides
  toda la bandeja por un evento.
- Errores: `ApiError.code` → texto en español en un toast (`window_closed` → "La ventana de 24 h
  está cerrada. Usa una plantilla.").

## Receta

1. Tipo en `lib/types.ts` si hay dato nuevo (igual que `docs/api.md`).
2. Método en `lib/api.ts` y hook en `lib/queries.ts`.
3. Si llega por WebSocket, manejarlo en `useRealtime.ts` vía `lib/cache.ts`.
4. Componentes en `features/<dominio>/` con su `.module.css`.
5. Estilo con `/diseno-whatsapp`.
6. `npm run lint && npm run typecheck && npm run build`.

Sin backend: `VITE_MOCK=1 npm run dev`.

## ✅ Siempre / ❌ Nunca

- ✅ Tipos estrictos, uniones discriminadas por `type` con `switch` exhaustivo.
- ✅ Estados de carga con `Skeleton`, vacíos con texto útil.
- ✅ Componentes compartidos de `src/components/` antes de crear uno.
- ❌ `any`. ❌ Tailwind o CSS-in-JS. ❌ Colores literales fuera de `tokens.css`.
- ❌ `dangerouslySetInnerHTML` (el formato va por `formatWhatsApp`).
- ❌ Comentarios de relleno ni JSX comentado.
