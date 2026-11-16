"use server"

import { dailySalesSchema } from "@/lib/daily-sales"
import type { StepRun } from "@/lib/step/types"
import { withRegisteredSession } from "@/server/sabre/sessions"
import { inEnvironment } from "@/server/sabre/step-action"

/**
 * Flujo 9: ventas del día (F16.5, #163). `session.reporting.dailySalesSummary` (ADR-030) es
 * SOAP: corre en la sesión registrada del navegador, como las colas. Es una lectura: corre en
 * CERT, en producción y en fake. Sin `pcc`, el home PCC del token; otro PCC necesita Branch
 * Access (`45100`). Sin `date`, el día en curso.
 */
export async function dailySales(
  environment: unknown,
  input: unknown
): Promise<StepRun> {
  return inEnvironment(environment, async (id) => {
    const parsed = dailySalesSchema.safeParse(input)
    if (!parsed.success) return { enabled: false, reason: "entrada inválida" }
    const { pcc, date } = parsed.data
    return withRegisteredSession(id, (session, options) =>
      session.reporting.dailySalesSummary(
        {
          ...(pcc === undefined ? {} : { pcc }),
          ...(date === undefined ? {} : { date }),
        },
        options
      )
    )
  })
}
