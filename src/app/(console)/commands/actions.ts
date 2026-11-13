"use server"

import { z } from "zod"
import { FAKE_COMMAND_REASON, gateCommand } from "@/lib/host-command-policy"
import type { StepRun } from "@/lib/step/types"
import { getEnvironment } from "@/server/config/environments"
import { withRegisteredSession } from "@/server/sabre/sessions"
import { inEnvironment } from "@/server/sabre/step-action"

/**
 * Consola de comandos (F15.1, #149): `session.command()` sobre la sesión registrada del
 * navegador, como `/queues`.
 *
 * Las reglas por entorno del ADR-032 se aplican acá, no solo en la UI (`gateCommand`):
 *
 * - producción: solo los comandos de tipo lectura del panel, por coincidencia de prefijo;
 * - CERT: cualquiera, pero escritura, emisión y lo que no está en el panel solo con
 *   `confirmed: true` (el popover de la corrida);
 * - emitir por comando (`W¥…`) se rechaza en todos los entornos;
 * - fake: deshabilitado, porque el fake de la 0.6.0 no simula `command()`.
 *
 * La consola convierte `‡` a `¥` antes de mandar; el SDK no convierte (ADR-021, regla 4). Sin
 * reintentos (`idempotent: false`, el default): `JR` y `WPNI` se cobran más caro. La pantalla
 * y el request crudo van al historial de llamadas, como en el resto de los pasos.
 */

const schema = z.object({
  command: z.string().max(4096),
  confirmed: z.boolean().default(false),
})

export async function runCommand(
  environment: unknown,
  input: unknown
): Promise<StepRun> {
  return inEnvironment(environment, async (id) => {
    if (id === "fake") return { enabled: false, reason: FAKE_COMMAND_REASON }
    const parsed = schema.safeParse(input)
    if (!parsed.success) return { enabled: false, reason: "entrada inválida" }
    const readOnly = getEnvironment(id)?.readOnly !== false
    const gate = gateCommand(
      parsed.data.command,
      parsed.data.confirmed,
      readOnly
    )
    if (!gate.ok) return { enabled: false, reason: gate.reason }
    return withRegisteredSession(id, (session, options) =>
      session.command(gate.command, options)
    )
  })
}
