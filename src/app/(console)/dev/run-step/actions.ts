"use server"

import {
  type BargainFinderMaxRequest,
  buildCredentials,
  SabreLegacy,
  type SabreSession,
} from "sabre-client"
import { createQueueFake } from "sabre-client/testing"
import { getEnvironment } from "@/server/config/environments"
import { getSabre, getSabreLegacy } from "@/server/sabre/clients"
import { sabreLogger } from "@/server/sabre/log"
import { runStep, type StepRun } from "@/server/sabre/run-step"
import { type BookingGetInput, bookingGetSchema } from "./schema"

/**
 * Pasos de prueba de `runStep` (F0.4) contra CERT, con el juego de credenciales del entorno.
 *
 * - REST: `sabre-client` no expone una forma pública de pedir el token, así que se lee una
 *   reserva. Con el localizador sintético, la primera llamada pide el token y termina en
 *   `BOOKING_NOT_FOUND` con crudo, error y log. En la segunda, el log ya no trae
 *   `sabre.auth.token.refresh`.
 * - SOAP: abre una sesión y la cierra en el mismo paso. La sesión no sale del servidor, y el
 *   crudo es el del cierre (el último intento HTTP).
 */
export async function getBooking(input: BookingGetInput): Promise<StepRun> {
  // Las server actions son endpoints públicos: se valida otra vez del lado del servidor.
  const parsed = bookingGetSchema.safeParse(input)
  if (!parsed.success) {
    return { enabled: false, reason: "localizador inválido" }
  }
  const sabre = getSabre("cert")
  if (!sabre.enabled) return { enabled: false, reason: sabre.reason }
  return {
    enabled: true,
    step: await runStep((options) =>
      sabre.client.booking.get(
        { confirmationId: parsed.data.confirmationId },
        options
      )
    ),
  }
}

export async function openAndCloseSession(): Promise<StepRun> {
  const legacy = getSabreLegacy("cert")
  if (!legacy.enabled) return { enabled: false, reason: legacy.reason }
  return {
    enabled: true,
    step: await runStep(async (options) => {
      const session: SabreSession = await legacy.client.openSession(options)
      const { idleMs } = session
      await session.close(options)
      return { idleMs, closed: true }
    }),
  }
}

/** Fecha `YYYY-MM-DD` a `days` días de hoy, en UTC. */
function inDays(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10)
}

/**
 * Un BFM de ida MEX → CUN dentro de 30 días, 1 adulto. Sirve para ver una respuesta REST
 * grande en Crudo y en Resultado. El formulario de búsqueda llega con la Fase 2.
 */
export async function searchFlights(): Promise<StepRun> {
  const sabre = getSabre("cert")
  if (!sabre.enabled) return { enabled: false, reason: sabre.reason }
  const environment = getEnvironment("cert")
  if (environment === undefined || !environment.sabre.enabled) {
    return { enabled: false, reason: "CERT sin credenciales" }
  }
  const request: BargainFinderMaxRequest = {
    OTA_AirLowFareSearchRQ: {
      Version: "5",
      POS: {
        Source: [
          {
            PseudoCityCode: environment.sabre.pcc,
            RequestorID: { Type: "1", ID: "1", CompanyName: { Code: "TN" } },
          },
        ],
      },
      OriginDestinationInformation: [
        {
          DepartureDateTime: `${inDays(30)}T10:00:00`,
          OriginLocation: { LocationCode: "MEX" },
          DestinationLocation: { LocationCode: "CUN" },
        },
      ],
      TravelerInfoSummary: {
        AirTravelerAvail: [
          { PassengerTypeQuantity: [{ Code: "ADT", Quantity: 1 }] },
        ],
      },
      TPA_Extensions: {
        IntelliSellTransaction: { RequestType: { Name: "50ITINS" } },
      },
    },
  }
  return {
    enabled: true,
    step: await runStep((options) =>
      sabre.client.air.bargainFinderMax(request, options)
    ),
  }
}

/**
 * `queue.count` contra el fake de `sabre-client/testing`, sin red ni credenciales: sirve para
 * ver un sobre SOAP de cola en Crudo. Los datos son sintéticos. El modo fake de la consola
 * llega con la Fase 4; acá el cliente se arma solo para esta prueba.
 */
export async function countFakeQueues(): Promise<StepRun> {
  const fake = createQueueFake({
    queues: {
      "12": [{ locator: "AAAAAA" }, { locator: "BBBBBB" }],
      "50": [{ locator: "CCCCCC" }],
    },
  })
  const legacy = new SabreLegacy({
    environment: "sandbox",
    authVersion: "v2",
    credentials: buildCredentials({
      authVersion: "v2",
      user: "0000",
      pcc: "TEST",
      password: "fake",
    }),
    fetch: fake.fetch,
    logger: sabreLogger,
  })
  return {
    enabled: true,
    step: await runStep((options) =>
      legacy.withSession((session) => session.queue.count({}, options))
    ),
  }
}
