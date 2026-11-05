"use server"

import { parseQueueParagraph, resolveHostDate } from "sabre-client"
import {
  parseParagraphSchema,
  resolveHostDateSchema,
  toLines,
} from "@/lib/queue-paragraph"
import type { StepRun } from "@/lib/step/types"
import { runStep } from "@/server/sabre/run-step"

/**
 * Flujo 7: el parser del párrafo de cola (F4.4, #20). Sin red ni credenciales, así que no
 * depende del entorno elegido: el `StepRun` sale sin `environment`. Corre en el servidor solo
 * para que el SDK no entre al bundle del cliente.
 *
 * - `parseQueueParagraph` es best-effort: lo que no reconoce va a `unparsed`, y solo lanza
 *   `TypeError` si falta `referenceDate` o no es válida.
 * - `resolveHostDate` devuelve `undefined` si no reconoce el texto: el resultado lo muestra
 *   como `null`, sin error.
 */

export async function parseParagraph(
  _environment: unknown,
  input: unknown
): Promise<StepRun> {
  const parsed = parseParagraphSchema.safeParse(input)
  if (!parsed.success) return { enabled: false, reason: "entrada inválida" }
  const { text, referenceDate } = parsed.data
  return {
    enabled: true,
    step: await runStep(async () =>
      parseQueueParagraph(toLines(text), { referenceDate })
    ),
  }
}

export async function resolveDate(
  _environment: unknown,
  input: unknown
): Promise<StepRun> {
  const parsed = resolveHostDateSchema.safeParse(input)
  if (!parsed.success) return { enabled: false, reason: "entrada inválida" }
  const { text, referenceDate, direction } = parsed.data
  return {
    enabled: true,
    step: await runStep(async () => ({
      text,
      referenceDate,
      direction,
      // `undefined` no viaja en JSON: `null` deja ver que no se reconoció.
      resolved: resolveHostDate(text, referenceDate, { direction }) ?? null,
    })),
  }
}
