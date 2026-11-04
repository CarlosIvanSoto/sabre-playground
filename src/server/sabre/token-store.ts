import "server-only"

import { readFile, rename, writeFile } from "node:fs/promises"
import path from "node:path"
import type { SabreTokenStore, StoredToken } from "sabre-client"
import type { EnvironmentId } from "@/server/config/environments"

/**
 * `tokenStore` en archivo: guarda el token OAuth entre corridas (reinicios de `pnpm dev`,
 * scripts), para no pedir uno nuevo en cada arranque. El SDK lo relee antes de pedir token y
 * lo renueva solo cuando le queda poco (ver `renovacion-token-oauth` en el wiki).
 *
 * - Un solo archivo con un token por clave. La clave la arma el SDK (entorno, versión de
 *   OAuth y hash de la credencial), así que CERT y producción no se mezclan.
 * - El token es un secreto: el archivo está en `.gitignore` y se escribe con permisos `0600`.
 * - Si leer o escribir falla, el SDK sigue con su caché en memoria y avisa en el log
 *   (`sabre.auth.token.store`). Un archivo ilegible se trata como vacío y se reescribe.
 */

const FILE = path.join(process.cwd(), ".sabre-token.json")

type Tokens = Record<string, StoredToken>

async function readAll(): Promise<Tokens> {
  let text: string
  try {
    text = await readFile(FILE, "utf8")
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {}
    throw error
  }
  try {
    const parsed: unknown = JSON.parse(text)
    return typeof parsed === "object" &&
      parsed !== null &&
      !Array.isArray(parsed)
      ? (parsed as Tokens)
      : {}
  } catch {
    return {}
  }
}

// Las escrituras de este proceso van en fila, para que dos `set` seguidos no se pisen.
let queue: Promise<unknown> = Promise.resolve()

async function writeToken(key: string, token: StoredToken): Promise<void> {
  const now = Date.now()
  const tokens = Object.fromEntries(
    Object.entries(await readAll()).filter(
      ([, stored]) =>
        typeof stored?.expiresAt === "number" && stored.expiresAt > now
    )
  )
  tokens[key] = token
  // Escritura atómica: un archivo temporal y `rename`, así nunca queda un JSON a medias.
  const temporary = `${FILE}.${process.pid}.tmp`
  await writeFile(temporary, `${JSON.stringify(tokens, null, 2)}\n`, {
    mode: 0o600,
  })
  await rename(temporary, FILE)
}

export const fileTokenStore: SabreTokenStore = {
  async get(key) {
    return (await readAll())[key]
  },
  set(key, token) {
    const write = queue.then(() => writeToken(key, token))
    queue = write.catch(() => undefined)
    return write
  },
}

/**
 * Lo que la consola sabe del token de un entorno, sin su valor: la clave que usó el SDK, las
 * fechas del último token que pasó por el store y cuántas veces el SDK leyó el store. El SDK
 * no expone el token (Q-079), así que esto sale de mirar las llamadas al `tokenStore`.
 */
export interface TokenTrace {
  key?: string
  obtainedAt?: number
  expiresAt?: number
  /** Lecturas del store. Si cambia durante un paso, el SDK buscó token afuera de su memoria. */
  reads: number
}

const store = globalThis as typeof globalThis & {
  [key: symbol]: Map<EnvironmentId, TokenTrace> | undefined
}
const KEY = Symbol.for("sabre-playground.token-traces")
store[KEY] ??= new Map()
const traces = store[KEY]

export function getTokenTrace(id: EnvironmentId): TokenTrace {
  let trace = traces.get(id)
  if (trace === undefined) {
    trace = { reads: 0 }
    traces.set(id, trace)
  }
  return trace
}

/** `fileTokenStore` que anota en la traza del entorno cada lectura y escritura. */
export function tracedTokenStore(id: EnvironmentId): SabreTokenStore {
  return {
    async get(key) {
      const trace = getTokenTrace(id)
      trace.key = key
      trace.reads++
      const token = await fileTokenStore.get(key)
      if (token !== undefined) {
        trace.obtainedAt = token.obtainedAt
        trace.expiresAt = token.expiresAt
      }
      return token
    },
    async set(key, token) {
      const trace = getTokenTrace(id)
      trace.key = key
      trace.obtainedAt = token.obtainedAt
      trace.expiresAt = token.expiresAt
      await fileTokenStore.set(key, token)
    },
  }
}

/** Valor que reemplaza al token en el archivo cuando la consola lo invalida. Sabre lo rechaza. */
export const INVALID_TOKEN = "invalidado-por-sabre-playground"

/**
 * Deja en el archivo, bajo la clave del entorno, un token que Sabre va a rechazar con 401,
 * vigente para el SDK (no lo renueva antes de usarlo). Devuelve `false` si todavía no se
 * conoce la clave: el SDK no la expone, solo se ve cuando llama al store.
 */
export async function plantInvalidToken(id: EnvironmentId): Promise<boolean> {
  const trace = getTokenTrace(id)
  if (trace.key === undefined) return false
  const now = Date.now()
  await fileTokenStore.set(trace.key, {
    accessToken: INVALID_TOKEN,
    obtainedAt: now,
    expiresAt: now + 24 * 3_600_000,
  })
  return true
}
