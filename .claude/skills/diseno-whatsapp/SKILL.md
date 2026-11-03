---
name: diseno-whatsapp
description: Sistema de diseño del panel de Wabot — que se vea y se sienta como WhatsApp Web (burbujas, ticks, fondo, colores --wa-*), con la marca en Plus Jakarta Sans. Úsala ANTES de crear o retocar cualquier componente visual del panel o del simulador, y cuando algo "no parezca WhatsApp".
---

# Diseño WhatsApp

Objetivo: un asesor que usa WhatsApp Web todos los días no tiene que aprender nada. El área de
chat copia WhatsApp; el marco del panel (barra lateral, encabezados, ajustes) usa la marca.

## Tokens (`frontend/src/styles/tokens.css`)

| Uso | Variable |
|---|---|
| Fondo del hilo | `--wa-bg` (#efeae2) |
| Burbuja entrante / saliente | `--wa-in` (#fff) / `--wa-out` (#d9fdd3) |
| Texto del chat | `--wa-text` |
| Hora y metadatos | `--wa-meta` |
| Tick leído | `--wa-tick-read` (#53bdeb) |
| Enlaces | `--wa-link` |
| Botones de mensaje interactivo | `--wa-action` |
| Cita dentro de burbuja | `--wa-quote-in` / `--wa-quote-out` |
| Barras (encabezado y composer) | `--wa-bar` |
| Verdes de marca WhatsApp | `--wa-green`, `--wa-teal`, `--wa-teal-dark` |
| Marca Wabot (acciones del panel) | `--brand`, `--brand-hover`, `--brand-soft` |
| Tipografía | `--font-ui` (Plus Jakarta Sans), escala `--fs-*`, espaciado `--sp-*` |

Nunca escribas un color hex en un `.module.css`. Si falta, añade el token.

## Burbujas

| Regla | Valor |
|---|---|
| Ancho máximo | ~65 % del hilo |
| Radio | 8 px, con "cola" solo en la primera de un grupo consecutivo |
| Hora | abajo a la derecha, `--fs-2xs`, `--wa-meta`, dentro de la burbuja |
| Ticks (salientes) | `pending` reloj · `sent` ✓ gris · `delivered` ✓✓ gris · `read` ✓✓ `--wa-tick-read` · `failed` icono rojo + motivo al pasar el ratón |
| Agrupación | mensajes del mismo autor en < 1 min van pegados (2 px) |
| Separador de día | píldora centrada "Hoy", "Ayer", fecha |
| Autor saliente | etiqueta pequeña "Bot" / "Asesor" / "API" (WhatsApp no la tiene; aquí sí importa) |

## Tipos de mensaje

| Tipo | Cómo se ve |
|---|---|
| `text` | `formatWhatsApp()` de `lib/whatsapp.tsx` (negrita, cursiva, tachado, monoespaciado, enlaces) |
| `image` / `video` | Miniatura a ancho de burbuja, pie debajo |
| `audio` | Reproductor con botón play y barra |
| `document` | Fila con icono por extensión, nombre, `formatBytes()` |
| `sticker` | Sin burbuja, 160 px |
| `location` | Tarjeta con nombre/dirección y enlace a mapa |
| `buttons` | Header/body/footer y botones apilados debajo, separados por línea, texto `--wa-action` |
| `list` | Body + botón con icono de lista que abre `Sheet` con secciones |
| `cta_url` | Botón con icono de enlace externo |
| `template` | Igual que texto, con marca discreta "Plantilla" |
| `reply` | Cita del botón/fila pulsado |

## Panel

- Bandeja 360–420 px; hilo flexible. Responsive: en móvil, una columna con navegación.
- Encabezado del chat: avatar (`Avatar`), nombre, teléfono `formatPhone()`, `Toggle` Manual/Auto
  y estado de la ventana de 24 h ("Ventana abierta · cierra en 5 h" / "Ventana cerrada").
- Ventana cerrada → el composer muestra aviso y solo permite plantillas.
- `typing` → "escribiendo…" en el encabezado y en la fila de la bandeja.
- Animaciones cortas (120–200 ms), respetan `prefers-reduced-motion`.

## ✅ Siempre / ❌ Nunca

- ✅ Contraste AA, foco visible, `aria-label` en botones de icono.
- ✅ Reutilizar `Avatar`, `Button`, `Icon`, `Modal`, `Sheet`, `Skeleton`, `Toasts`, `Toggle`.
- ❌ Inventar un estilo distinto al de WhatsApp para el hilo.
- ❌ Gradientes, sombras grandes o emojis decorativos en la UI.
- ❌ Librerías de componentes o de iconos externas (los iconos están en `components/Icon.tsx`).
