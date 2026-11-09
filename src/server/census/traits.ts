import "server-only"

import {
  type GetBookingResponse,
  type QueueItem,
  type QueueParagraph,
  resolveHostDate,
} from "sabre-client"
import { maskCensusParagraph } from "@/lib/census-export"
import { parseQueuePlaces } from "@/lib/census-queue-place"
import {
  type AccountingTraits,
  type AncillaryTraits,
  type BookingTraits,
  type CensusPic,
  type FareTraits,
  type FlightTraits,
  TRAIT_PATTERNS as P,
  type ParagraphTraits,
  type SegmentCount,
  type TextFlags,
} from "@/lib/census-traits"

/**
 * Los rasgos del censo (F10.2, #96; ADR-026), calculados en el servidor. Reciben la respuesta
 * del SDK y devuelven solo lo de las tablas de "Rasgos de la reserva": todo lo demás (nombres,
 * texto libre, importes, PCC, identificadores) se queda acá y no llega al navegador.
 *
 * `sabre-client` tipa el primer nivel de `Booking` y deja el detalle como `unknown` (Tier 1). Por
 * eso se lee con los nombres del esquema `Booking` del spec v1.33, sin confiar en la forma: lo
 * que no está o no tiene la forma esperada queda en `null`. Esto no es lógica del SDK: es la
 * derivación de rasgos que ADR-026 pone en la consola.
 *
 * Fechas: Sabre las da en hora local del aeropuerto o del PCC, sin zona. Se toman como UTC, así
 * que días y horas son aproximados en unas horas; alcanza para clasificar.
 */

export interface TraitContext {
  /** El momento del censo. */
  now: Date
  /** El PCC de trabajo efectivo (el de la sesión si no se eligió otro). Nunca sale de acá. */
  workingPcc: string
}

// --- Lectura defensiva -------------------------------------------------------------------

type Json = Record<string, unknown>

const obj = (value: unknown): Json | undefined =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Json)
    : undefined

const list = (value: unknown): Json[] =>
  Array.isArray(value)
    ? value.map(obj).filter((item): item is Json => item !== undefined)
    : []

const str = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() !== "" ? value.trim() : undefined

const bool = (value: unknown): boolean | null =>
  typeof value === "boolean" ? value : null

const int = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : null

/** Un código que pasa su expresión cerrada, o `null`. */
function code(value: unknown, pattern: RegExp): string | null {
  const text = str(value)
  return text !== undefined && pattern.test(text) ? text : null
}

/** Los códigos válidos de una lista, sin repetir y en orden. */
function codes(values: unknown[], pattern: RegExp): string[] {
  const out: string[] = []
  for (const value of values) {
    const valid = code(value, pattern)
    if (valid !== null && !out.includes(valid)) out.push(valid)
  }
  return out
}

/** Si existe un valor no vacío, sin mirar cuál. */
const present = (value: unknown): boolean =>
  Array.isArray(value)
    ? value.length > 0
    : obj(value) !== undefined || str(value) !== undefined

/** Si dos PCC son el mismo, sin devolver ninguno. `null` si falta uno. */
function samePcc(value: unknown, pcc: string): boolean | null {
  const other = str(value)?.toUpperCase()
  if (other === undefined || pcc === "") return null
  return other === pcc.toUpperCase()
}

// --- Fechas relativas --------------------------------------------------------------------

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

/** `YYYY-MM-DD` y, si hay, `HH:mm` (con o sin segundos), como UTC. */
function instant(date: unknown, time?: unknown): Date | undefined {
  const day = str(date)
  if (day === undefined || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return undefined
  const clock = /^(\d{2}):(\d{2})/.exec(str(time) ?? "")
  const at = new Date(
    `${day}T${clock === null ? "00:00" : `${clock[1]}:${clock[2]}`}:00Z`
  )
  return Number.isNaN(at.getTime()) ? undefined : at
}

/** Días enteros de calendario entre el día del censo y `date` (positivo si es futuro). */
function daysFrom(now: Date, date: unknown): number | null {
  const at = instant(date)
  if (at === undefined) return null
  const today = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  )
  return Math.round((at.getTime() - today) / DAY_MS)
}

/** Horas enteras entre el censo y `date`/`time` (positivo si es futuro). */
function hoursFrom(now: Date, date: unknown, time: unknown): number | null {
  const at = instant(date, time)
  if (at === undefined) return null
  return Math.round((at.getTime() - now.getTime()) / HOUR_MS)
}

// --- Párrafo -----------------------------------------------------------------------------

function picsOf(paragraph: QueueParagraph | undefined): CensusPic[] {
  return (paragraph?.messages ?? [])
    .filter(
      ({ instructionCode: n }) =>
        Number.isInteger(n) && ((n >= 0 && n <= 191) || (n >= 200 && n <= 254))
    )
    .map(({ instructionCode, text }) => ({
      code: instructionCode,
      text: P.picText.test(text.trim()) ? text.trim() : null,
    }))
}

/** `placedAt` tal cual llegó (con o sin año) a horas antes del censo. */
function placedAgeHours(
  placedAt: string | undefined,
  now: Date
): number | null {
  if (placedAt === undefined) return null
  const resolved = resolveHostDate(placedAt, now, { direction: "past" })
  if (resolved === undefined) return null
  const [date, time] = resolved.split("T")
  const hours = hoursFrom(now, date, time)
  return hours === null ? null : -hours
}

/** Los rasgos del PNR en pantalla, del `QueueItem` y su párrafo parseado. */
export function paragraphTraits(
  item: QueueItem,
  parsed: QueueParagraph | undefined,
  context: TraitContext
): ParagraphTraits {
  return {
    pnr: item.locator,
    pics: picsOf(parsed),
    placedAgeHours: placedAgeHours(item.placedAt, context.now),
    placedBySameAsWorkingPcc: samePcc(
      item.placedBy?.pseudoCityCode,
      context.workingPcc
    ),
    parseOk: parsed !== undefined,
    unparsedLines: parsed === undefined ? null : parsed.unparsed.length,
    maskedParagraph: maskCensusParagraph(item.paragraph),
  }
}

// --- Banderas de texto libre -------------------------------------------------------------

/**
 * Las palabras clave fijas de las banderas (ADR-026, punto 3). Se buscan como palabras en el
 * texto en mayúsculas de los OSI y los remarks, y solo sale el booleano. La lista va también en
 * el PR de #96 y en el wiki; si cambia, cambia en los tres lados.
 *
 * Las banderas no se excluyen: `AUTO CXL` es un plazo de emisión y además contiene `CXL`, así que
 * prende `mentionsTicketingDeadline` y `mentionsCancellation`. Es a propósito: un plazo de
 * cancelación automática habla de las dos cosas.
 */
export const FLAG_KEYWORDS: Record<keyof TextFlags, readonly string[]> = {
  mentionsTicketingDeadline: [
    "ADTK",
    "TKT BY",
    "TKTL",
    "TICKET BY",
    "TICKETING DEADLINE",
    "TIME LIMIT",
    "TTL",
    "PLS TKT",
    "PLEASE TICKET",
    "ISSUE BY",
    "AUTO CXL",
    "AUTOCXL",
  ],
  mentionsCancellation: [
    "CXL",
    "CXLD",
    "CANCEL",
    "CANCELED",
    "CANCELLED",
    "CANCELLATION",
    "CANX",
    "CNCL",
    "AUTO XX",
  ],
  mentionsScheduleChange: [
    "SKCHG",
    "SCHEDULE CHANGE",
    "SCHED CHG",
    "SCHG",
    "SCH CHG",
    "TIME CHANGE",
    "TIME CHG",
    "FLT CHG",
    "FLIGHT CHANGE",
    "RETIMED",
    "RETIMING",
  ],
}

const escapeRegExp = (text: string) =>
  text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

const FLAG_PATTERNS = Object.fromEntries(
  Object.entries(FLAG_KEYWORDS).map(([flag, words]) => [
    flag,
    new RegExp(
      `(?:^|[^A-Z0-9])(?:${words.map(escapeRegExp).join("|")})(?=$|[^A-Z0-9])`
    ),
  ])
) as Record<keyof TextFlags, RegExp>

function flagsOf(texts: string[]): TextFlags {
  const upper = texts.map((text) => text.toUpperCase())
  const any = (flag: keyof TextFlags) =>
    upper.some((text) => FLAG_PATTERNS[flag].test(text))
  return {
    mentionsTicketingDeadline: any("mentionsTicketingDeadline"),
    mentionsCancellation: any("mentionsCancellation"),
    mentionsScheduleChange: any("mentionsScheduleChange"),
  }
}

// --- Reserva -----------------------------------------------------------------------------

function flightTraits(flight: Json, now: Date): FlightTraits {
  const carrier = code(flight.airlineCode, P.carrier)
  const operatingCarrier = code(flight.operatingAirlineCode, P.carrier)
  const original = instant(flight.departureDate, flight.departureTime)
  const updated = instant(
    flight.updatedDepartureDate ?? flight.departureDate,
    flight.updatedDepartureTime
  )
  const changed =
    str(flight.updatedDepartureDate) !== undefined ||
    str(flight.updatedDepartureTime) !== undefined
  const seats = list(flight.seats)
  return {
    source: code(flight.sourceType, P.enumValue),
    carrier,
    operatingCarrier,
    isCodeshare:
      carrier === null || operatingCarrier === null
        ? null
        : carrier !== operatingCarrier,
    from: code(flight.fromAirportCode, P.airport),
    to: code(flight.toAirportCode, P.airport),
    international: null,
    status: code(flight.flightStatusCode, P.status),
    statusName: code(flight.flightStatusName, P.enumName),
    departureDelayMinutes:
      changed && original !== undefined && updated !== undefined
        ? Math.round((updated.getTime() - original.getTime()) / 60_000)
        : null,
    daysToDeparture: daysFrom(now, flight.departureDate),
    isPast: bool(flight.isPast),
    bookingClass: code(flight.bookingClass, P.bookingClass),
    cabin: code(flight.cabinTypeCode, P.bookingClass),
    hiddenStops: list(flight.hiddenStops).length,
    seatsAssigned: seats.filter((seat) => str(seat.number) !== undefined)
      .length,
    seatStatus: codes(
      seats.map((seat) => seat.statusCode),
      P.status
    ),
  }
}

function segmentCount(items: Json[], statusField: string): SegmentCount {
  return {
    count: items.length,
    status: codes(
      items.map((item) => item[statusField]),
      P.status
    ),
  }
}

function tripTypeOf(journeys: Json[]): BookingTraits["tripType"] {
  if (journeys.length === 0) return null
  if (journeys.length === 1) return "OW"
  const [first, second] = journeys
  if (
    journeys.length === 2 &&
    first !== undefined &&
    second !== undefined &&
    str(first.firstAirportCode) === str(second.lastAirportCode) &&
    str(first.lastAirportCode) === str(second.firstAirportCode)
  ) {
    return "RT"
  }
  return "MULTI"
}

function fareTraits(fare: Json): FareTraits {
  const construction = list(fare.fareConstruction)
  const requested = code(fare.requestedTravelerType, P.paxType)
  const priced = code(fare.pricedTravelerType, P.paxType)
  return {
    pricingType: code(fare.pricingTypeCode, /^[SAM]$/),
    pricingStatus: code(fare.pricingStatusCode, /^[AH]$/),
    hasValidPricing: bool(fare.hasValidPricing),
    isNegotiatedFare: bool(fare.isNegotiatedFare),
    hasTourCode: present(fare.tourCode),
    hasAccountCode: construction.some((part) => present(part.accountCode)),
    brand:
      construction
        .map((part) => code(part.brandFareCode, P.brand))
        .find((brand) => brand !== null) ?? null,
    travelerTypeMismatch:
      requested === null || priced === null ? null : requested !== priced,
  }
}

/** `true` si alguna regla lo dice, `false` si todas lo niegan, `null` si ninguna lo trae. */
function anyOf(values: (boolean | null)[]): boolean | null {
  const known = values.filter((value): value is boolean => value !== null)
  return known.length === 0 ? null : known.some(Boolean)
}

/** El plazo de compra más cercano de las tarifas activas (o de cualquiera, si no hay activas). */
function purchaseDeadline(fares: Json[], now: Date): number | null {
  const active = fares.filter((fare) => str(fare.pricingStatusCode) !== "H")
  const pool = active.length > 0 ? active : fares
  const hours = pool
    .map((fare) => obj(fare.creationDetails))
    .map((details) =>
      details === undefined
        ? null
        : hoursFrom(
            now,
            details.purchaseDeadlineDate,
            details.purchaseDeadlineTime
          )
    )
    .filter((value): value is number => value !== null)
  return hours.length === 0 ? null : Math.min(...hours)
}

/** Los rasgos de una reserva leída con `booking.get`. */
export function bookingTraits(
  booking: GetBookingResponse,
  context: TraitContext
): BookingTraits {
  const { now, workingPcc } = context
  const b = booking as Json
  const creation = obj(b.creationDetails)
  const flights = list(b.flights)
  const journeys = list(b.journeys)
  const fares = list(b.fares)
  const fareRules = list(b.fareRules)
  const tickets = list(b.flightTickets)
  const travelers = list(b.travelers)
  const remarks = list(b.remarks)
  const otherServices = list(b.otherServices)
  const group = obj(b.travelersGroup)
  const future = obj(b.futureTicketingPolicy)
  const payments = obj(b.payments)

  const penalties = (field: string) =>
    fareRules.flatMap((rule) => list(rule[field]))
  const allPenalties = [
    ...penalties("refundPenalties"),
    ...penalties("exchangePenalties"),
    ...penalties("cancelPenalties"),
  ]

  const remarkCounts: Record<string, number> = {}
  for (const remark of remarks) {
    const type = code(remark.type, P.enumValue) ?? "UNKNOWN"
    remarkCounts[type] = (remarkCounts[type] ?? 0) + 1
  }
  const queuePlaceTexts = remarks
    .filter((remark) => remark.type === "QUEUE_PLACE")
    .map((remark) => str(remark.text) ?? "")
  const freeTexts = [
    ...remarks.map((remark) => str(remark.text)),
    ...otherServices.map((service) => str(service.serviceMessage)),
  ].filter((text): text is string => text !== undefined)

  const coupons = tickets.flatMap((ticket) => [
    ...list(ticket.flightCoupons),
    ...list(ticket.allCoupons),
  ])

  const futureQueue = str(future?.queueNumber)

  return {
    isTicketed: bool(b.isTicketed),
    isCancelable: bool(b.isCancelable),
    daysToStart: daysFrom(now, b.startDate),
    tripLengthDays: (() => {
      const start = instant(b.startDate)
      const end = instant(b.endDate)
      return start === undefined || end === undefined
        ? null
        : Math.round((end.getTime() - start.getTime()) / DAY_MS)
    })(),
    ageDays: (() => {
      const days = daysFrom(now, creation?.creationDate)
      return days === null ? null : -days
    })(),
    hoursSinceUpdate: (() => {
      const hours = hoursFrom(
        now,
        creation?.lastUpdateDate,
        creation?.lastUpdateTime
      )
      return hours === null ? null : -hours
    })(),
    numberOfUpdates: int(creation?.numberOfUpdates),
    hoursToPurchaseDeadline:
      // El spec lo pone en `Booking.creationDetails`; en CERT llega en `fares[].creationDetails`.
      hoursFrom(
        now,
        creation?.purchaseDeadlineDate,
        creation?.purchaseDeadlineTime
      ) ?? purchaseDeadline(fares, now),
    createdInWorkingPcc: samePcc(creation?.userWorkPcc, workingPcc),
    primeHostId: code(creation?.primeHostId, P.primeHost),
    daysToRetention: daysFrom(now, b.retentionEndDate),
    hasRetention: present(b.retentionEndDate) || present(b.retentionLabel),
    hasAgencyCustomerNumber: present(b.agencyCustomerNumber),
    isGroup: group !== undefined,
    groupSize: int(group?.numberOfTravelers),
    hasCorporateProfile: present(b.profiles),
    hasEmployer: present(b.travelersEmployers),
    warnings: codes(
      [...booking.warnings, ...booking.errors].map((issue) => issue.code),
      P.warning
    ),
    flights: flights.map((flight) => flightTraits(flight, now)),
    journeys: journeys.length,
    tripType: tripTypeOf(journeys),
    hotels: segmentCount(list(b.hotels), "hotelStatusCode"),
    cars: segmentCount(list(b.cars), "carStatusCode"),
    trains: segmentCount(list(b.trains), "trainStatusCode"),
    cruises: segmentCount(list(b.cruises), "cruiseStatusCode"),
    segmentTypes: codes(
      list(b.allSegments).map((segment) => segment.type),
      P.enumValue
    ),
    fares: fares.map(fareTraits),
    currency:
      fares
        .map((fare) => code(obj(fare.totals)?.currencyCode, P.currency))
        .find((currency) => currency !== null) ?? null,
    rules: {
      isRefundable: anyOf(fareRules.map((rule) => bool(rule.isRefundable))),
      isChangeable: anyOf(fareRules.map((rule) => bool(rule.isChangeable))),
      hasNoShowCost: anyOf(allPenalties.map((p) => bool(p.hasNoShowCost))),
      conditionsApply: anyOf(allPenalties.map((p) => bool(p.conditionsApply))),
    },
    tickets: {
      count: tickets.length,
      status: codes(
        tickets.map((ticket) => ticket.ticketStatusCode),
        P.coupon
      ),
      daysSinceIssue: tickets
        .map((ticket) => daysFrom(now, ticket.date))
        .filter((days): days is number => days !== null)
        .map((days) => -days),
      couponStatus: codes(
        coupons.map((coupon) => coupon.couponStatusCode),
        P.coupon
      ),
      ticketedInWorkingPcc: anyOf(
        tickets.map((ticket) => samePcc(ticket.ticketingPcc, workingPcc))
      ),
      isBundledTicket: tickets.some(
        (ticket) => ticket.isBundledTicket === true
      ),
    },
    ancillaries: travelers.flatMap((traveler) =>
      list(traveler.ancillaries).map(
        (ancillary): AncillaryTraits => ({
          rfic: code(ancillary.reasonForIssuanceCode, P.rfic),
          subcode: code(ancillary.subcode, P.subcode),
          status: code(ancillary.statusCode, P.status),
          source: code(ancillary.source, P.enumValue),
          isRefundable: bool(ancillary.isRefundable),
        })
      )
    ),
    formsOfPayment: codes(
      list(payments?.formsOfPayment).map((payment) => payment.type),
      P.enumValue
    ),
    accountingItems: list(b.accountingItems).map(
      (item): AccountingTraits => ({
        fareApplicationType: code(item.fareApplicationType, P.enumName),
        formOfPaymentType: code(item.formOfPaymentType, P.enumName),
        creationType: code(item.creationType, P.enumName),
        tariffBasisType: code(item.tariffBasisType, P.enumName),
      })
    ),
    nonElectronicTickets: list(b.nonElectronicTickets).length,
    futureTicketing:
      future === undefined
        ? null
        : {
            queueNumber:
              futureQueue !== undefined && /^\d{1,3}$/.test(futureQueue)
                ? Number(futureQueue)
                : null,
            daysToTicketing: daysFrom(now, future.ticketingDate),
            sameAsWorkingPcc: samePcc(future.ticketingPcc, workingPcc),
          },
    ssr: list(b.specialServices)
      .map((service) => ({
        code: code(service.code, P.ssr),
        status: code(service.statusCode, P.status),
      }))
      .filter(
        (service): service is { code: string; status: string | null } =>
          service.code !== null
      ),
    osi: {
      count: otherServices.length,
      carriers: codes(
        otherServices.map((service) => service.airlineCode),
        P.carrier
      ),
    },
    remarks: remarkCounts,
    queuePlaceRemarks: parseQueuePlaces(queuePlaceTexts, workingPcc),
    queuePlaceCount: queuePlaceTexts.length,
    flags: flagsOf(freeTexts),
    pax: travelers.length,
    paxTypes: codes(
      travelers.map((traveler) => traveler.passengerCode),
      P.paxType
    ),
    hasIdentityDocuments: travelers.some((traveler) =>
      present(traveler.identityDocuments)
    ),
    hasLoyalty: travelers.some((traveler) => present(traveler.loyaltyPrograms)),
  }
}
