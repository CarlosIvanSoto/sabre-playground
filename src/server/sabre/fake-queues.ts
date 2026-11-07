import "server-only"

import {
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
 * Desde la 0.5.0 cada fixture tiene sus propios alias y las firmas conservan su forma
 * (`… AAAAAA H`), así que los PNR se juntan tal cual. El pasajero principal de `list` es el
 * sintético de estrategia-de-testing: `TEST/PASSENGER`.
 */

export const FAKE_QUEUE = "9"
export const FAKE_EMPTY_QUEUE = "50"
const PRIMARY_PASSENGER = "TEST/PASSENGER"

const withPassenger = (pnrs: QueueFakePnr[]): QueueFakePnr[] =>
  pnrs.map((pnr) => ({ ...pnr, primaryPassenger: PRIMARY_PASSENGER }))

/** Las opciones de `createQueueFake`, nuevas en cada llamada: el fake muta sus colas. */
export function fakeQueueOptions(): QueueFakeOptions {
  return {
    queues: {
      [FAKE_QUEUE]: withPassenger(queueFakePnrs(queueFixtures.walk)),
      [FAKE_EMPTY_QUEUE]: [],
    },
    pnrs: withPassenger(queueFakePnrs(queueFixtures.place)),
  }
}

/** De dónde salen las colas del fake, para mostrarlo en la UI. */
export const FAKE_QUEUES_RECORDED_AT = queueFixtures.walk.recordedAt
