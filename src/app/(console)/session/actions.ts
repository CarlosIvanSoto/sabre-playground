"use server"

import { z } from "zod"
import type { SessionStatus } from "@/lib/session"
import type { StepRun } from "@/lib/step/types"
import { resolveEnvironment } from "@/server/config/environments"
import { getQueueFake } from "@/server/sabre/clients"
import { runStep } from "@/server/sabre/run-step"
import {
  closeRegisteredSession,
  getSessionStatus,
  openRegisteredSession,
  withRegisteredSession,
} from "@/server/sabre/sessions"
import { inEnvironment } from "@/server/sabre/step-action"

/**
 * Flujo 5: abrir, hacer ping y cerrar una sesión SOAP (F4.2, #18). La sesión queda en el
 * registro del servidor (F4.1) entre una llamada y otra. Son lecturas: corren también en
 * producción.
 */

const openSchema = z.object({ keepAlive: z.boolean() })

export async function openSession(
  environment: unknown,
  input: unknown
): Promise<StepRun> {
  return inEnvironment(environment, async (id) => {
    const parsed = openSchema.safeParse(input)
    if (!parsed.success) return { enabled: false, reason: "entrada inválida" }
    return openRegisteredSession(id, parsed.data.keepAlive)
  })
}

/** `OTA_PingRQ`: reinicia el contador de inactividad sin tocar el AAA. */
export async function pingSession(
  environment: unknown,
  _input: unknown
): Promise<StepRun> {
  return inEnvironment(environment, (id) =>
    withRegisteredSession(id, async (session, options) => {
      await session.ping(options)
      return { pinged: true, idleMs: session.idleMs }
    })
  )
}

export async function closeSession(
  environment: unknown,
  _input: unknown
): Promise<StepRun> {
  return inEnvironment(environment, closeRegisteredSession)
}

/** El estado de la sesión del navegador en el entorno, sin el token. */
export async function sessionStatus(
  environment: unknown
): Promise<SessionStatus | { error: string }> {
  const resolved = resolveEnvironment(environment)
  if (!resolved.ok) return { error: resolved.reason }
  return getSessionStatus(resolved.id)
}

/**
 * Solo en fake: vence las sesiones abiertas del fake (`QueueFake.expireSessions`). La
 * siguiente llamada recibe `SabreSessionError` `expired` y la sesión sale del registro.
 */
export async function expireFakeSessions(
  environment: unknown,
  _input: unknown
): Promise<StepRun> {
  return inEnvironment(environment, async (id) => {
    if (id !== "fake") return { enabled: false, reason: "solo en el modo fake" }
    const fake = getQueueFake()
    return {
      enabled: true,
      step: await runStep(async () => {
        fake.expireSessions()
        return { expired: true, openSessionsInFake: fake.openSessions }
      }),
    }
  })
}
