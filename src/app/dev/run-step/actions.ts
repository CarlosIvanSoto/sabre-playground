"use server"

import { getSabre } from "@/server/sabre/clients"
import { runStep, type StepResult } from "@/server/sabre/run-step"

/** Localizador sintético que no existe. */
const MISSING_LOCATOR = "AAAAAA"

export type TokenProbe =
  | { enabled: true; step: StepResult<unknown> }
  | { enabled: false; reason: string }

/**
 * Prueba de `runStep` contra CERT. `sabre-client` no expone una forma pública de pedir el
 * token, así que se lee una reserva que no existe: la primera llamada pide el token, y la
 * lectura termina en `BOOKING_NOT_FOUND` con crudo, error y log. En la segunda llamada el log
 * ya no trae `sabre.auth.token.refresh`: el token se reutilizó.
 */
export async function probeToken(): Promise<TokenProbe> {
  const sabre = getSabre("cert")
  if (!sabre.enabled) return { enabled: false, reason: sabre.reason }
  const step = await runStep((options) =>
    sabre.client.booking.get({ confirmationId: MISSING_LOCATOR }, options)
  )
  return { enabled: true, step }
}
