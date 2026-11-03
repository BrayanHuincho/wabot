---
activation: glob
globs: frontend/**
---
# Reglas del frontend — React 19 + Vite

## 1. Estructura

| Ruta | Qué va |
|---|---|
| `src/app/` | Raíz: `App.tsx`, `providers.tsx`, `store.ts` (zustand), `useRealtime.ts` |
| `src/lib/` | Sin JSX salvo `whatsapp.tsx`: `api.ts`, `queries.ts`, `cache.ts`, `realtime.ts`, `types.ts`, `limits.ts`, `format.ts`, `dates.ts`, `config.ts` |
| `src/components/` | Piezas genéricas: `Avatar`, `Button`, `Icon`, `Modal`, `Sheet`, `Skeleton`, `Toasts`, `Toggle` |
| `src/features/<dominio>/` | `inbox`, `chat` (con `bubble/` por tipo de mensaje), `composer`, `simulator`, `templates` |
| `src/styles/` | `tokens.css` (variables) y `global.css` |

Una feature no importa de otra feature; lo compartido sube a `components/` o `lib/`.

## 2. Datos

- Servidor → **TanStack Query** (`lib/queries.ts`). Nada de `useEffect` + `fetch`.
- Peticiones solo por `lib/api.ts` (añade `X-API-Key`, traduce `{"error": {...}}`).
- Eventos de WebSocket actualizan la caché de Query (`lib/cache.ts`), no un estado paralelo.
- Estado de UI global mínimo en `app/store.ts` (zustand): conversación seleccionada, paneles.
- Tipos de la API en `lib/types.ts`, reflejo exacto de `docs/api.md`. Límites en `lib/limits.ts`.

## 3. TypeScript

- `strict`. Prohibido `any`; usar `unknown` + narrowing.
- Uniones discriminadas por `type` para `MessageType`, con `switch` exhaustivo.

## 4. Estilos

- **CSS Modules** (`Componente.module.css`) junto al componente. Sin Tailwind, sin CSS-in-JS.
- Colores, radios, sombras y tipografía solo desde variables de `styles/tokens.css`.
- Fuente: Plus Jakarta Sans. Ver skill `/diseno-whatsapp`.

## 5. Componentes

- Función + hooks. Un componente por archivo, nombre en PascalCase.
- Textos de UI en español, cortos y sin jerga técnica.
- Accesibles: botones reales (`<button>`), `aria-label` en iconos, foco visible, contraste AA.

## 6. Calidad

`npm run lint` (oxlint), `npm run typecheck` (tsc) y `npm run build` deben pasar.
`VITE_MOCK=1` permite trabajar sin backend.
