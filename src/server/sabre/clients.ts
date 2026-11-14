import "server-only"

import {
  buildCredentials,
  Sabre,
  type SabreConfig,
  SabreLegacy,
} from "sabre-client"
import {
  createQueueFake,
  type QueueFake,
  type QueueFakeTicketing,
} from "sabre-client/testing"
import type { ConsoleEnvironmentId } from "@/lib/environment"
import { FAKE_PCC } from "@/lib/fake-ticketing"
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
 * - El entorno `fake` no toca la red: `SabreLegacy` y `Sabre` usan el mismo `fetch` de
 *   `createQueueFake` (`sabre-client/testing`, 0.7.0), con credenciales, colas, reservas y
 *   ventas sintéticas. Del lado REST el fake simula el token, Create, Get y Cancel Booking y
 *   Fulfill; lo demás (Bargain Finder Max, revalidar, asientos) no.
 */

export type ClientResult<T> =
  | { enabled: true; client: T }
  | { enabled: false; reason: string }

interface Clients {
  rest: Map<EnvironmentId, ClientResult<Sabre>>
  soap: Map<EnvironmentId, ClientResult<SabreLegacy>>
  fake?: SabreLegacy
  /** El cliente REST del fake, sobre el mismo `fetch` que `fake`. */
  fakeRest?: Sabre
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

/**
 * `SabreLegacy` del modo fake: sin red, contra `createQueueFake`, con las colas que arma
 * `fake-queues.ts` desde `queueFixtures`. Duran lo que dure el proceso, o hasta
 * `resetQueueFake()`.
 */
function fakeLegacy(): SabreLegacy {
  const fake = ensureQueueFake()
  clients.fake ??= new SabreLegacy({ ...fakeConfig(fake), logger: sabreLogger })
  return clients.fake
}

/** `Sabre` del modo fake: el mismo `fetch` que `fakeLegacy()`, así que ven las mismas reservas. */
function fakeRest(): Sabre {
  const fake = ensureQueueFake()
  clients.fakeRest ??= new Sabre({ ...fakeConfig(fake), logger: sabreLogger })
  return clients.fakeRest
}

function ensureQueueFake(ticketing?: QueueFakeTicketing): QueueFake {
  if (clients.queueFake === undefined) {
    clients.queueFake = createQueueFake(fakeQueueOptions(ticketing))
    // Los clientes de antes (recarga en caliente) usarían otro fake.
    clients.fake = undefined
    clients.fakeRest = undefined
  }
  return clients.queueFake
}

function fakeConfig(fake: QueueFake) {
  return {
    environment: "sandbox",
    credentials: buildCredentials({
      authVersion: "v2",
      user: "0000",
      pcc: FAKE_PCC,
      password: "fake",
    }),
    fetch: fake.fetch,
  } as const
}

/** Cliente REST (`Sabre`) del entorno. */
export function getSabre(
  id: ConsoleEnvironmentId = DEFAULT_ENVIRONMENT
): ClientResult<Sabre> {
  if (id === "fake") return { enabled: true, client: fakeRest() }
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
export function resetQueueFake(ticketing?: QueueFakeTicketing): QueueFake {
  clients.queueFake = undefined
  clients.fake = undefined
  clients.fakeRest = undefined
  return ensureQueueFake(ticketing)
}
