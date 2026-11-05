import type { EnvironmentOption } from "@/lib/environment"

/**
 * Los siete flujos de la consola (ADR-022, consola-visual). La navegación, el encabezado de
 * cada flujo y su enlace "Qué es esto" salen de acá. Un servicio nuevo del SDK suma una
 * entrada.
 */

/**
 * Qué cliente usa el flujo: `rest` (`Sabre`), `soap` (`SabreLegacy`) o `local` (sin red). En
 * fake solo corren `soap`, contra `createQueueFake`, y `local`.
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
]

export function getFlow(slug: string): Flow | undefined {
  return FLOWS.find((flow) => flow.slug === slug)
}

/** Por qué REST no corre en fake. */
export const FAKE_REST_REASON =
  "el modo fake no tiene fixtures REST: sabre-client/testing solo trae colas"

/** Por qué el flujo no corre en ese entorno, o `undefined` si corre. */
export function flowUnavailable(
  flow: Flow,
  environment: EnvironmentOption
): string | undefined {
  if (flow.api === "local") return undefined
  if (!environment.enabled) {
    return environment.reason ?? "entorno deshabilitado"
  }
  if (flow.api === "rest" && environment.id === "fake") return FAKE_REST_REASON
  return undefined
}

/** El flujo de una ruta: `/queues/TEST/9` → colas. */
export function flowOfPath(pathname: string): Flow | undefined {
  return getFlow(pathname.split("/")[1] ?? "")
}
