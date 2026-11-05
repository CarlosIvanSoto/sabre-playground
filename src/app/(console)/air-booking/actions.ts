"use server"

import {
  buildBookingFlightDetails,
  buildRevalidateItineraryRequest,
  buildSeatAvailabilityRequest,
} from "sabre-client"
import {
  type ChosenItinerary,
  type CreateInput,
  chosenItinerarySchema,
  createSchema,
  revalidateSchema,
  SYNTHETIC_CONTACT,
  searchSchema,
  syntheticTravelers,
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

/**
 * Paso 3, opcional (F3.3, #14): `buildSeatAvailabilityRequest` y `air.getSeats` por payload
 * (`byReservationPayload`), con el itinerario revalidado. Es una lectura.
 *
 * En CERT el mapa no es confiable: todos los asientos llegan `F` (Q-071), y uno libre en el
 * mapa puede estar ocupado en el host. Por eso el paso es opcional.
 */
export async function getSeatsForItinerary(
  environment: unknown,
  input: unknown
): Promise<StepRun> {
  return inEnvironment(environment, async (id) => {
    const parsed = chosenItinerarySchema.safeParse(input)
    if (!parsed.success) return { enabled: false, reason: "entrada inválida" }
    const sabre = getSabre(id)
    if (!sabre.enabled) return { enabled: false, reason: sabre.reason }
    const chosen = parsed.data as typeof parsed.data & ChosenItinerary
    return {
      enabled: true,
      step: await runStep((options) =>
        sabre.client.air.getSeats(buildSeatAvailabilityRequest(chosen), options)
      ),
    }
  })
}

/**
 * Paso 4 (F3.4, #15): `buildBookingFlightDetails` y `booking.create`, con el itinerario
 * revalidado y, si se eligieron, los asientos del paso 3. Los viajeros (`TEST/PASSENGER`) y el
 * contacto son sintéticos y los pone el servidor. Sin `targetPcc`: reserva en el PCC de auth.
 *
 * Es una escritura: el SDK no la reintenta y la consola tampoco. Si falla (p. ej.
 * `UNABLE_TO_BOOK_FLIGHTS_WRONG_STATUS_CODE` con un vuelo en `UC`, o `AUTH-176` con un asiento
 * ocupado en el host), el error se muestra tal cual. En producción no corre (solo lectura):
 * la UI lo deshabilita y esta action lo rechaza igual.
 *
 * Leer y cancelar la reserva usan las actions del flujo 4 (`booking/actions`).
 */
export async function createBooking(
  environment: unknown,
  input: unknown
): Promise<StepRun> {
  return inEnvironment(environment, async (id) => {
    if (id !== "fake" && getEnvironment(id)?.readOnly !== false) {
      return {
        enabled: false,
        reason: "Create Booking no corre en producción (solo lectura)",
      }
    }
    const parsed = createSchema.safeParse(input)
    if (!parsed.success) return { enabled: false, reason: "entrada inválida" }
    const sabre = getSabre(id)
    if (!sabre.enabled) return { enabled: false, reason: sabre.reason }
    const { group, itinerary, travelers, seats, seatAvailability } =
      parsed.data as typeof parsed.data & CreateInput
    return {
      enabled: true,
      step: await runStep((options) =>
        sabre.client.booking.create(
          {
            flightDetails: buildBookingFlightDetails({
              group,
              itinerary,
              seats,
              seatAvailability,
            }),
            travelers: syntheticTravelers(travelers),
            contactInfo: SYNTHETIC_CONTACT,
          },
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
