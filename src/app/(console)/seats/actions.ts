"use server"

import { seatsByPnrSchema } from "@/lib/seats"
import type { StepRun } from "@/lib/step/types"
import { getSabre } from "@/server/sabre/clients"
import { runStep } from "@/server/sabre/run-step"
import { inEnvironment } from "@/server/sabre/step-action"

/**
 * Flujo 3: el mapa de asientos de un PNR existente (F2.3, #11), con `air.getSeats` por
 * `pnrLocator` (ADR-017, `get-seats-en-el-sdk`). Es una lectura.
 *
 * - `byPnrLocator` no tiene `targetPcc`: solo lee PNR del PCC de auth.
 * - Sabre lee el PNR sin estado: no ve cambios sin confirmar.
 * - Los `warnings` y los `errors` que llegan con el mapa no lanzan: los muestra la pestaña
 *   Error.
 */
export async function getSeatsByPnr(
  environment: unknown,
  input: unknown
): Promise<StepRun> {
  return inEnvironment(environment, async (id) => {
    const parsed = seatsByPnrSchema.safeParse(input)
    if (!parsed.success) return { enabled: false, reason: "entrada inválida" }
    const sabre = getSabre(id)
    if (!sabre.enabled) return { enabled: false, reason: sabre.reason }
    return {
      enabled: true,
      step: await runStep((options) =>
        sabre.client.air.getSeats(
          { pnrLocator: parsed.data.pnrLocator },
          options
        )
      ),
    }
  })
}
