# 0003 — Solo la API oficial de Meta

- **Estado:** aceptada
- **Fecha:** 2026-09

## Contexto

Existen librerías que automatizan WhatsApp Web (Baileys, whatsapp-web.js, etc.). Son fáciles de
arrancar y no requieren aprobación de Meta.

## Decisión

Wabot solo se conectará a WhatsApp mediante la **WhatsApp Cloud API oficial**. No se aceptarán
adaptadores basados en WhatsApp Web.

## Por qué

- Las soluciones no oficiales violan los términos de WhatsApp y terminan en números bloqueados.
- Se rompen con cada cambio del cliente web.
- La API oficial da acuses fiables, plantillas, botones y listas.

## Consecuencias

- Respetamos sus reglas desde el día uno aunque el canal sea el simulador: ventana de 24 h, límites
  de cada tipo, plantillas fuera de ventana.
- Para usar Wabot con clientes reales hará falta una cuenta de WhatsApp Business Platform.
- Plan del adaptador: [conectar-meta.md](../conectar-meta.md).

