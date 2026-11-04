/**
 * Los siete flujos de la consola (ADR-022, consola-visual). La navegación, el encabezado de
 * cada flujo y su enlace "Qué es esto" salen de acá. Un servicio nuevo del SDK suma una
 * entrada.
 */

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
}

export const FLOWS: Flow[] = [
  {
    slug: "auth",
    number: 1,
    title: "Autenticación",
    description:
      "Pedir el token (v3 o v2), ver su vencimiento y refresco, y forzar un 401.",
    methods: ["automático (AuthManager)"],
    wiki: "wiki/proyectos/sabre-client/decisiones/renovacion-token-oauth.md",
    phase: 2,
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
  },
  {
    slug: "booking",
    number: 4,
    title: "Reserva suelta",
    description: "Leer o cancelar una reserva por su localizador.",
    methods: ["booking.get", "booking.cancel"],
    wiki: "wiki/proyectos/sabre-client/decisiones/gestion-de-reserva.md",
    phase: 2,
  },
  {
    slug: "session",
    number: 5,
    title: "Sesión SOAP",
    description:
      "Abrir, hacer ping y cerrar una sesión, con el contador de inactividad.",
    methods: ["legacy.openSession", "legacy.withSession"],
    wiki: "wiki/entities/create-session.md",
    phase: 4,
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
  },
]

export function getFlow(slug: string): Flow | undefined {
  return FLOWS.find((flow) => flow.slug === slug)
}
