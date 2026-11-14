import type { EnvironmentOption } from "@/lib/environment"

/**
 * Por qué la consola de comandos no corre en fake. Vive acá, y no junto a la política de
 * comandos, porque el menú de flujos está en todas las páginas y la política importa el SDK.
 */
export const FAKE_COMMAND_REASON =
  "el fake de sabre-client 0.7.0 no simula session.command()"

/**
 * Los flujos de la consola: los siete de ADR-022 (consola-visual) y la consola de comandos
 * (ADR-032). La navegación, el encabezado de cada flujo y su enlace "Qué es esto" salen de
 * acá. Un servicio nuevo del SDK suma una entrada.
 */

/**
 * Qué cliente usa el flujo: `rest` (`Sabre`), `soap` (`SabreLegacy`) o `local` (sin red). En
 * fake corren `soap` y `local`, y los `rest` con `fakeRest`: los que solo usan lo que el fake
 * REST de la 0.7.0 simula (token, Create, Get y Cancel Booking, Fulfill).
 */
export type FlowApi = "rest" | "soap" | "local"

export interface Flow {
  /** Segmento de la ruta: `/air-booking`. */
  slug: string
  /** Número del flujo en ADR-022. */
  number: number
  title: string
  description: string
  /** Métodos públicos de `sabre-client` que recorre. */
  methods: string[]
  /** Página de `sabre-wiki` que explica el flujo, como ruta en texto. */
  wiki: string
  /** Fase del plan v2 en la que llega el flujo. */
  phase: number
  api: FlowApi
  /** Por qué no corre en fake, si es `soap` y el fake no lo simula. */
  fakeUnavailable?: string
  /** Si es `rest` y el fake REST simula todo lo que usa. */
  fakeRest?: boolean
}

export const FLOWS: Flow[] = [
  {
    slug: "auth",
    number: 1,
    title: "Autenticación",
    description:
      "Pedir el token (v3 o v2), ver su vencimiento y refresco, y forzar un 401.",
    methods: ["automático (AuthManager)", "booking.get"],
    wiki: "wiki/proyectos/sabre-client/decisiones/renovacion-token-oauth.md",
    phase: 2,
    api: "rest",
  },
  {
    slug: "air-booking",
    number: 2,
    title: "Air Booking de punta a punta",
    description:
      "Buscar, elegir un itinerario, revalidar, ver asientos, reservar, leer y cancelar.",
    methods: [
      "air.bargainFinderMax",
      "air.revalidateItinerary",
      "air.getSeats",
      "booking.create",
      "booking.get",
      "booking.cancel",
    ],
    wiki: "wiki/concepts/flujo-air-booking.md",
    phase: 3,
    api: "rest",
  },
  {
    slug: "seats",
    number: 3,
    title: "Asientos de un PNR",
    description:
      "El mapa de asientos de una reserva existente, por localizador.",
    methods: ["air.getSeats"],
    wiki: "wiki/proyectos/sabre-client/decisiones/get-seats-en-el-sdk.md",
    phase: 2,
    api: "rest",
  },
  {
    slug: "booking",
    number: 4,
    title: "Reserva suelta",
    description: "Leer o cancelar una reserva por su localizador.",
    methods: ["booking.get", "booking.cancel"],
    wiki: "wiki/proyectos/sabre-client/decisiones/gestion-de-reserva.md",
    phase: 2,
    api: "rest",
    fakeRest: true,
  },
  {
    slug: "session",
    number: 5,
    title: "Sesión SOAP",
    description:
      "Abrir, hacer ping y cerrar una sesión, con el contador de inactividad.",
    methods: ["legacy.openSession", "session.ping", "session.close"],
    wiki: "wiki/entities/create-session.md",
    phase: 4,
    api: "soap",
  },
  {
    slug: "queues",
    number: 6,
    title: "Colas",
    description:
      "count, list, access, ignore, remove, place y exit, y el recorrido con process.",
    methods: ["session.queue.*"],
    wiki: "wiki/entities/queue-management.md",
    phase: 4,
    api: "soap",
  },
  {
    slug: "queue-paragraph",
    number: 7,
    title: "Párrafo de cola",
    description:
      "Pegar el texto de un PNR y ver el resultado del parser, sin red.",
    methods: ["parseQueueParagraph", "resolveHostDate"],
    wiki: "wiki/proyectos/sabre-client/decisiones/tier-3-sesion-y-colas-soap.md",
    phase: 4,
    api: "local",
  },
  {
    slug: "commands",
    number: 8,
    title: "Comandos de host",
    description:
      "Mandar un comando de host en la sesión SOAP y ver la pantalla, con el panel de comandos conocidos.",
    methods: ["session.command"],
    wiki: "wiki/concepts/comandos-de-host.md",
    phase: 15,
    api: "soap",
    fakeUnavailable: FAKE_COMMAND_REASON,
  },
  {
    slug: "sales",
    number: 9,
    title: "Ventas del día",
    description:
      "El reporte de ventas de un PCC y una fecha, con su status, las anuladas marcadas y los totales.",
    methods: ["session.reporting.dailySalesSummary"],
    wiki: "wiki/proyectos/sabre-client/decisiones/ventas-del-dia-summary.md",
    phase: 16,
    api: "soap",
  },
]

export function getFlow(slug: string): Flow | undefined {
  return FLOWS.find((flow) => flow.slug === slug)
}

/** Por qué REST no corre en fake. */
export const FAKE_REST_REASON =
  "el fake REST de sabre-client 0.7.0 solo simula el token, Create, Get y Cancel Booking y Fulfill: no Bargain Finder Max, revalidar ni asientos"

/** Por qué el flujo no corre en ese entorno, o `undefined` si corre. */
export function flowUnavailable(
  flow: Flow,
  environment: EnvironmentOption
): string | undefined {
  if (flow.api === "local") return undefined
  if (!environment.enabled) {
    return environment.reason ?? "entorno deshabilitado"
  }
  if (environment.id === "fake") {
    if (flow.api === "rest" && flow.fakeRest !== true) return FAKE_REST_REASON
    if (flow.fakeUnavailable !== undefined) return flow.fakeUnavailable
  }
  return undefined
}

/** El flujo de una ruta: `/queues/TEST/9` → colas. */
export function flowOfPath(pathname: string): Flow | undefined {
  return getFlow(pathname.split("/")[1] ?? "")
}
