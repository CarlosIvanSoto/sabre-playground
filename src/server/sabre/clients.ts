import "server-only"

import { Sabre, type SabreConfig, SabreLegacy } from "sabre-client"
import {
  DEFAULT_ENVIRONMENT,
  type EnvironmentId,
  getEnvironment,
} from "@/server/config/environments"
import { sabreLogger } from "@/server/sabre/log"
import { fileTokenStore } from "@/server/sabre/token-store"

/**
 * Clientes de `sabre-client`, uno por entorno y por API, creados la primera vez que se piden.
 *
 * - Los dos clientes de un entorno usan el mismo `SabreConfig` (un solo juego de credenciales).
 * - El token vive en la caché en memoria de cada instancia y en `.sabre-token.json`
 *   (`fileTokenStore`), así que se reutiliza entre llamadas y entre reinicios.
 * - No hay estado atado a un usuario ni a una cookie: el cliente sale solo del entorno (el
 *   error de la v1 en `src/lib/sabre/client.ts`).
 * - Los clientes y su token nunca salen del servidor.
 */

export type ClientResult<T> =
  | { enabled: true; client: T }
  | { enabled: false; reason: string }

interface Clients {
  rest: Map<EnvironmentId, ClientResult<Sabre>>
  soap: Map<EnvironmentId, ClientResult<SabreLegacy>>
}

// En `globalThis` para que la recarga en caliente de `pnpm dev` no tire el token.
const store = globalThis as typeof globalThis & {
  [key: symbol]: Clients | undefined
}
const KEY = Symbol.for("sabre-playground.clients")
store[KEY] ??= { rest: new Map(), soap: new Map() }
const clients = store[KEY]

function create<T>(
  cache: Map<EnvironmentId, ClientResult<T>>,
  id: EnvironmentId,
  build: (config: SabreConfig) => T
): ClientResult<T> {
  const cached = cache.get(id)
  if (cached !== undefined) return cached

  const environment = getEnvironment(id)
  let result: ClientResult<T>
  if (environment === undefined) {
    result = { enabled: false, reason: `entorno ${id} no habilitado` }
  } else if (!environment.sabre.enabled) {
    result = { enabled: false, reason: environment.sabre.reason }
  } else {
    try {
      const config = environment.sabre.config
      result = {
        enabled: true,
        client: build({
          ...config,
          logger: sabreLogger,
          tokenStore: fileTokenStore,
        }),
      }
    } catch (error) {
      // Config que el SDK rechaza (p. ej. un username EPR sin formato de sesión SOAP). Los
      // mensajes del SDK nombran el campo, nunca su valor.
      const reason =
        error instanceof TypeError ? error.message : "config inválida"
      result = { enabled: false, reason }
    }
  }
  cache.set(id, result)
  return result
}

/** Cliente REST (`Sabre`) del entorno. */
export function getSabre(
  id: EnvironmentId = DEFAULT_ENVIRONMENT
): ClientResult<Sabre> {
  return create(clients.rest, id, (config) => new Sabre(config))
}

/** Cliente SOAP (`SabreLegacy`) del entorno. */
export function getSabreLegacy(
  id: EnvironmentId = DEFAULT_ENVIRONMENT
): ClientResult<SabreLegacy> {
  return create(clients.soap, id, (config) => new SabreLegacy(config))
}
