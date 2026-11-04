import "server-only"

import { readFile, rename, writeFile } from "node:fs/promises"
import path from "node:path"
import type { SabreTokenStore, StoredToken } from "sabre-client"

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
