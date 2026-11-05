import "server-only"

import { randomUUID } from "node:crypto"
import { cookies } from "next/headers"
import type { RequestOptions, SabreSession } from "sabre-client"
import type { ConsoleEnvironmentId } from "@/lib/environment"
import type { SessionStatus } from "@/lib/session"
import type { StepRun } from "@/lib/step/types"
import { getSabreLegacy } from "@/server/sabre/clients"
import { isSabreSessionError } from "@/server/sabre/errors"
import { runStep, type StepOptions } from "@/server/sabre/run-step"

/**
 * Registro de sesiones SOAP en la memoria del servidor (F4.1, #17).
 *
 * `sabre-client` no deja retomar una sesión desde su token, así que la `SabreSession` vive acá
 * entre una server action y la siguiente. Cada navegador tiene un id en una cookie `httpOnly`
 * y, por entorno, a lo sumo una sesión. La sesión y su token nunca salen del servidor: al
 * cliente llega `SessionStatus`.
 *
 * - Una sesión que el SDK ya no puede usar sale del registro en el mismo paso: un
 *   `SabreSessionError` (`expired`, `invalid`, `limit`, `blocked`) o un `TypeError`
 *   `session unusable` / `session closed`. Así una sesión vencida se limpia sola al siguiente
 *   uso. `session busy` no la saca: es otra llamada en vuelo.
 * - Un barrido cada minuto saca las que llevan más de 35 minutos sin respuesta de Sabre (el
 *   vencimiento real es de 16 a 31): el navegador que la abrió ya no volvió.
 * - Al apagar el servidor (`SIGINT`, `SIGTERM`) se cierran todas, con un tope de 3 s. Para eso
 *   `pnpm dev` y `pnpm start` corren con `NEXT_MANUAL_SIG_HANDLE=true`: si no, Next sale con
 *   `process.exit` sin esperar los `SessionCloseRQ`. En dev, `NEXT_EXIT_TIMEOUT_MS=4000` le da
 *   al proceso hijo ese tiempo antes del `SIGKILL` del padre (por defecto, 100 ms). Un
 *   `kill -9` las deja vivas en Sabre hasta que vencen.
 * - En `pnpm dev`, el registro vive en `globalThis` y sobrevive a la recarga en caliente, con
 *   las clases de la evaluación anterior del SDK. Por eso los errores se comparan por `name`
 *   (Q-083) y no se pierde la referencia a ninguna sesión abierta.
 */

const COOKIE = "sabre-pg-console"

/** Sin respuesta de Sabre por más de esto, la sesión ya venció seguro. */
const STALE_MS = 35 * 60 * 1000
const SWEEP_EVERY_MS = 60 * 1000
const SHUTDOWN_TIMEOUT_MS = 3000

interface Entry {
  owner: string
  environment: ConsoleEnvironmentId
  session: SabreSession
  openedAt: Date
  keepAlive: boolean
}

interface Registry {
  entries: Map<string, Entry>
  sweeper?: NodeJS.Timeout
  shutdownHooked?: boolean
}

const store = globalThis as typeof globalThis & {
  [key: symbol]: Registry | undefined
}
const KEY = Symbol.for("sabre-playground.sessions")
store[KEY] ??= { entries: new Map() }
const registry = store[KEY]

const keyOf = (owner: string, environment: ConsoleEnvironmentId) =>
  `${owner}:${environment}`

/** El id del navegador. `create` solo funciona en una server action, que puede poner cookies. */
async function owner(create: boolean): Promise<string | undefined> {
  const jar = await cookies()
  const current = jar.get(COOKIE)?.value
  if (current !== undefined && /^[0-9a-f-]{36}$/.test(current)) return current
  if (!create) return undefined
  const id = randomUUID()
  jar.set(COOKIE, id, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  })
  return id
}

/** Si el error deja la sesión inservible del lado del SDK. */
function isUnusable(error: unknown): boolean {
  if (isSabreSessionError(error)) return true
  return (
    error instanceof TypeError &&
    /^session (unusable|closed)\b/.test(error.message)
  )
}

/** Saca la entrada y cierra su sesión, sin lanzar. Una sesión inutilizable cierra sin red. */
async function discard(key: string, entry: Entry): Promise<void> {
  if (registry.entries.get(key) === entry) registry.entries.delete(key)
  try {
    await entry.session.close()
  } catch {
    // `close()` falla solo si falla la red; la sesión vence sola en Sabre.
  }
}

function sweep(): void {
  for (const [key, entry] of registry.entries) {
    if (entry.session.idleMs > STALE_MS) void discard(key, entry)
  }
}

registry.sweeper ??= setInterval(sweep, SWEEP_EVERY_MS)
registry.sweeper.unref()

/** Cierra todas las sesiones del registro, con un tope de tiempo. */
export async function closeAllSessions(): Promise<number> {
  const entries = [...registry.entries]
  registry.entries.clear()
  const timeout = new Promise((resolve) =>
    setTimeout(resolve, SHUTDOWN_TIMEOUT_MS).unref()
  )
  await Promise.race([
    Promise.allSettled(entries.map(([, entry]) => entry.session.close())),
    timeout,
  ])
  return entries.length
}

/** Lo llama `instrumentation.ts` una vez por proceso. */
export function hookShutdown(): void {
  if (registry.shutdownHooked) return
  registry.shutdownHooked = true
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => {
      void closeAllSessions().then((count) => {
        if (count > 0) {
          console.info(`[sabre-playground] ${count} sesión(es) SOAP cerradas`)
        }
        process.exit(signal === "SIGINT" ? 130 : 143)
      })
    })
  }
}

function status(
  environment: ConsoleEnvironmentId,
  entry: Entry | undefined
): SessionStatus {
  if (entry === undefined) return { open: false, environment }
  return {
    open: true,
    environment,
    openedAt: entry.openedAt.toISOString(),
    keepAlive: entry.keepAlive,
    idleMs: entry.session.idleMs,
    at: new Date().toISOString(),
    queueState: entry.session.queue.state,
  }
}

/** El estado de la sesión del navegador en ese entorno. No crea la cookie. */
export async function getSessionStatus(
  environment: ConsoleEnvironmentId
): Promise<SessionStatus> {
  const id = await owner(false)
  const entry =
    id === undefined ? undefined : registry.entries.get(keyOf(id, environment))
  return status(environment, entry)
}

/** Cuántas sesiones hay en el registro, de todos los navegadores. */
export function registeredSessions(): number {
  return registry.entries.size
}

/**
 * Abre una sesión y la registra. Si el navegador ya tiene una en ese entorno, no abre otra: el
 * límite es de 50 por PCC y una sesión olvidada ocupa su lugar hasta vencer.
 */
export async function openRegisteredSession(
  environment: ConsoleEnvironmentId,
  keepAlive: boolean
): Promise<StepRun> {
  const id = await owner(true)
  if (id === undefined) return { enabled: false, reason: "sin cookie" }
  const key = keyOf(id, environment)
  if (registry.entries.has(key)) {
    return {
      enabled: false,
      reason: "ya hay una sesión abierta en este entorno: ciérrala primero",
    }
  }
  const legacy = getSabreLegacy(environment)
  if (!legacy.enabled) return { enabled: false, reason: legacy.reason }

  let opened: SabreSession | undefined
  const step = await runStep(async (options) => {
    opened = await legacy.client.openSession({ ...options, keepAlive })
    return { keepAlive, queueState: opened.queue.state }
  })
  if (opened !== undefined) {
    registry.entries.set(key, {
      owner: id,
      environment,
      session: opened,
      openedAt: new Date(),
      keepAlive,
    })
  }
  return { enabled: true, step }
}

/**
 * Corre `call` con la sesión registrada del navegador. Si el SDK la deja inservible, sale del
 * registro en el mismo paso.
 */
export async function withRegisteredSession<T>(
  environment: ConsoleEnvironmentId,
  call: (session: SabreSession, options: StepOptions) => Promise<T>
): Promise<StepRun<T>> {
  const id = await owner(false)
  const key = id === undefined ? undefined : keyOf(id, environment)
  const entry = key === undefined ? undefined : registry.entries.get(key)
  if (key === undefined || entry === undefined) {
    return { enabled: false, reason: "no hay una sesión abierta" }
  }
  let thrown: unknown
  const step = await runStep(async (options) => {
    try {
      return await call(entry.session, options)
    } catch (error) {
      thrown = error
      throw error
    }
  })
  if (thrown !== undefined && isUnusable(thrown)) await discard(key, entry)
  return { enabled: true, step }
}

/** Cierra la sesión registrada del navegador. Sale del registro aunque el cierre falle. */
export async function closeRegisteredSession(
  environment: ConsoleEnvironmentId
): Promise<StepRun> {
  const id = await owner(false)
  const key = id === undefined ? undefined : keyOf(id, environment)
  const entry = key === undefined ? undefined : registry.entries.get(key)
  if (key === undefined || entry === undefined) {
    return { enabled: false, reason: "no hay una sesión abierta" }
  }
  registry.entries.delete(key)
  const step = await runStep(async (options: RequestOptions) => {
    await entry.session.close(options)
    return { closed: true }
  })
  return { enabled: true, step }
}
