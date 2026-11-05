import "server-only"

import {
  buildCredentials,
  Sabre,
  type SabreConfig,
  SabreLegacy,
} from "sabre-client"
import { createQueueFake, type QueueFake } from "sabre-client/testing"
import type { ConsoleEnvironmentId } from "@/lib/environment"
import {
  DEFAULT_ENVIRONMENT,
  type EnvironmentId,
  getEnvironment,
} from "@/server/config/environments"
import { fakeQueueOptions } from "@/server/sabre/fake-queues"
import { sabreLogger } from "@/server/sabre/log"
import { tracedTokenStore } from "@/server/sabre/token-store"

/**
 * Clientes de `sabre-client`, uno por entorno y por API, creados la primera vez que se piden.
 *
 * - Los dos clientes de un entorno usan el mismo `SabreConfig` (un solo juego de credenciales).
 * - El token vive en la caché en memoria de cada instancia y en `.sabre-token.json`
 *   (`tracedTokenStore`), así que se reutiliza entre llamadas y entre reinicios.
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
  /** El fake detrás de `fake`: deja vencer sesiones y contar las abiertas. */
  queueFake?: QueueFake
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
          tokenStore: tracedTokenStore(id),
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
 * `SabreLegacy` del modo fake: sin red, contra `createQueueFake`, con las colas que arma
 * `fake-queues.ts` desde `queueFixtures`. Duran lo que dure el proceso, o hasta
 * `resetQueueFake()`.
 */
function fakeLegacy(): SabreLegacy {
  if (clients.queueFake === undefined) {
    clients.queueFake = createQueueFake(fakeQueueOptions())
    // Un `SabreLegacy` de antes (recarga en caliente) usaría otro fake.
    clients.fake = undefined
  }
  clients.fake ??= new SabreLegacy({
    environment: "sandbox",
    credentials: buildCredentials({
      authVersion: "v2",
      user: "0000",
      pcc: "TEST",
      password: "fake",
    }),
    fetch: clients.queueFake.fetch,
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

/**
 * Descarta el cliente REST del entorno, con su token en memoria. El SDK no tiene API para
 * invalidar el token (Q-079): la siguiente llamada crea otro `Sabre`, que busca el token en
 * el store. `SabreLegacy` no usa OAuth, así que no se toca.
 */
export function resetSabre(id: EnvironmentId): void {
  clients.rest.delete(id)
}

/** Cliente SOAP (`SabreLegacy`) del entorno. */
export function getSabreLegacy(
  id: ConsoleEnvironmentId = DEFAULT_ENVIRONMENT
): ClientResult<SabreLegacy> {
  if (id === "fake") return { enabled: true, client: fakeLegacy() }
  return create(clients.soap, id, (config) => new SabreLegacy(config))
}

/** El `QueueFake` del entorno fake, creado junto con su `SabreLegacy`. */
export function getQueueFake(): QueueFake {
  fakeLegacy()
  if (clients.queueFake === undefined) throw new Error("fake sin crear")
  return clients.queueFake
}

/**
 * Vuelve a armar el fake con las colas de las fixtures. Las sesiones abiertas en el fake
 * anterior quedan sin servidor: quien lo llame tiene que sacarlas del registro antes.
 */
export function resetQueueFake(): QueueFake {
  clients.queueFake = undefined
  clients.fake = undefined
  return getQueueFake()
}
