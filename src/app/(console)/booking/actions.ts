"use server"

import {
  bookingCancelSchema,
  bookingGetSchema,
  reservationHistorySchema,
} from "@/lib/booking"
import {
  FAKE_BOOKING_OPEN,
  FAKE_BOOKING_TICKETED,
  FAKE_PCC,
  FAKE_TICKET,
  fakeTicketingSchema,
  toFakeTicketing,
} from "@/lib/fake-ticketing"
import type { StepRun } from "@/lib/step/types"
import {
  buildFulfillRequest,
  buildVerifyRequest,
  fulfillGate,
  fulfillSchema,
  verifySchema,
} from "@/lib/ticketing"
import { getEnvironment } from "@/server/config/environments"
import { getSabre, resetQueueFake } from "@/server/sabre/clients"
import { runStep } from "@/server/sabre/run-step"
import {
  getSessionStatus,
  withRegisteredSession,
} from "@/server/sabre/sessions"
import { inEnvironment } from "@/server/sabre/step-action"

/**
 * Flujo 4: reserva suelta (F2.2, #10). Reglas en ADR-014 (`gestion-de-reserva`):
 *
 * - `booking.get` es una lectura: el SDK reintenta 5xx y 429. Sin reserva lanza
 *   `SabreBusinessError` (`BOOKING_NOT_FOUND`); con reserva, los avisos y los errores parciales
 *   van en `warnings` y `errors` del resultado.
 * - Los dos aceptan `targetPcc` (cambio de contexto); sin él, el PCC de auth.
 * - `booking.cancel` es una escritura sin reintento, siempre con `cancelAll: true`. El SDK trata
 *   `NO_ITEMS_CANCELLED` como fallo. En producción no corre (solo lectura): la UI no lo ofrece y
 *   esta action lo rechaza igual.
 *
 * - `reservation.history` (F12.3) es SOAP: corre en la sesión registrada del navegador, como las
 *   colas, y también en fake. Dentro de una cola, Sabre lo rechaza para otro PNR que el del AAA
 *   (`NAK6`, Q-102): sale como `SabreBusinessError` y la sesión sigue en la cola.
 *
 * Las server actions son endpoints públicos: el entorno y la entrada se validan acá.
 */

export async function getBooking(
  environment: unknown,
  input: unknown
): Promise<StepRun> {
  return inEnvironment(environment, async (id) => {
    const parsed = bookingGetSchema.safeParse(input)
    if (!parsed.success) return { enabled: false, reason: "entrada inválida" }
    const sabre = getSabre(id)
    if (!sabre.enabled) return { enabled: false, reason: sabre.reason }
    const { confirmationId, surname, targetPcc } = parsed.data
    return {
      enabled: true,
      step: await runStep((options) =>
        sabre.client.booking.get(
          { confirmationId, surname, targetPcc },
          options
        )
      ),
    }
  })
}

export async function cancelBooking(
  environment: unknown,
  input: unknown
): Promise<StepRun> {
  return inEnvironment(environment, async (id) => {
    if (id !== "fake" && getEnvironment(id)?.readOnly !== false) {
      return {
        enabled: false,
        reason: "Cancel Booking no corre en producción (solo lectura)",
      }
    }
    const parsed = bookingCancelSchema.safeParse(input)
    if (!parsed.success) return { enabled: false, reason: "entrada inválida" }
    const sabre = getSabre(id)
    if (!sabre.enabled) return { enabled: false, reason: sabre.reason }
    const { confirmationId, retrieveBooking, targetPcc } = parsed.data
    return {
      enabled: true,
      step: await runStep((options) =>
        sabre.client.booking.cancel(
          { confirmationId, cancelAll: true, retrieveBooking, targetPcc },
          options
        )
      ),
    }
  })
}

/**
 * W4 (F16.2, #160): `tickets.fulfill` con la receta de S8 (`emision-de-boletos`). Mueve dinero:
 * en producción se rechaza **acá**, antes de llamar a Sabre, aunque la UI no lo ofrezca. El SDK
 * no la reintenta nunca, y la consola tampoco: ante un `SabreUncertainOutcomeError` se verifica
 * con `verifyTickets`.
 */
export async function fulfillTickets(
  environment: unknown,
  input: unknown
): Promise<StepRun> {
  return inEnvironment(environment, async (id) => {
    const gate = fulfillGate(
      id,
      id === "fake" ? undefined : getEnvironment(id)?.readOnly
    )
    if (!gate.ok) return { enabled: false, reason: gate.reason }
    const parsed = fulfillSchema.safeParse(input)
    if (!parsed.success) return { enabled: false, reason: "entrada inválida" }
    const sabre = getSabre(id)
    if (!sabre.enabled) return { enabled: false, reason: sabre.reason }
    const request = buildFulfillRequest(parsed.data)
    return {
      enabled: true,
      step: await runStep((options) =>
        sabre.client.tickets.fulfill(request, options)
      ),
    }
  })
}

/**
 * `tickets.verify` (ADR-031): un Get Booking que dice si la emisión se hizo, con
 * `ticketStatusCode` y no con `isTicketed`. Es lectura: corre en cualquier entorno. Con los
 * `tickets` del incierto como `expectedTickets`, distingue `notCommitted` (existen, no se vuelve
 * a emitir) de `notFound`.
 */
export async function verifyTickets(
  environment: unknown,
  input: unknown
): Promise<StepRun> {
  return inEnvironment(environment, async (id) => {
    const parsed = verifySchema.safeParse(input)
    if (!parsed.success) return { enabled: false, reason: "entrada inválida" }
    const sabre = getSabre(id)
    if (!sabre.enabled) return { enabled: false, reason: sabre.reason }
    const request = buildVerifyRequest(parsed.data)
    return {
      enabled: true,
      step: await runStep((options) =>
        sabre.client.tickets.verify(request, options)
      ),
    }
  })
}

export async function reservationHistory(
  environment: unknown,
  input: unknown
): Promise<StepRun> {
  return inEnvironment(environment, async (id) => {
    const parsed = reservationHistorySchema.safeParse(input)
    if (!parsed.success) return { enabled: false, reason: "entrada inválida" }
    return withRegisteredSession(id, (session, options) =>
      session.reservation.history(parsed.data.locator, options)
    )
  })
}

/**
 * Solo en fake (F16.6, #164): rearma el fake con el desenlace elegido para la siguiente emisión
 * y el siguiente void. El fake de la 0.7.0 copia sus desenlaces al crearse, así que no hay otra
 * forma: las colas, las reservas y las ventas vuelven a como se sembraron. Con una sesión
 * abierta no, como `resetFakeQueues`: quedaría apuntando a un fake que ya no existe.
 */
export async function armFakeTicketing(
  environment: unknown,
  input: unknown
): Promise<StepRun> {
  return inEnvironment(environment, async (id) => {
    if (id !== "fake") return { enabled: false, reason: "solo en el modo fake" }
    const parsed = fakeTicketingSchema.safeParse(input)
    if (!parsed.success) return { enabled: false, reason: "entrada inválida" }
    if ((await getSessionStatus(id)).open) {
      return {
        enabled: false,
        reason: "hay una sesión abierta en el fake: ciérrala primero",
      }
    }
    const ticketing = toFakeTicketing(parsed.data)
    return {
      enabled: true,
      step: await runStep(async () => {
        resetQueueFake(ticketing)
        return {
          ticketing,
          bookings: {
            [FAKE_BOOKING_OPEN]: "sin boletos, para emitir",
            [FAKE_BOOKING_TICKETED]: `con el boleto ${FAKE_TICKET} en TE, para anular`,
          },
          dailySalesPcc: FAKE_PCC,
        }
      }),
    }
  })
}
