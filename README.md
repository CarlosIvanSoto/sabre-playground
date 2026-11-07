# sabre-playground

Consola local para recorrer, paso a paso, los flujos de
[`sabre-client`](https://www.npmjs.com/package/sabre-client), un SDK de TypeScript para las
APIs de Sabre. Cada paso muestra el resultado tipado, la respuesta cruda, el error y el log
de la llamada.

**No es una herramienta oficial de Sabre** ni está afiliada a Sabre. Es un banco de pruebas
manual contra el sandbox (CERT), sin lógica de negocio de ninguna agencia.

## Arrancar en modo fake (sin credenciales)

Requisitos: Node 24 y pnpm (la versión está en `packageManager`; con Corepack basta
`corepack enable`).

```bash
pnpm install
pnpm dev
```

Abre <http://localhost:3000>. Sin `.env.local`, la consola arranca en el entorno **Fake**,
que no sale a la red:

- **Colas (6)** y **Sesión SOAP (5)** corren contra `createQueueFake` de
  `sabre-client/testing`. Las colas se arman con `queueFixtures`, respuestas anonimizadas
  que se grabaron en producción: la cola `9` tiene cuatro PNR, la `50` está vacía y
  `AAAAAE` queda fuera de las colas para probar `place`. Prueba abrir la sesión, `count`,
  `access` en la 9 e `ignore` hasta el fin de cola. "Reiniciar el fake", arriba en la
  página de colas, devuelve las colas a como estaban.
- **Párrafo de cola (7)** corre siempre: es un parser sin red.
- **Autenticación, Air Booking, Asientos y Reserva (1–4)** usan REST, que no tiene
  fixtures públicas: en fake se ven deshabilitados, con la razón.

## Arrancar contra CERT

```bash
cp .env.example .env.local
```

Llena las variables `SABRE_CERT_*` y reinicia `pnpm dev`. `.env.local` está en
`.gitignore`; nunca subas valores reales.

| Variable | Qué es |
| - | - |
| `SABRE_CERT_AUTH_VERSION` | `v3` (por defecto) o `v2`. Solo cambia el formato del username EPR. |
| `SABRE_CERT_USERNAME` | El usuario EPR, sin PCC ni domain. |
| `SABRE_CERT_PCC` | El PCC del EPR (3 o 4 caracteres). |
| `SABRE_CERT_DOMAIN` | `AA` por defecto. |
| `SABRE_CERT_PASSWORD` | La contraseña del EPR. |
| `SABRE_CERT_CLIENT_ID`, `SABRE_CERT_CLIENT_SECRET` | Obligatorios con `v3`. Con `v2`, los dos o ninguno. |

Un solo juego de credenciales por entorno sirve para REST (`Sabre`) y SOAP
(`SabreLegacy`). Si falta algo o algo es inválido, el entorno queda deshabilitado en el
selector, con la razón (nombres de variables, nunca valores). `.env.example` explica cada
una.

### Producción (opcional)

Las mismas variables con prefijo `SABRE_PROD_*`, más `SABRE_PROD_ENABLED=true`. Sin esa
bandera, producción no aparece aunque haya credenciales.

## Reglas de seguridad

- **CERT por defecto.** Al recargar, la consola vuelve a CERT (o al primer entorno
  habilitado), nunca a producción.
- **Producción en solo lectura.** Create y Cancel Booking están prohibidos. En colas, las
  lecturas corren, y `remove` y `place` (también `process` con esas acciones) necesitan el
  desbloqueo explícito de la página, que se pierde al recargar, además de la confirmación de
  cada corrida. La server action lo vuelve a comprobar.
- **Las credenciales no salen del servidor.** Se leen de `.env.local` en módulos
  `server-only`, y las llamadas a Sabre van por server actions. El token no llega al HTML ni
  al payload del cliente; en el SOAP crudo, el `BinarySecurityToken` llega como
  `[REDACTED]`.
- **Datos sintéticos.** El pasajero por defecto es `TEST/PASSENGER`. Ningún dato real de
  pasajero ni PNR entra al repo, que es público: ni en código, ni en fixtures, ni en
  capturas.
- **El historial vive en la memoria del navegador.** Nada se guarda en disco ni en
  `localStorage`, y se vacía al recargar.

## Rutas

| Ruta | Flujo |
| - | - |
| `/` | Los siete flujos. |
| `/auth` | 1. Autenticación: token v3 o v2, vencimiento, refresco y un 401 forzado. |
| `/air-booking` | 2. Air Booking de punta a punta: BFM, revalidar, asientos, reservar, leer y cancelar. |
| `/seats` | 3. Asientos de un PNR. `?pnrLocator=` prellena el localizador. |
| `/booking` | 4. Reserva suelta: leer o cancelar por localizador, con `targetPcc` opcional. `?confirmationId=` y `?targetPcc=` prellenan la lectura. |
| `/session` | 5. Sesión SOAP: abrir, ping y cerrar, con el contador de inactividad. |
| `/queues`, `/queues/<PCC>/<cola>` | 6. Colas: `count`, `list`, `access`, `ignore`, `remove`, `place`, `exit` y `process`. |
| `/queue-paragraph` | 7. Párrafo de cola: el parser, sin red. |
| `/queue-desk`, `/queue-desk/<PCC>` | Mesa de colas (ADR-025): sesión, conteo, navegación y reserva en una sola pantalla, sin scroll. Compone los flujos 4, 5 y 6; se arma en la Fase 9. Con `<PCC>`, o con el campo "PCC de trabajo", cuenta, entra, mueve y lee reservas en ese PCC sin abrir otra sesión. |
| `/queue-census`, `/queue-census/<PCC>` | Censo de colas (ADR-026, Fase 10): recorrido de solo lectura por las colas 0–49 con PNR del PCC de trabajo. `count`, y por cada cola `access`, hasta N `ignore` (10 por defecto, máximo 25) y `exit`; al final, otro `count` para comparar. Por cada PNR, `booking.get` con el PCC de trabajo. Al navegador llegan solo los rasgos de ADR-026, calculados en el servidor: ni el párrafo, ni la reserva, ni el body del crudo. Sus server actions no tienen `place`, `remove` ni `process`. Parar sale de la cola con `exit`. En producción pide el desbloqueo y una confirmación con el resumen. Al terminar, exporta `queue-census/2` (descarga o copia) solo si pasa el validador y después de revisar los textos PIC; el JSON trae localizadores reales y nunca va al repo (`censo-colas-*.json` está en `.gitignore`). Muestra un resumen (cola × PIC y por cola) calculado del mismo JSON. Desde la mesa, "Al censo" suma el PNR en pantalla al censo en curso sin mover el cursor; el censo vive en la memoria del navegador, uno por entorno. |
| `/history` | Las llamadas de la sesión del navegador. |
| `/dev/run-step` | Prueba de `runStep` (desarrollo). |

## Copiar como hallazgo

Cada paso, y cada llamada del historial, tiene **Copiar como hallazgo**: un bloque Markdown
con fecha, entorno, método, la entrada del paso, la respuesta cruda y el error, para pegar
en la página de la entidad en la wiki del proyecto. Antes de copiar, la consola reemplaza
nombres, apellidos, emails, teléfonos, documentos, viajero frecuente, direcciones y fechas
de nacimiento por valores sintéticos (`TEST`/`PASSENGER`, `test@example.com`…), y conserva
localizador, segmentos, tarifas y códigos de error. Es una red de seguridad: revisa el
bloque antes de pegarlo.

## Cómo sumar un flujo

Un flujo usa solo la API pública de `sabre-client`. Si algo cuesta usarlo desde la consola,
es un hallazgo sobre el SDK, no algo para parchar acá.

1. **Registro**: una entrada en `FLOWS` (`src/lib/flows.ts`) con `slug`, número, título,
   métodos del SDK, página de la wiki y `api` (`rest`, `soap` o `local`). La navegación, la
   portada y el bloqueo en fake salen de ahí.
2. **Server action**: `src/app/(console)/<slug>/actions.ts`, con `"use server"`. Cada paso
   valida el entorno con `inEnvironment`, valida la entrada con el mismo esquema de zod que
   el formulario, pide el cliente con `getSabre(id)` o `getSabreLegacy(id)` y corre la
   llamada con `runStep`:

   ```ts
   export async function getSeatsByPnr(environment: unknown, input: unknown) {
     return inEnvironment(environment, async (id) => {
       const parsed = seatsByPnrSchema.safeParse(input)
       if (!parsed.success) return { enabled: false, reason: "entrada inválida" }
       const sabre = getSabre(id)
       if (!sabre.enabled) return { enabled: false, reason: sabre.reason }
       return {
         enabled: true,
         step: await runStep((options) =>
           sabre.client.air.getSeats({ pnrLocator: parsed.data.pnrLocator }, options)
         ),
       }
     })
   }
   ```

   Una escritura (crear, cancelar, sacar o colocar en una cola) comprueba además que el
   entorno no sea de solo lectura.
3. **Componentes**: en `src/components/<slug>/`, un formulario con `react-hook-form` y el
   esquema de zod, y `useStep("<método>", action)` con `StepPanel`. El panel ya trae las
   pestañas Resultado / Crudo / Error / Log, el historial y "Copiar como hallazgo". Nada de
   diseño propio: componentes shadcn por defecto.
4. **Página**: `src/app/(console)/<slug>/page.tsx` con `FlowHeader` y el componente del
   flujo. Le gana a la ruta dinámica `/[flow]`, que muestra "Todavía no está".

## Desarrollo

```bash
pnpm dev      # servidor de desarrollo
pnpm lint     # Biome (lint y formato)
pnpm format   # formatear
pnpm test     # tests unitarios (node:test, sin dependencias)
pnpm build    # build de producción, con el typecheck
```

La CI corre `pnpm biome ci`, `pnpm test` y `pnpm build` en cada PR. Stack: Next.js 16 (App Router,
server actions, React Compiler), React 19, TypeScript 7, Tailwind 4, shadcn sobre
`@base-ui/react`, `react-hook-form` + `zod`, Biome y pnpm.

### Sesiones SOAP y apagado del servidor

Las sesiones SOAP (`SabreSession`) viven en un registro en la memoria del servidor
(`src/server/sabre/sessions.ts`), y al apagarlo (`SIGINT`, `SIGTERM`) se cierran todas, con
un tope de 3 s. Por eso los scripts llevan variables de Next:

- `NEXT_MANUAL_SIG_HANDLE=true` (en `pnpm dev` y `pnpm start`): sin ella, el cleanup de Next
  sale con `process.exit` sin esperar los `SessionCloseRQ`, y las sesiones quedan vivas en
  Sabre hasta que vencen (el límite es de 50 por PCC).
- `NEXT_EXIT_TIMEOUT_MS=4000` (solo en `pnpm dev`): el proceso padre de `next dev` manda
  `SIGKILL` al hijo a los 100 ms por defecto.

Un `kill -9` no pasa por ahí: esas sesiones vencen solas. La sintaxis `VAR=valor comando` de
los scripts es de shells POSIX (macOS, Linux).

El token REST se guarda en `.sabre-token.json` (ignorado por git) para reutilizarlo entre
reinicios.
