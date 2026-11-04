"use server"

import {
  type InvalidateResult,
  PROBE_LOCATOR,
  type TokenInfo,
} from "@/lib/auth"
import type { StepRun } from "@/lib/step/types"
import { getEnvironment } from "@/server/config/environments"
import { getSabre, resetSabre } from "@/server/sabre/clients"
import { isSabreBusinessError } from "@/server/sabre/errors"
import { runStep } from "@/server/sabre/run-step"
import { inEnvironment } from "@/server/sabre/step-action"
import { getTokenTrace, plantInvalidToken } from "@/server/sabre/token-store"

/**
 * Flujo 1: autenticación (F2.1, #9).
 *
 * `sabre-client` 0.4.0 no tiene API pública para pedir, ver ni invalidar el token (Q-079).
 * La consola lo ve por los costados:
 *
 * - Para que el SDK pida el token, lee una reserva que no existe (`booking.get`). Si termina
 *   en un error de negocio, el token sirvió. Un error de credenciales llega como
 *   `SabreGatewayError` y queda en la pestaña Error.
 * - Si salió nuevo se ve en `sabre.auth.token.refresh` (versión, motivo y `expiresIn`). Si no
 *   aparece ese evento, salió de caché: del archivo si el SDK leyó el store, si no de memoria.
 * - Las fechas salen del último token que pasó por el `tokenStore`. El valor no sale del
 *   servidor.
 */

const REFRESH_EVENT = "sabre.auth.token.refresh"
const RETRY_EVENT = "sabre.request.retry"

/** Por qué el flujo no corre en fake. */
const FAKE_REASON =
  "el modo fake no tiene OAuth: sabre-client/testing solo trae colas"

const iso = (ms: number | undefined) =>
  ms === undefined ? undefined : new Date(ms).toISOString()

export async function requestToken(
  environment: unknown
): Promise<StepRun<TokenInfo>> {
  return inEnvironment<TokenInfo>(environment, async (id) => {
    if (id === "fake") return { enabled: false, reason: FAKE_REASON }
    const sabre = getSabre(id)
    if (!sabre.enabled) return { enabled: false, reason: sabre.reason }
    const config = getEnvironment(id)?.sabre
    if (config === undefined || !config.enabled) {
      return { enabled: false, reason: "entorno sin credenciales" }
    }

    const trace = getTokenTrace(id)
    const readsBefore = trace.reads
    const step = await runStep(async (options) => {
      try {
        await sabre.client.booking.get(
          { confirmationId: PROBE_LOCATOR },
          options
        )
        return "reserva encontrada"
      } catch (error) {
        // Un error de negocio quiere decir que el token pasó.
        if (isSabreBusinessError(error)) return error.code ?? error.name
        throw error
      }
    })
    if (!step.ok) return { enabled: true, step: { ...step, result: undefined } }

    const refresh = step.log.find((line) => line.event === REFRESH_EVENT)
    const info: TokenInfo = {
      authVersion: config.config.authVersion ?? "v3",
      source:
        refresh !== undefined
          ? "nuevo"
          : trace.reads > readsBefore
            ? "archivo"
            : "memoria",
      refreshReason: refresh?.context?.reason as string | undefined,
      expiresIn: refresh?.context?.expiresIn as number | undefined,
      obtainedAt: iso(trace.obtainedAt),
      expiresAt: iso(trace.expiresAt),
      retriedAfter401: step.log.some(
        (line) =>
          line.event === RETRY_EVENT && line.context?.reason === "unauthorized"
      ),
      probe: {
        method: "booking.get",
        confirmationId: PROBE_LOCATOR,
        outcome: step.result as string,
      },
    }
    return { enabled: true, step: { ...step, result: info } }
  })
}

/**
 * Invalida el token del entorno: descarta el cliente REST (con su token en memoria) y deja
 * en el archivo un token que Sabre rechaza. La siguiente `requestToken` lo lee del store,
 * recibe 401 y el SDK lo renueva (`reason: reactive`) y reintenta.
 */
export async function invalidateToken(environment: unknown): Promise<StepRun> {
  return inEnvironment(environment, async (id) => {
    if (id === "fake") return { enabled: false, reason: FAKE_REASON }
    const sabre = getSabre(id)
    if (!sabre.enabled) return { enabled: false, reason: sabre.reason }
    const step = await runStep(async (): Promise<InvalidateResult> => {
      resetSabre(id)
      return {
        clientRecreated: true,
        invalidTokenPlanted: await plantInvalidToken(id),
      }
    })
    return { enabled: true, step }
  })
}
