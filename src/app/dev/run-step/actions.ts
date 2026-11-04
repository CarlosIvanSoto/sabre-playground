"use server"

import type { SabreSession } from "sabre-client"
import { getSabre, getSabreLegacy } from "@/server/sabre/clients"
import { runStep, type StepRun } from "@/server/sabre/run-step"
import { type BookingGetInput, bookingGetSchema } from "./schema"

/**
 * Pasos de prueba de `runStep` (F0.4) contra CERT, con el juego de credenciales del entorno.
 *
 * - REST: `sabre-client` no expone una forma pública de pedir el token, así que se lee una
 *   reserva. Con el localizador sintético, la primera llamada pide el token y termina en
 *   `BOOKING_NOT_FOUND` con crudo, error y log. En la segunda, el log ya no trae
 *   `sabre.auth.token.refresh`.
 * - SOAP: abre una sesión y la cierra en el mismo paso. La sesión no sale del servidor, y el
 *   crudo es el del cierre (el último intento HTTP).
 */
export async function getBooking(input: BookingGetInput): Promise<StepRun> {
  // Las server actions son endpoints públicos: se valida otra vez del lado del servidor.
  const parsed = bookingGetSchema.safeParse(input)
  if (!parsed.success) {
    return { enabled: false, reason: "localizador inválido" }
  }
  const sabre = getSabre("cert")
  if (!sabre.enabled) return { enabled: false, reason: sabre.reason }
  return {
    enabled: true,
    step: await runStep((options) =>
      sabre.client.booking.get(
        { confirmationId: parsed.data.confirmationId },
        options
      )
    ),
  }
}

export async function openAndCloseSession(): Promise<StepRun> {
  const legacy = getSabreLegacy("cert")
  if (!legacy.enabled) return { enabled: false, reason: legacy.reason }
  return {
    enabled: true,
    step: await runStep(async (options) => {
      const session: SabreSession = await legacy.client.openSession(options)
      const { idleMs } = session
      await session.close(options)
      return { idleMs, closed: true }
    }),
  }
}
