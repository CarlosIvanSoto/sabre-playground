---
name: Tarea
about: Unidad de trabajo de una fase del plan de implementación, trazable al wiki de diseño
title: "[Fx.y] "
labels: []
---

## Fase

<!-- Fase del plan a la que pertenece. Ej.: Fase 1 — Layout único -->
Plan: `sabre-wiki/wiki/proyectos/sabre-playground/planes/plan-v2.md` → Fase X

## Tipo

<!-- Deja solo uno -->
- implementación — se escribe código
- decisión — hay que decidir algo antes de implementar; se cierra cuando la decisión está en el wiki
- fuente — falta documentación oficial; se cierra cuando la fuente está ingerida en el wiki

## Objetivo

<!-- Qué queda funcionando o decidido al cerrar el issue, en una o dos frases. -->

## Referencias del wiki

<!-- Páginas de sabre-wiki que fijan el diseño. -->
- `wiki/proyectos/sabre-playground/decisiones/consola-visual.md`
- `wiki/proyectos/sabre-client/decisiones/...`

## Alcance

**Incluye**
-

**No incluye**
-

## Criterios de aceptación

- [ ]
- [ ]

## Dependencias

<!-- Issues que deben cerrarse antes. Ej.: Bloqueado por #12 -->
- Ninguna

## Definición de terminado (común a todas las tareas de implementación)

- [ ] Solo la API pública de `sabre-client` (nada importado de rutas internas del paquete)
- [ ] Credenciales y token solo del lado del servidor: nada llega al HTML ni al payload del cliente
- [ ] Sin lógica de negocio de agencia
- [ ] Ningún dato real de pasajero ni PNR en el repo (código, fixtures, capturas)
- [ ] Probado en CERT o en modo fake (indicar cuál en el PR)
- [ ] Hallazgos devueltos al wiki (abajo)

## Hallazgos para el wiki

<!-- Lo que se descubra sobre Sabre o el SDK se anota en la página del wiki correspondiente, con fecha.
Lo que sea propio de la app (rutas, UI) va al README de este repo. -->
- [ ] Sin hallazgos / anotados en: `wiki/...`
