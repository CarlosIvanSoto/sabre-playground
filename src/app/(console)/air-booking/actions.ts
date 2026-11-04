"use server"

import { buildRevalidateItineraryRequest } from "sabre-client"
import {
  type ChosenItinerary,
  revalidateSchema,
  searchSchema,
} from "@/lib/air-booking"
import type { ConsoleEnvironmentId } from "@/lib/environment"
import type { StepRun } from "@/lib/step/types"
import { getEnvironment } from "@/server/config/environments"
import { buildSearchRequest } from "@/server/sabre/air-search"
import { getSabre } from "@/server/sabre/clients"
import { runStep } from "@/server/sabre/run-step"
import { inEnvironment } from "@/server/sabre/step-action"

/**
 * Flujo 2: Air Booking de punta a punta (Fase 3). Cada paso es una server action, y lo que
 * pasa de un paso al siguiente lo guarda el cliente, en memoria.
 *
 * Las server actions son endpoints públicos: el entorno y la entrada se validan acá.
 */

/**
 * Paso 1 (F3.1, #12): `air.bargainFinderMax`. Es una lectura: el SDK reintenta los fallos
 * transitorios. Sin itinerarios, Sabre responde 200 con un `messages[]` de error y el SDK
 * lanza `SabreBusinessError`.
 */
export async function searchFlights(
  environment: unknown,
  input: unknown
): Promise<StepRun> {
  return inEnvironment(environment, async (id) => {
    const parsed = searchSchema.safeParse(input)
    if (!parsed.success) return { enabled: false, reason: "entrada inválida" }
    const sabre = getSabre(id)
    if (!sabre.enabled) return { enabled: false, reason: sabre.reason }
    const pcc = posPcc(id)
    if (pcc === undefined) return { enabled: false, reason: "falta el PCC" }
    const request = buildSearchRequest(parsed.data, pcc)
    return {
      enabled: true,
      step: await runStep((options) =>
        sabre.client.air.bargainFinderMax(request, options)
      ),
    }
  })
}

/**
 * Paso 2 (F3.2, #13): `buildRevalidateItineraryRequest` y `air.revalidateItinerary`, desde el
 * itinerario elegido en el paso 1. El request de BFM se vuelve a armar acá con la misma
 * búsqueda, para no recibir el PCC del cliente. El builder corre dentro de `runStep`: si el
 * itinerario no le sirve, su `TypeError` se ve en la pestaña Error. Es una lectura.
 */
export async function revalidateItinerary(
  environment: unknown,
  input: unknown
): Promise<StepRun> {
  return inEnvironment(environment, async (id) => {
    const parsed = revalidateSchema.safeParse(input)
    if (!parsed.success) return { enabled: false, reason: "entrada inválida" }
    const sabre = getSabre(id)
    if (!sabre.enabled) return { enabled: false, reason: sabre.reason }
    const pcc = posPcc(id)
    if (pcc === undefined) return { enabled: false, reason: "falta el PCC" }
    const { query, ...chosen } = parsed.data as typeof parsed.data &
      ChosenItinerary
    const search = buildSearchRequest(query, pcc)
    return {
      enabled: true,
      step: await runStep((options) =>
        sabre.client.air.revalidateItinerary(
          buildRevalidateItineraryRequest({ search, ...chosen }),
          options
        )
      ),
    }
  })
}

/** El PCC del EPR, para el `POS` de BFM. No sale del servidor. */
function posPcc(id: ConsoleEnvironmentId): string | undefined {
  if (id === "fake") return undefined
  const sabre = getEnvironment(id)?.sabre
  return sabre?.enabled ? sabre.pcc : undefined
}
