import "server-only"

import type { DailySalesTransaction } from "sabre-client"
import {
  type QueueFakeBooking,
  type QueueFakeDailySalesDay,
  type QueueFakeHistoryTransaction,
  type QueueFakeOptions,
  type QueueFakePnr,
  type QueueFakeTicketing,
  queueFakePnrs,
  queueFixtures,
} from "sabre-client/testing"
import {
  FAKE_BOOKING_OPEN,
  FAKE_BOOKING_TICKETED,
  FAKE_PCC,
  FAKE_TICKET,
} from "@/lib/fake-ticketing"

/**
 * Las colas del modo fake (F5.1, #21; F11.3, #117), armadas con `queueFakePnrs` y
 * `queueFixtures` de `sabre-client/testing`: las respuestas anonimizadas que el Tier 3 grabó en
 * producción el 2026-11-02.
 *
 * - Cola `9`: los cuatro PNR de `walk` (`AAAAAA`–`AAAAAD`), con la fecha y la firma de su `Line`
 *   en `list`, y el párrafo que devolvieron `access` e `ignore`.
 * - Cola `50`: vacía, como `emptyQueue` (`QUEUE SELECTED WAS EMPTY`).
 * - Fuera de las colas: los PNR de `place` (`AAAAAE`–`AAAAAF`), para colocarlos con
 *   `place({ locators })`.
 *
 * - Actividad (`queue.activity`, F12.2): la `9` con 27 ignorados, para que no todo dé 0. El
 *   fake no cambia los contadores con sus acciones, y `numMessages` sale de lo que hay en la
 *   cola (no se siembra).
 * - Historial (`reservation.history`, F12.3): `AAAAAA` trae una historia sintética con varios
 *   cambios. Los demás PNR del fake dan la transacción de creación que arma el fake, y un
 *   localizador que el fake no conoce, un error de host "no simulado".
 *
 * Desde la 0.5.0 cada fixture tiene sus propios alias y las firmas conservan su forma
 * (`… AAAAAA H`), así que los PNR se juntan tal cual. El pasajero principal de `list` es el
 * sintético de estrategia-de-testing: `TEST/PASSENGER`.
 */

export const FAKE_QUEUE = "9"
export const FAKE_EMPTY_QUEUE = "50"
const PRIMARY_PASSENGER = "TEST/PASSENGER"

const withPassenger = (pnrs: QueueFakePnr[]): QueueFakePnr[] =>
  pnrs.map((pnr) => ({ ...pnr, primaryPassenger: PRIMARY_PASSENGER }))

/** El PNR con historia sembrada: el primero de la cola 9. */
export const FAKE_HISTORY_PNR = "AAAAAA"

/** Una historia sintética: creación, cambio de vuelo y un remark. Sin datos reales. */
const FAKE_HISTORY: readonly QueueFakeHistoryTransaction[] = [
  {
    rph: 1,
    createdAt: "2026-10-01T09:15",
    agent: "AAA",
    agentDutyCode: "*",
    agentFunctionCode: "A",
    pcc: "XXXX",
    aaaPcc: "XXXX",
    receivedFrom: "TEST",
    flightSegments: [
      {
        action: "AS",
        status: "HK",
        marketingAirline: "AA",
        flightNumber: "100",
        bookingClass: "Y",
        origin: "DFW",
        destination: "LAX",
        departureDateTime: "12-19T13:10",
        arrivalDateTime: "12-19T14:45",
        numberInParty: 1,
      },
    ],
    generalInfo: [
      { action: "AN", text: PRIMARY_PASSENGER },
      { action: "A9", text: "5550000000-H" },
      { action: "A7", text: "TAW/" },
    ],
  },
  {
    rph: 2,
    createdAt: "2026-10-03T16:40",
    agent: "BBB",
    agentDutyCode: "*",
    agentFunctionCode: "A",
    pcc: "XXXX",
    aaaPcc: "XXXX",
    receivedFrom: "TEST CAMBIO",
    flightSegments: [
      {
        action: "XS",
        status: "HK",
        marketingAirline: "AA",
        flightNumber: "100",
        bookingClass: "Y",
        origin: "DFW",
        destination: "LAX",
        departureDateTime: "12-19T13:10",
        arrivalDateTime: "12-19T14:45",
        numberInParty: 1,
      },
      {
        action: "AS",
        status: "HK",
        marketingAirline: "AA",
        flightNumber: "200",
        bookingClass: "Y",
        origin: "DFW",
        destination: "LAX",
        departureDateTime: "12-20T08:00",
        arrivalDateTime: "12-20T09:35",
        numberInParty: 1,
      },
    ],
    remarks: [{ action: "A5", text: "CAMBIO DE VUELO SINTETICO" }],
  },
  {
    rph: 3,
    createdAt: "2026-10-05T11:02",
    agent: "AAA",
    pcc: "XXXX",
    receivedFrom: "TEST",
    generalInfo: [{ action: "APE", text: "TEST@EXAMPLE.COM" }],
    accounting: [{ action: "HK", type: "A", linkCode: "1" }],
  },
]

/**
 * Las reservas del cliente REST en fake (F16.6, #164). El fake de la 0.7.0 devuelve una reserva
 * mínima en Get Booking (sin itinerario, tarifas ni pasajeros), un boleto por reserva, y no separa
 * por `targetPcc`:
 *
 * - `FAKE_BOOKING_OPEN`: sin boletos, para emitir.
 * - `FAKE_BOOKING_TICKETED`: con un boleto `TE`, para anular sin emitir antes.
 * - Los PNR de las colas, sin boletos, para que la hoja de reserva y el censo lean algo.
 *
 * Las que crea `booking.create` se suman solas (`FAKEAA`, `FAKEAB`…).
 */
function fakeBookings(
  pnrs: readonly QueueFakePnr[]
): Record<string, QueueFakeBooking> {
  const bookings: Record<string, QueueFakeBooking> = Object.fromEntries(
    pnrs.map((pnr) => [pnr.locator, {}])
  )
  bookings[FAKE_BOOKING_OPEN] = {}
  bookings[FAKE_BOOKING_TICKETED] = { tickets: [{ number: FAKE_TICKET }] }
  return bookings
}

/** `YYYY-MM-DD` en UTC, `days` días antes de `now`. */
function utcDate(now: Date, days: number): string {
  return new Date(now.getTime() - days * 86_400_000).toISOString().slice(0, 10)
}

/** Una venta sintética: un `SALE` de `TKT` en efectivo, con la hora sin zona. */
function sale(
  date: string,
  time: string,
  documentNumber: string,
  pnrLocator: string,
  documentStatusCode?: string
): DailySalesTransaction {
  return {
    documentType: "TKT",
    transactionCode: "SALE",
    settlementType: "ARC",
    documentNumber,
    pnrLocator,
    passengerName: PRIMARY_PASSENGER,
    airline: { code: "AA", number: "001" },
    agentSine: "AAA",
    agentPseudoCity: FAKE_PCC,
    transactionDateTime: `${date}T${time}.000`,
    electronicDocument: true,
    ...(documentStatusCode === undefined ? {} : { documentStatusCode }),
  }
}

/**
 * Las ventas del día del fake (`reporting.dailySalesSummary`, ADR-030), para el PCC de las
 * credenciales del fake, con fechas relativas a `now` (UTC):
 *
 * - Hoy, `complete`: dos ventas, una vigente y una anulada (`documentStatusCode: 'V'`, como deja
 *   el void en CERT: la venta sigue como `SALE`, no se agrega otra transacción).
 * - Ayer, `incomplete`: una venta y un documento fallido.
 * - Antier, `deferred`: sin transacciones, con `reportId`.
 *
 * Son datos sembrados: emitir o anular en el fake no los cambia.
 */
function fakeDailySales(
  now: Date
): Record<string, QueueFakeDailySalesDay | DailySalesTransaction[]> {
  const today = utcDate(now, 0)
  const yesterday = utcDate(now, 1)
  return {
    [today]: [
      sale(today, "09:12:00", "0010000000101", "AAAAAA"),
      sale(today, "10:45:30", "0010000000102", "AAAAAB", "V"),
    ],
    [yesterday]: {
      status: "incomplete",
      transactions: [sale(yesterday, "17:03:10", "0010000000103", "AAAAAC")],
      failedDocuments: ["0010000000104"],
    },
    [utcDate(now, 2)]: { status: "deferred", transactions: [] },
  }
}

/**
 * Las opciones de `createQueueFake`, nuevas en cada llamada: el fake muta sus colas y sus
 * reservas. `ticketing` son los desenlaces forzados de la emisión y del void, en orden: el fake
 * los copia al crearse y no deja cambiarlos después, así que elegir otros es rearmar el fake.
 */
export function fakeQueueOptions(
  ticketing: QueueFakeTicketing = {},
  now: Date = new Date()
): QueueFakeOptions {
  const queued = withPassenger(queueFakePnrs(queueFixtures.walk))
  const outside = withPassenger(queueFakePnrs(queueFixtures.place))
  return {
    queues: {
      [FAKE_QUEUE]: queued,
      [FAKE_EMPTY_QUEUE]: [],
    },
    pnrs: outside,
    activity: { [FAKE_QUEUE]: { ignored: 27 } },
    histories: { [FAKE_HISTORY_PNR]: FAKE_HISTORY },
    bookings: fakeBookings([...queued, ...outside]),
    ticketing,
    dailySales: { [FAKE_PCC]: fakeDailySales(now) },
  }
}

/** De dónde salen las colas del fake, para mostrarlo en la UI. */
export const FAKE_QUEUES_RECORDED_AT = queueFixtures.walk.recordedAt
