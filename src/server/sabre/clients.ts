import "server-only"

import {
  buildCredentials,
  Sabre,
  type SabreConfig,
  SabreLegacy,
} from "sabre-client"
import { createQueueFake } from "sabre-client/testing"
import type { ConsoleEnvironmentId } from "@/lib/environment"
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
 * - El entorno `fake` no toca la red: `SabreLegacy` usa `createQueueFake` de
 *   `sabre-client/testing`, con credenciales y colas sintéticas. REST no tiene fixtures
 *   públicas, así que en fake queda deshabilitado.
 */

export type ClientResult<T> =
  | { enabled: true; client: T }
  | { enabled: false; reason: string }

interface Clients {
  rest: Map<EnvironmentId, ClientResult<Sabre>>
  soap: Map<EnvironmentId, ClientResult<SabreLegacy>>
  fake?: SabreLegacy
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

/** Por qué REST no corre en fake. */
const FAKE_REST_REASON =
  "el modo fake no tiene fixtures REST: sabre-client/testing solo trae colas"

/**
 * `SabreLegacy` del modo fake: sin red, contra `createQueueFake`. Las colas son sintéticas y
 * duran lo que dure el proceso. El flujo de colas en fake, con `queueFixtures`, llega con
 * F5.1 (#21).
 */
function fakeLegacy(): SabreLegacy {
  clients.fake ??= new SabreLegacy({
    environment: "sandbox",
    authVersion: "v2",
    credentials: buildCredentials({
      authVersion: "v2",
      user: "0000",
      pcc: "TEST",
      password: "fake",
    }),
    fetch: createQueueFake({
      queues: {
        "12": [{ locator: "AAAAAA" }, { locator: "BBBBBB" }],
        "50": [{ locator: "CCCCCC" }],
      },
    }).fetch,
    logger: sabreLogger,
  })
  return clients.fake
}

/** Cliente REST (`Sabre`) del entorno. */
export function getSabre(
  id: ConsoleEnvironmentId = DEFAULT_ENVIRONMENT
): ClientResult<Sabre> {
  if (id === "fake") return { enabled: false, reason: FAKE_REST_REASON }
  return create(clients.rest, id, (config) => new Sabre(config))
}

/** Cliente SOAP (`SabreLegacy`) del entorno. */
export function getSabreLegacy(
  id: ConsoleEnvironmentId = DEFAULT_ENVIRONMENT
): ClientResult<SabreLegacy> {
  if (id === "fake") return { enabled: true, client: fakeLegacy() }
  return create(clients.soap, id, (config) => new SabreLegacy(config))
}
