# 0004 — El simulador es un canal

- **Estado:** aceptada
- **Fecha:** 2026-09

## Contexto

Desarrollar contra Meta exige cuenta verificada, número, plantillas aprobadas y un túnel público.
Eso frena a cualquiera que quiera probar el proyecto.

## Decisión

El simulador no es un mock de pruebas: es una **implementación del puerto `Channel`**
(`app/channels/simulator.py`), con su propia ruta de entrada (`POST /simulator/messages`) y acuses
programados. El núcleo trata igual sus mensajes que los que vendrán de Meta.

## Consecuencias

- Todo el producto (flujos, IA, panel, webhooks, ventana de 24 h) se usa sin Meta.
- El puerto `Channel` queda diseñado por un segundo uso real desde el principio, lo que facilita
  el adaptador de Meta.
- Hay que tener cuidado de no filtrar lógica de simulador en `services/`: cualquier `if channel ==
  'simulator'` fuera de `channels/` es un error de diseño.

