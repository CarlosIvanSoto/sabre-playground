"use server"

import { parseQueueParagraph, type QueueStep } from "sabre-client"
import type { CensusStep } from "@/lib/queue-census"
import { queueAccessSchema, queueCountSchema } from "@/lib/queues"
import type { StepRun } from "@/lib/step/types"
import { withRegisteredSession } from "@/server/sabre/sessions"
import { inEnvironment } from "@/server/sabre/step-action"

/**
 * El censo de colas (F10.1, #95; ADR-026): solo las cuatro lecturas del recorrido, dentro de la
 * sesión registrada del navegador. Este módulo no tiene `place`, `remove` ni `process`: la ruta
 * `/queue-census` no puede escribir aunque quiera.
 *
 * Son lecturas, así que corren en todos los entornos, como en el flujo 6. El desbloqueo y la
 * confirmación de producción los pide la página antes de arrancar (ADR-026, "Cómo se toma").
 *
 * `access` e `ignore` devuelven el `QueueStep` del SDK y, si trajo un PNR, `parsed`: el párrafo
 * leído con `parseQueueParagraph` en el servidor, para que el SDK no entre al bundle del
 * cliente.
 */

const INVALID = { enabled: false, reason: "entrada inválida" } as const

/** El párrafo del PNR en pantalla, parseado. Best-effort: solo lanza con una entrada inválida. */
function withParsed(step: QueueStep): CensusStep {
  if (step.done) return step
  try {
    const paragraph = parseQueueParagraph(step.item.paragraph, {
      referenceDate: new Date(),
    })
    return { ...step, parsed: { ok: true, paragraph } }
  } catch (error) {
    return {
      ...step,
      parsed: {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
    }
  }
}

export async function censusCount(
  environment: unknown,
  input: unknown
): Promise<StepRun> {
  return inEnvironment(environment, async (id) => {
    const parsed = queueCountSchema.safeParse(input)
    if (!parsed.success) return INVALID
    return withRegisteredSession(id, (session, options) =>
      session.queue.count(parsed.data, options)
    )
  })
}

export async function censusAccess(
  environment: unknown,
  input: unknown
): Promise<StepRun> {
  return inEnvironment(environment, async (id) => {
    const parsed = queueAccessSchema.safeParse(input)
    if (!parsed.success) return INVALID
    // El censo recorre solo colas numéricas del rango 0–49.
    const { queue } = parsed.data
    if (typeof queue !== "number" || queue > 49) return INVALID
    return withRegisteredSession(id, async (session, options) =>
      withParsed(await session.queue.access(parsed.data, options))
    )
  })
}

export async function censusIgnore(
  environment: unknown,
  _input: unknown
): Promise<StepRun> {
  return inEnvironment(environment, (id) =>
    withRegisteredSession(id, async (session, options) =>
      withParsed(await session.queue.ignore(options))
    )
  )
}

export async function censusExit(
  environment: unknown,
  _input: unknown
): Promise<StepRun> {
  return inEnvironment(environment, (id) =>
    withRegisteredSession(id, async (session, options) => {
      await session.queue.exit(options)
      return { state: session.queue.state }
    })
  )
}
