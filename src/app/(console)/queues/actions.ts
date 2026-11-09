"use server"

import type { QueueProcessAction } from "sabre-client"
import type { QueueFake } from "sabre-client/testing"
import type { ConsoleEnvironmentId } from "@/lib/environment"
import {
  type ProcessVisit,
  parseQueueRef,
  queueAccessSchema,
  queueActivitySchema,
  queueCountSchema,
  queueListSchema,
  queuePlaceSchema,
  queueProcessSchema,
  queueRemoveSchema,
} from "@/lib/queues"
import type { StepRun } from "@/lib/step/types"
import { getEnvironment } from "@/server/config/environments"
import { getQueueFake, resetQueueFake } from "@/server/sabre/clients"
import {
  FAKE_EMPTY_QUEUE,
  FAKE_QUEUE,
  FAKE_QUEUES_RECORDED_AT,
} from "@/server/sabre/fake-queues"
import { runStep } from "@/server/sabre/run-step"
import {
  getSessionStatus,
  withRegisteredSession,
} from "@/server/sabre/sessions"
import { inEnvironment } from "@/server/sabre/step-action"

/**
 * Flujo 6: colas (F4.3, #19), dentro de la sesión registrada del navegador (F4.1).
 *
 * Permisos (decisión del usuario, 2026-11-04, plan-v2):
 * - Lecturas (`count`, `activity`, `list`, `access`, `ignore`, `exit`): en todos los entornos, también
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

/** Lectura, como `count`: no cambia `state` y se puede llamar dentro o fuera de una cola. */
export async function queueActivity(
  environment: unknown,
  input: unknown
): Promise<StepRun> {
  return inEnvironment(environment, async (id) => {
    const parsed = queueActivitySchema.safeParse(input)
    if (!parsed.success) return INVALID
    return withRegisteredSession(id, (session, options) =>
      session.queue.activity(parsed.data, options)
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

/** Lo que hay en el fake: sus colas, las llamadas que recibió y las sesiones abiertas. */
function fakeSnapshot(fake: QueueFake) {
  return {
    recordedAt: FAKE_QUEUES_RECORDED_AT,
    queues: {
      [FAKE_QUEUE]: fake.locators(Number(FAKE_QUEUE)),
      [FAKE_EMPTY_QUEUE]: fake.locators(Number(FAKE_EMPTY_QUEUE)),
    },
    openSessions: fake.openSessions,
    calls: fake.calls.length,
    lastCalls: fake.calls.slice(-10),
  }
}

/** Solo en fake: el contenido de las colas del fake (`QueueFake.locators`) y sus llamadas. */
export async function fakeQueues(
  environment: unknown,
  _input: unknown
): Promise<StepRun> {
  return inEnvironment(environment, async (id) => {
    if (id !== "fake") return { enabled: false, reason: "solo en el modo fake" }
    return {
      enabled: true,
      step: await runStep(async () => fakeSnapshot(getQueueFake())),
    }
  })
}

/**
 * Solo en fake: vuelve a armar las colas desde `queueFixtures`, después de un `remove` o un
 * `place`. Con una sesión abierta no: quedaría apuntando a un fake que ya no existe.
 */
export async function resetFakeQueues(
  environment: unknown,
  _input: unknown
): Promise<StepRun> {
  return inEnvironment(environment, async (id) => {
    if (id !== "fake") return { enabled: false, reason: "solo en el modo fake" }
    if ((await getSessionStatus(id)).open) {
      return {
        enabled: false,
        reason: "hay una sesión abierta en el fake: ciérrala primero",
      }
    }
    return {
      enabled: true,
      step: await runStep(async () => fakeSnapshot(resetQueueFake())),
    }
  })
}
