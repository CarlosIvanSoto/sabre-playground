Closes #

## Resumen

<!-- Qué problema resuelve este PR, en 2–3 frases. -->

## Cambios

<!-- Lista agrupada por parte de la app (step, ui, auth, booking, air, session, queue, parser, fake…). -->
-

## Referencias del wiki

<!-- Páginas de sabre-wiki que fijan el diseño de lo implementado. -->
- `wiki/proyectos/sabre-playground/decisiones/consola-visual.md`

## Cómo se probó

- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] Prueba manual en CERT / en modo fake (decir cuál y qué se corrió, sin datos de pasajero)

## Definición de terminado

- [ ] Solo la API pública de `sabre-client` (nada importado de rutas internas del paquete)
- [ ] Credenciales y token solo del lado del servidor: nada llega al HTML ni al payload del cliente
- [ ] Sin lógica de negocio de agencia
- [ ] Ningún dato real de pasajero ni PNR en el repo (código, fixtures, capturas)
- [ ] Probado en CERT o en modo fake
- [ ] Hallazgos devueltos al wiki

## Hallazgos para el wiki

<!-- Qué se anotó y en qué página, o "Sin hallazgos". -->

## Notas para revisión

<!-- Decisiones discutibles, deuda que queda, por dónde empezar a leer. -->
