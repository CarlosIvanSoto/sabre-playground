import type {
  BookingSeatSelection,
  GetSeatsResponse,
  Itinerary,
  ItineraryGroup,
} from "sabre-client"
import { z } from "zod"

/**
 * Entradas y vistas del flujo 2 (Air Booking de punta a punta). Lo usan el formulario y las
 * server actions, que vuelven a validar porque son endpoints públicos. Solo importa tipos de
 * `sabre-client`, así que el SDK no entra al bundle del cliente.
 */

const airport = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, "tres letras (IATA)")

/**
 * Búsqueda mínima de F3.1: origen, destino, fecha y adultos. La aerolínea y "solo directos"
 * son filtros de Sabre (`VendorPref`, `MaxStopsQuantity`), no reglas de agencia: sirven para
 * llegar a un vuelo que CERT deje reservar.
 */
export const searchSchema = z.object({
  origin: airport,
  destination: airport,
  /** `YYYY-MM-DD`, hora local del origen. */
  departureDate: z.iso.date("fecha YYYY-MM-DD"),
  adults: z.coerce
    .number<string | number>()
    .int()
    .min(1, "al menos 1")
    .max(4, "hasta 4"),
  /** Código IATA de 2 caracteres; vacío = cualquier aerolínea. */
  airline: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^([A-Z0-9]{2})?$/, "dos letras o dígitos")
    .optional()
    .transform((value) => (value === "" ? undefined : value)),
  directOnly: z.boolean(),
})

export type SearchInput = z.input<typeof searchSchema>
export type SearchQuery = z.output<typeof searchSchema>

/**
 * Valores por defecto: DFW→LAX con AA. En CERT, AA2793 directo (2026-12-19) sí se reservó;
 * DL948 volvió en `UC` y Create falló (ver `booking-management-api` en el wiki).
 */
export const SEARCH_DEFAULTS: SearchInput = {
  origin: "DFW",
  destination: "LAX",
  departureDate: "2026-12-19",
  adults: 1,
  airline: "AA",
  directOnly: true,
}

/** Itinerario elegido: el grupo de BFM recortado a ese itinerario. */
export interface ChosenItinerary {
  group: ItineraryGroup
  itinerary: Itinerary
}

/** El grupo con un solo itinerario: es lo que piden los builders, sin cargar los otros 49. */
export function chooseItinerary(
  group: ItineraryGroup,
  itinerary: Itinerary
): ChosenItinerary {
  return { group: { ...group, itineraries: [itinerary] }, itinerary }
}

/** Una fila de la lista compacta de itinerarios. */
export interface ItinerarySummary {
  /** `<grupo>:<id>`: único dentro de una respuesta. */
  key: string
  id: number
  flights: FlightSummary[]
  /** Conexiones sumadas de todos los tramos. */
  stops: number
  /** Clase de reserva de cada vuelo, en orden. */
  bookingClasses: string[]
  price?: { amount: number; currency: string }
  validatingCarrier?: string
}

export interface FlightSummary {
  /** Vuelo comercializador, p. ej. `AA2793`. */
  flight: string
  /** Operador, si no es el comercializador. */
  operatedBy?: string
  from: string
  to: string
  /** `YYYY-MM-DD` del tramo. */
  date?: string
  /** `HH:MM` local. */
  departs: string
  arrives: string
  /** Días que se suman a la llegada. */
  arrivalDays?: number
}

/** `HH:MM` de una hora de Sabre con offset (`17:10:00+02:00`). */
const hhmm = (time: string) => time.slice(0, 5)

export function summarizeItinerary(
  group: ItineraryGroup,
  groupIndex: number,
  itinerary: Itinerary
): ItinerarySummary {
  const dates = group.groupDescription.legDescriptions
  const flights = itinerary.legs.flatMap((leg, legIndex) =>
    leg.schedules.map(
      (schedule): FlightSummary => ({
        flight: `${schedule.carrier.marketing}${schedule.carrier.marketingFlightNumber}`,
        operatedBy:
          schedule.carrier.operating !== undefined &&
          schedule.carrier.operating !== schedule.carrier.marketing
            ? schedule.carrier.operating
            : undefined,
        from: schedule.departure.airport,
        to: schedule.arrival.airport,
        date: dates[legIndex]?.departureDate,
        departs: hhmm(schedule.departure.time),
        arrives: hhmm(schedule.arrival.time),
        arrivalDays: schedule.arrival.dateAdjustment,
      })
    )
  )
  const fare = itinerary.pricingInformation[0]?.fare
  const bookingClasses =
    fare?.passengerInfoList[0]?.passengerInfo.fareComponents?.flatMap(
      (component) =>
        component.segments?.map((s) => s.segment.bookingCode ?? "?") ?? []
    ) ?? []
  return {
    key: `${groupIndex}:${itinerary.id}`,
    id: itinerary.id,
    flights,
    stops: itinerary.legs.reduce(
      (sum, leg) => sum + Math.max(leg.schedules.length - 1, 0),
      0
    ),
    bookingClasses,
    price:
      fare?.totalFare === undefined
        ? undefined
        : {
            amount: fare.totalFare.totalPrice,
            currency: fare.totalFare.currency,
          },
    validatingCarrier: fare?.validatingCarrierCode,
  }
}

/**
 * Forma mínima de un itinerario que llega a una server action desde el cliente. No valida todo
 * el modelo: lo que falte lo rechazan los builders del SDK con `TypeError`, que se ve en la
 * pestaña Error.
 */
const itinerarySchema = z.looseObject({
  id: z.number(),
  legs: z.array(z.looseObject({ schedules: z.array(z.looseObject({})) })),
  pricingInformation: z.array(z.looseObject({ fare: z.looseObject({}) })),
})

export const chosenItinerarySchema = z.object({
  group: z.looseObject({
    groupDescription: z.looseObject({
      legDescriptions: z.array(z.looseObject({})),
    }),
    itineraries: z.array(itinerarySchema),
  }),
  itinerary: itinerarySchema,
})

/** Entrada de Revalidate (F3.2): la búsqueda que produjo el itinerario y el itinerario. */
export const revalidateSchema = chosenItinerarySchema.extend({
  query: searchSchema,
})

export interface RevalidateInput extends ChosenItinerary {
  query: SearchQuery
}

/**
 * El itinerario revalidado: el que Sabre marca `currentItinerary`, o el primero. Revalidate
 * responde con el mismo modelo que BFM (`modelo-de-itinerario` en el wiki).
 */
export function revalidatedItinerary(
  result: unknown
): ChosenItinerary | undefined {
  const groups = (result as { itineraryGroups?: ItineraryGroup[] } | undefined)
    ?.itineraryGroups
  for (const group of groups ?? []) {
    const itinerary =
      group.itineraries.find((i) => i.currentItinerary === true) ??
      group.itineraries[0]
    if (itinerary !== undefined) return chooseItinerary(group, itinerary)
  }
  return undefined
}

/**
 * Lo que deja el paso de asientos (F3.3) para Create: los asientos elegidos (siempre para el
 * primer viajero) y el mapa de donde salieron, para que `buildBookingFlightDetails` avise si
 * alguno tiene precio. Sin asientos, el paso se saltó.
 */
export interface SeatPlan {
  seats: BookingSeatSelection[]
  availability?: GetSeatsResponse
}

/** `S1` → `1`: el número de vuelo que usan `segmentIndex` y `buildSeatAvailabilityRequest`. */
export function segmentIndex(segmentRef: string): number | undefined {
  const match = /^S(\d+)$/.exec(segmentRef)
  return match === null ? undefined : Number(match[1])
}
