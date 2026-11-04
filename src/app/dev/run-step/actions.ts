"use server"

import type { SabreSession } from "sabre-client"
import { getSabre, getSabreLegacy } from "@/server/sabre/clients"
import { runStep, type StepResult } from "@/server/sabre/run-step"

/** Localizador sintético que no existe. */
const MISSING_LOCATOR = "AAAAAA"

type Probe<T> = { enabled: true; step: T } | { enabled: false; reason: string }

export interface ProbeResult {
  rest: Probe<StepResult<unknown>>
  soap: Probe<{ open: StepResult<unknown>; close?: StepResult<unknown> }>
}

/**
 * Prueba de `runStep` contra CERT con el juego de credenciales del entorno.
 *
 * - REST: `sabre-client` no expone una forma pública de pedir el token, así que se lee una
 *   reserva que no existe. La primera llamada pide el token y termina en `BOOKING_NOT_FOUND`
 *   con crudo, error y log. En la segunda, el log ya no trae `sabre.auth.token.refresh`.
 * - SOAP: abre una sesión y la cierra, en dos pasos. La sesión no sale del servidor.
 */
export async function probeEnvironment(): Promise<ProbeResult> {
  const sabre = getSabre("cert")
  const rest: ProbeResult["rest"] = sabre.enabled
    ? {
        enabled: true,
        step: await runStep((options) =>
          sabre.client.booking.get({ confirmationId: MISSING_LOCATOR }, options)
        ),
      }
    : { enabled: false, reason: sabre.reason }

  const legacy = getSabreLegacy("cert")
  if (!legacy.enabled) {
    return { rest, soap: { enabled: false, reason: legacy.reason } }
  }
  let session: SabreSession | undefined
  const open = await runStep(async (options) => {
    session = await legacy.client.openSession(options)
    return { idleMs: session.idleMs }
  })
  const opened: SabreSession | undefined = session
  const close =
    opened === undefined
      ? undefined
      : await runStep((options) => opened.close(options))
  return { rest, soap: { enabled: true, step: { open, close } } }
}
