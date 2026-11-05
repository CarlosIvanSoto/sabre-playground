"use server"

import type { QueueProcessAction } from "sabre-client"
import type { ConsoleEnvironmentId } from "@/lib/environment"
import {
  type ProcessVisit,
  parseQueueRef,
  queueAccessSchema,
  queueCountSchema,
  queueListSchema,
  queuePlaceSchema,
  queueProcessSchema,
  queueRemoveSchema,
} from "@/lib/queues"
import type { StepRun } from "@/lib/step/types"
import { getEnvironment } from "@/server/config/environments"
import { withRegisteredSession } from "@/server/sabre/sessions"
import { inEnvironment } from "@/server/sabre/step-action"

/**
 * Flujo 6: colas (F4.3, #19), dentro de la sesión registrada del navegador (F4.1).
 *
 * Permisos (decisión del usuario, 2026-11-04, plan-v2):
 * - Lecturas (`count`, `list`, `access`, `ignore`, `exit`): en todos los entornos, también
 *   en producción.
 * - `remove`, `place` y `process` con esas acciones: en CERT y fake, con la confirmación de
 *   cada corrida en la UI. En producción, además, solo con el desbloqueo explícito: sin
 *   `unlock: true`, esta action los rechaza sin llamar a Sabre.
 *
 * El fin de cola es un resultado (`{ done: true, reason }`), no un error.
 */

const INVALID = { enabled: false, reason: "entrada inválida" } as const

/** Producción sin el desbloqueo: la escritura no se corre. */
function writeBlocked(id: ConsoleEnvironmentId, unlock: boolean) {
  const readOnly = id !== "fake" && getEnvironment(id)?.readOnly !== false
  if (!readOnly || unlock) return undefined
  return {
    enabled: false as const,
    reason:
      "producción: remove y place necesitan el desbloqueo explícito de la página",
  }
}

export async function queueCount(
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

export async function queueList(
  environment: unknown,
  input: unknown
): Promise<StepRun> {
  return inEnvironment(environment, async (id) => {
    const parsed = queueListSchema.safeParse(input)
    if (!parsed.success) return INVALID
    return withRegisteredSession(id, (session, options) =>
      session.queue.list(parsed.data, options)
    )
  })
}

export async function queueAccess(
  environment: unknown,
  input: unknown
): Promise<StepRun> {
  return inEnvironment(environment, async (id) => {
    const parsed = queueAccessSchema.safeParse(input)
    if (!parsed.success) return INVALID
    return withRegisteredSession(id, (session, options) =>
      session.queue.access(parsed.data, options)
    )
  })
}

export async function queueIgnore(
  environment: unknown,
  _input: unknown
): Promise<StepRun> {
  return inEnvironment(environment, (id) =>
    withRegisteredSession(id, (session, options) =>
      session.queue.ignore(options)
    )
  )
}

export async function queueExit(
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

export async function queueRemove(
  environment: unknown,
  input: unknown
): Promise<StepRun> {
  return inEnvironment(environment, async (id) => {
    const parsed = queueRemoveSchema.safeParse(input)
    if (!parsed.success) return INVALID
    const blocked = writeBlocked(id, parsed.data.unlock)
    if (blocked !== undefined) return blocked
    const from = parsed.data.from.map((queue) => ({ queue }))
    return withRegisteredSession(id, (session, options) =>
      session.queue.remove(from.length > 0 ? { from } : {}, options)
    )
  })
}

export async function queuePlace(
  environment: unknown,
  input: unknown
): Promise<StepRun> {
  return inEnvironment(environment, async (id) => {
    const parsed = queuePlaceSchema.safeParse(input)
    if (!parsed.success) return INVALID
    const { queue, pcc, instructionCode, locators, unlock } = parsed.data
    const blocked = writeBlocked(id, unlock)
    if (blocked !== undefined) return blocked
    const to = [{ queue, pcc, instructionCode }]
    return withRegisteredSession(id, async (session, options) => {
      const result = await session.queue.place(
        locators.length > 0 ? { to, locators } : { to },
        options
      )
      // `QueueStep` dentro de una cola, `QueuePlaceResult` fuera: se distinguen con `'done' in`.
      return { kind: "done" in result ? "step" : "placed", ...result }
    })
  })
}

export async function queueProcess(
  environment: unknown,
  input: unknown
): Promise<StepRun> {
  return inEnvironment(environment, async (id) => {
    const parsed = queueProcessSchema.safeParse(input)
    if (!parsed.success) return INVALID
    const { queue, pcc, limit, action, toQueue, toInstructionCode, unlock } =
      parsed.data
    if (action !== "ignore") {
      const blocked = writeBlocked(id, unlock)
      if (blocked !== undefined) return blocked
    }
    // El esquema ya validó la cola y el PIC de destino cuando la acción es `place`.
    const destination = parseQueueRef(toQueue)
    const decision: QueueProcessAction =
      action === "place" && destination !== undefined
        ? {
            action,
            to: [
              {
                queue: destination,
                instructionCode: Number(toInstructionCode),
              },
            ],
          }
        : { action: action === "remove" ? "remove" : "ignore" }
    const visits: ProcessVisit[] = []
    return withRegisteredSession(id, async (session, options) => {
      const result = await session.queue.process(
        { queue, pcc, limit },
        (item) => {
          visits.push({ locator: item.locator, action: decision.action })
          return decision
        },
        options
      )
      return { ...result, visits }
    })
  })
}
