/**
 * Los rasgos del censo de colas (F10.2, #96; ADR-026, "Rasgos de la reserva"): lo único que
 * llega al navegador de cada PNR. Se calculan en el servidor (`src/server/census/traits.ts`) y
 * cada campo es un número, un booleano, un enum o un código que pasa una expresión cerrada.
 * Nada de texto libre, importes, nombres, PCC ni identificadores, salvo el localizador en `pnr`.
 *
 * Lo que el SDK o la respuesta no traen queda en `null`: no se inventa.
 *
 * Este módulo lo usan el cliente y el servidor: solo tipos y expresiones.
 */

/** Las expresiones cerradas de los códigos (ADR-026, "Validación que falla cerrada"). */
export const TRAIT_PATTERNS = {
  /** El localizador del PNR. */
  pnr: /^[A-Z0-9]{6}$/,
  /** El texto de un PIC. */
  picText: /^[A-Z0-9 /.-]{1,40}$/,
  /** Estado de segmento, SSR o asiento: `HK`, `UN`, `KK`. */
  status: /^[A-Z]{2}$/,
  /** Aerolínea: `AM`, `9W`. */
  carrier: /^[A-Z0-9]{2}$/,
  /** Aeropuerto: `MEX`. */
  airport: /^[A-Z]{3}$/,
  /** Clase de reserva o cabina: `Y`, `O`. */
  bookingClass: /^[A-Z]$/,
  /** Código de SSR: `DOCS`, `ADTK`, `WCHR`. */
  ssr: /^[A-Z]{4}$/,
  /** Tipo de pasajero: `ADT`, `CNN`, `INF`, `C05`. */
  paxType: /^[A-Z][A-Z0-9]{2}$/,
  /** Un enum de la respuesta: `ATPCO`, `PAYMENTCARD`, `QUEUE_PLACE`. */
  enumValue: /^[A-Z][A-Z0-9_]{0,29}$/,
  /** Un enum con nombre legible del spec: `Confirmed with EMD issued`, `Single Traveler`. */
  enumName: /^[A-Za-z][A-Za-z0-9 /&-]{0,39}$/,
  /** Estado de cupón: `I`, `E`, `RF`, `PR`. */
  coupon: /^[A-Z]{1,2}$/,
  /** RFIC y subcódigo de una ancillary: `C`, `0CC`. */
  rfic: /^[A-Z]$/,
  subcode: /^[A-Z0-9]{3}$/,
  /** Código de marca: `MAIN`, `LIGHT`. */
  brand: /^[A-Z0-9]{1,10}$/,
  /** Moneda: `MXN`. */
  currency: /^[A-Z]{3}$/,
  /** `primeHostId`: `1S`, `1B`. */
  primeHost: /^[A-Z0-9]{2}$/,
  /** Código de error o aviso del SDK: `UNDETERMINED_FLIGHT_STATUS_CODE`. */
  warning: /^[A-Z][A-Z0-9_]{0,59}$/,
} as const

/** Un PIC del párrafo: código (0–191 o 200–254) y texto, si pasa la expresión. */
export interface CensusPic {
  code: number
  /** `null` si el texto no pasa `TRAIT_PATTERNS.picText`: no se manda texto libre. */
  text: string | null
}

/** Lo que se toma del párrafo de `access` o `ignore`. */
export interface ParagraphTraits {
  /** El localizador real: el único identificador del censo. */
  pnr: string
  pics: CensusPic[]
  /** Horas entre `placedAt` y el censo. Es una cota (Q-034): parece la última modificación. */
  placedAgeHours: number | null
  /** Si quien colocó el PNR (`placedBy.pseudoCityCode`) es el PCC de trabajo, sin el PCC. */
  placedBySameAsWorkingPcc: boolean | null
  /** Si `parseQueueParagraph` leyó el párrafo sin lanzar. */
  parseOk: boolean
  /** Cuántas líneas quedaron en `unparsed`. */
  unparsedLines: number | null
  /**
   * El párrafo enmascarado con la regla de #96 (ADR-018): la lista blanca tal cual y el resto con
   * letras a `X` y dígitos a `9`. Solo entra a la exportación si el usuario marca el PNR (F10.3).
   */
  maskedParagraph: string[]
}

export interface FlightTraits {
  /** `ATPCO`, `LCC`, `NDC`. */
  source: string | null
  carrier: string | null
  operatingCarrier: string | null
  isCodeshare: boolean | null
  from: string | null
  to: string | null
  /** La respuesta no trae el país del aeropuerto: queda en `null` (hallazgo). */
  international: boolean | null
  status: string | null
  /** `flightStatusName`, el enum del spec. */
  statusName: string | null
  /**
   * Minutos entre `updatedDeparture*` y la salida original; `null` si no hay. Según el spec v1.33,
   * `updatedDeparture*` es la salida **estimada o real** (demoras cerca de la salida), no un
   * cambio de horario del itinerario: ese se ve en `status` (`UN`, `TK`, `SC`, `WK`). En el
   * primer censo de producción vino `null` en los 393 vuelos (Q-091). El nombre queda por
   * `queue-census/1`.
   */
  scheduleChangeMinutes: number | null
  daysToDeparture: number | null
  isPast: boolean | null
  bookingClass: string | null
  cabin: string | null
  hiddenStops: number
  seatsAssigned: number
  seatStatus: string[]
}

export interface SegmentCount {
  count: number
  /** Los códigos de estado, tal cual (`HK`, `GK`). */
  status: string[]
}

export interface FareTraits {
  /** `S`, `A`, `M`. */
  pricingType: string | null
  /** `A`, `H`. */
  pricingStatus: string | null
  hasValidPricing: boolean | null
  isNegotiatedFare: boolean | null
  hasTourCode: boolean
  hasAccountCode: boolean
  brand: string | null
  /** `requestedTravelerType` distinto de `pricedTravelerType`. */
  travelerTypeMismatch: boolean | null
}

export interface RuleTraits {
  /** `true` si alguna regla lo dice; `null` sin reglas. */
  isRefundable: boolean | null
  isChangeable: boolean | null
  hasNoShowCost: boolean | null
  conditionsApply: boolean | null
}

export interface TicketTraits {
  count: number
  /** `ticketStatusCode` de cada boleto. */
  status: string[]
  daysSinceIssue: number[]
  /** Estados de cupón de todos los boletos, sin repetir. */
  couponStatus: string[]
  ticketedInWorkingPcc: boolean | null
  isBundledTicket: boolean
}

export interface AncillaryTraits {
  rfic: string | null
  subcode: string | null
  status: string | null
  /** `ATPCO`, `MERCHANDISING_MANAGER`. */
  source: string | null
  isRefundable: boolean | null
}

export interface AccountingTraits {
  fareApplicationType: string | null
  formOfPaymentType: string | null
  creationType: string | null
  tariffBasisType: string | null
}

export interface FutureTicketingTraits {
  queueNumber: number | null
  daysToTicketing: number | null
  sameAsWorkingPcc: boolean | null
}

export interface QueuePlaceRemark {
  queue: number
  pic: number
}

export interface TextFlags {
  mentionsTicketingDeadline: boolean
  mentionsCancellation: boolean
  mentionsScheduleChange: boolean
}

/** Los rasgos de `booking.get`, por las tablas de ADR-026. */
export interface BookingTraits {
  // Reserva
  isTicketed: boolean | null
  isCancelable: boolean | null
  daysToStart: number | null
  tripLengthDays: number | null
  ageDays: number | null
  hoursSinceUpdate: number | null
  numberOfUpdates: number | null
  /** El `TAW` como dato: negativo si venció. Sale de `fares[].creationDetails` (hallazgo). */
  hoursToPurchaseDeadline: number | null
  createdInWorkingPcc: boolean | null
  primeHostId: string | null
  daysToRetention: number | null
  hasRetention: boolean
  hasAgencyCustomerNumber: boolean
  isGroup: boolean
  groupSize: number | null
  hasCorporateProfile: boolean
  hasEmployer: boolean
  /** Solo el código de los avisos y errores parciales. */
  warnings: string[]
  // Vuelos
  flights: FlightTraits[]
  journeys: number
  tripType: "OW" | "RT" | "MULTI" | null
  hotels: SegmentCount
  cars: SegmentCount
  trains: SegmentCount
  cruises: SegmentCount
  segmentTypes: string[]
  // Tarifa y reglas
  fares: FareTraits[]
  currency: string | null
  rules: RuleTraits
  // Boletos, EMD y pago
  tickets: TicketTraits
  ancillaries: AncillaryTraits[]
  formsOfPayment: string[]
  accountingItems: AccountingTraits[]
  nonElectronicTickets: number
  futureTicketing: FutureTicketingTraits | null
  // Servicios y remarks
  ssr: { code: string; status: string | null }[]
  osi: { count: number; carriers: string[] }
  /** Conteo de remarks por `type`. */
  remarks: Record<string, number>
  /** Las colocaciones programadas, si todas salen con la expresión cerrada; si no, `null`. */
  queuePlaceRemarks: QueuePlaceRemark[] | null
  queuePlaceCount: number
  flags: TextFlags
  // Pasajeros: solo conteos
  pax: number
  paxTypes: string[]
  hasIdentityDocuments: boolean
  hasLoyalty: boolean
}
