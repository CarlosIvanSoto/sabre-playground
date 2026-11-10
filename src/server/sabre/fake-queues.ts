import "server-only"

import {
  type QueueFakeHistoryTransaction,
  type QueueFakeOptions,
  type QueueFakePnr,
  queueFakePnrs,
  queueFixtures,
} from "sabre-client/testing"

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

/** Las opciones de `createQueueFake`, nuevas en cada llamada: el fake muta sus colas. */
export function fakeQueueOptions(): QueueFakeOptions {
  return {
    queues: {
      [FAKE_QUEUE]: withPassenger(queueFakePnrs(queueFixtures.walk)),
      [FAKE_EMPTY_QUEUE]: [],
    },
    pnrs: withPassenger(queueFakePnrs(queueFixtures.place)),
    activity: { [FAKE_QUEUE]: { ignored: 27 } },
    histories: { [FAKE_HISTORY_PNR]: FAKE_HISTORY },
  }
}

/** De dónde salen las colas del fake, para mostrarlo en la UI. */
export const FAKE_QUEUES_RECORDED_AT = queueFixtures.walk.recordedAt
