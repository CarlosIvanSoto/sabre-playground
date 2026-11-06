"use server"

import { bookingCancelSchema, bookingGetSchema } from "@/lib/booking"
import type { StepRun } from "@/lib/step/types"
import { getEnvironment } from "@/server/config/environments"
import { getSabre } from "@/server/sabre/clients"
import { runStep } from "@/server/sabre/run-step"
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
