"use server"

import type { BargainFinderMaxRequest, SabreSession } from "sabre-client"
import { getEnvironment } from "@/server/config/environments"
import { getSabre, getSabreLegacy } from "@/server/sabre/clients"
import { runStep, type StepRun } from "@/server/sabre/run-step"
import { inEnvironment } from "@/server/sabre/step-action"
import { bookingGetSchema } from "./schema"

/**
 * Pasos de prueba de `runStep` (F0.4), en el entorno que se eligió en la consola.
 *
 * - REST: `sabre-client` no expone una forma pública de pedir el token, así que se lee una
 *   reserva. Con el localizador sintético, la primera llamada pide el token y termina en
 *   `BOOKING_NOT_FOUND` con crudo, error y log. En la segunda, el log ya no trae
 *   `sabre.auth.token.refresh`. En fake, REST queda deshabilitado con la razón.
 * - SOAP: abre una sesión y la cierra en el mismo paso. La sesión no sale del servidor, y el
 *   crudo es el del cierre (el último intento HTTP).
 *
 * Las server actions son endpoints públicos: el entorno y la entrada se validan acá.
 */
export async function getBooking(
  environment: unknown,
  input: unknown
): Promise<StepRun> {
  return inEnvironment(environment, async (id) => {
    const parsed = bookingGetSchema.safeParse(input)
    if (!parsed.success) {
      return { enabled: false, reason: "localizador inválido" }
    }
    const sabre = getSabre(id)
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
  })
}

export async function openAndCloseSession(
  environment: unknown
): Promise<StepRun> {
  return inEnvironment(environment, async (id) => {
    const legacy = getSabreLegacy(id)
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
  })
}

/** Fecha `YYYY-MM-DD` a `days` días de hoy, en UTC. */
function inDays(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10)
}

/**
 * Un BFM de ida MEX → CUN dentro de 30 días, 1 adulto. Sirve para ver una respuesta REST
 * grande en Crudo y en Resultado. El formulario de búsqueda llega con la Fase 3.
 */
export async function searchFlights(environment: unknown): Promise<StepRun> {
  return inEnvironment(environment, async (id) => {
    const sabre = getSabre(id)
    if (!sabre.enabled) return { enabled: false, reason: sabre.reason }
    const credentials = id === "fake" ? undefined : getEnvironment(id)?.sabre
    if (credentials === undefined || !credentials.enabled) {
      return { enabled: false, reason: "entorno sin credenciales" }
    }
    const request: BargainFinderMaxRequest = {
      OTA_AirLowFareSearchRQ: {
        Version: "5",
        POS: {
          Source: [
            {
              PseudoCityCode: credentials.pcc,
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
  })
}

/**
 * `queue.count` en una sesión que se abre y se cierra en el mismo paso. Es una lectura. En
 * fake corre contra `createQueueFake`, con colas sintéticas: sirve para ver un sobre SOAP de
 * cola en Crudo sin red.
 */
export async function countQueues(environment: unknown): Promise<StepRun> {
  return inEnvironment(environment, async (id) => {
    const legacy = getSabreLegacy(id)
    if (!legacy.enabled) return { enabled: false, reason: legacy.reason }
    return {
      enabled: true,
      step: await runStep((options) =>
        legacy.client.withSession((session) => session.queue.count({}, options))
      ),
    }
  })
}
