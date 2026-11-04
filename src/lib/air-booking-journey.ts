import type { ChosenItinerary, SearchQuery, SeatPlan } from "@/lib/air-booking"
import type { ConsoleEnvironmentId } from "@/lib/environment"

/**
 * El estado del recorrido del flujo 2 (F3.5): lo que cada paso le pasa al siguiente, qué pasos
 * ya corrieron y la invalidación. Si un paso cambia, todos los posteriores pierden su dato y
 * su panel se vacía (sube su `generation`, que es la `key` del panel).
 *
 * Vive en memoria del navegador (regla 7 del repo), y es puro: no llama a nada.
 */

export const JOURNEY_STEPS = [
  "search",
  "revalidate",
  "seats",
  "create",
  "read",
  "cleanup",
  "verify",
] as const

export type JourneyStep = (typeof JOURNEY_STEPS)[number]

/** Lo que deja el paso 1: la búsqueda que lo produjo y el itinerario elegido. */
export interface SearchSelection extends ChosenItinerary {
  /** La búsqueda tal cual se mandó: Revalidate vuelve a armar el request de BFM con ella. */
  query: SearchQuery
  /** `<grupo>:<id>` de la fila elegida. */
  key: string
}

export interface Journey {
  /** Entorno de la búsqueda: el recorrido entero corre ahí. */
  environment?: ConsoleEnvironmentId
  selection?: SearchSelection
  revalidated?: ChosenItinerary
  /** Sin decidir (`undefined`), con asientos, o saltado (`seats: []`). */
  seatPlan?: SeatPlan
  confirmationId?: string
  read: boolean
  cancelled: boolean
  /** Resultado de la comprobación final: `true` si Get Booking ya no trae vuelos. */
  verified?: boolean
  /** Pasos cuya última corrida falló. */
  failed: Partial<Record<JourneyStep, true>>
  generation: Record<JourneyStep, number>
}

export type JourneyAction =
  /** Arranca una búsqueda: lo anterior deja de valer. */
  | { type: "search"; environment: ConsoleEnvironmentId }
  | { type: "searched"; ok: boolean }
  | { type: "select"; selection: SearchSelection }
  /** Arranca una revalidación. */
  | { type: "revalidate" }
  | { type: "revalidated"; revalidated?: ChosenItinerary }
  /** Arranca la carga del mapa. */
  | { type: "loadSeats" }
  | { type: "seatsLoaded"; ok: boolean }
  | { type: "seatPlan"; plan: SeatPlan }
  | { type: "create" }
  | { type: "created"; confirmationId?: string }
  | { type: "read"; ok: boolean }
  | { type: "cancelled"; ok: boolean }
  | { type: "verified"; ok: boolean; noFlights?: boolean }
  /** Empezar de nuevo. */
  | { type: "reset" }

const zero = Object.fromEntries(
  JOURNEY_STEPS.map((step) => [step, 0])
) as Record<JourneyStep, number>

export const INITIAL_JOURNEY: Journey = {
  read: false,
  cancelled: false,
  failed: {},
  generation: zero,
}

/** Lo que cada paso aporta al estado. Al invalidar un paso, se borra. */
function clearStep(state: Journey, step: JourneyStep): Journey {
  const failed = { ...state.failed }
  delete failed[step]
  const next: Journey = {
    ...state,
    failed,
    generation: { ...state.generation, [step]: state.generation[step] + 1 },
  }
  switch (step) {
    case "search":
      return { ...next, selection: undefined, environment: undefined }
    case "revalidate":
      return { ...next, revalidated: undefined }
    case "seats":
      return { ...next, seatPlan: undefined }
    case "create":
      return { ...next, confirmationId: undefined }
    case "read":
      return { ...next, read: false }
    case "cleanup":
      return { ...next, cancelled: false }
    case "verify":
      return { ...next, verified: undefined }
  }
}

/** Invalida todos los pasos posteriores a `step`. */
function invalidateAfter(state: Journey, step: JourneyStep): Journey {
  return JOURNEY_STEPS.slice(JOURNEY_STEPS.indexOf(step) + 1).reduce(
    clearStep,
    state
  )
}

function mark(state: Journey, step: JourneyStep, ok: boolean): Journey {
  const failed = { ...state.failed }
  if (ok) delete failed[step]
  else failed[step] = true
  return { ...state, failed }
}

export function journeyReducer(state: Journey, action: JourneyAction): Journey {
  switch (action.type) {
    case "search": {
      const next = invalidateAfter(state, "search")
      return { ...next, selection: undefined, environment: action.environment }
    }
    case "searched":
      return mark(state, "search", action.ok)
    case "select":
      return {
        ...invalidateAfter(state, "search"),
        selection: action.selection,
      }
    case "revalidate":
      return { ...invalidateAfter(state, "revalidate"), revalidated: undefined }
    case "revalidated":
      return {
        ...mark(state, "revalidate", action.revalidated !== undefined),
        revalidated: action.revalidated,
      }
    case "loadSeats":
      return { ...invalidateAfter(state, "seats"), seatPlan: undefined }
    case "seatsLoaded":
      return mark(state, "seats", action.ok)
    case "seatPlan":
      return { ...invalidateAfter(state, "seats"), seatPlan: action.plan }
    case "create":
      return { ...invalidateAfter(state, "create"), confirmationId: undefined }
    case "created":
      return {
        ...mark(state, "create", action.confirmationId !== undefined),
        confirmationId: action.confirmationId,
      }
    case "read":
      return { ...mark(state, "read", action.ok), read: action.ok }
    case "cancelled": {
      // Un Cancel nuevo deja sin efecto la comprobación anterior.
      const next = invalidateAfter(mark(state, "cleanup", action.ok), "cleanup")
      return { ...next, cancelled: action.ok }
    }
    case "verified":
      return {
        ...mark(state, "verify", action.ok && action.noFlights === true),
        verified: action.ok ? action.noFlights : undefined,
      }
    case "reset":
      return JOURNEY_STEPS.reduce(clearStep, state)
  }
}

/**
 * Hay una reserva creada y sin limpiar. Mientras tanto, los pasos 1 a 4 quedan bloqueados:
 * cambiarlos invalidaría el localizador y dejaría el PNR sin cancelar.
 */
export function hasLiveBooking(state: Journey): boolean {
  return state.confirmationId !== undefined && !state.cancelled
}

export type StepStatus = "pending" | "done" | "skipped" | "failed"

/** El estado de cada paso para el indicador, con un detalle corto. */
export function stepStatus(
  state: Journey,
  step: JourneyStep
): { status: StepStatus; detail?: string } {
  if (state.failed[step]) return { status: "failed" }
  switch (step) {
    case "search":
      return state.selection === undefined
        ? { status: "pending" }
        : {
            status: "done",
            detail: state.selection.itinerary.legs
              .flatMap((leg) => leg.schedules)
              .map(
                (s) =>
                  `${s.carrier.marketing}${s.carrier.marketingFlightNumber}`
              )
              .join(" "),
          }
    case "revalidate":
      return { status: state.revalidated === undefined ? "pending" : "done" }
    case "seats":
      if (state.seatPlan === undefined) return { status: "pending" }
      return state.seatPlan.seats.length === 0
        ? { status: "skipped", detail: "sin asiento" }
        : {
            status: "done",
            detail: state.seatPlan.seats.map((seat) => seat.number).join(" "),
          }
    case "create":
      return state.confirmationId === undefined
        ? { status: "pending" }
        : { status: "done", detail: state.confirmationId }
    case "read":
      return { status: state.read ? "done" : "pending" }
    case "cleanup":
      return { status: state.cancelled ? "done" : "pending" }
    case "verify":
      if (state.verified === undefined) return { status: "pending" }
      return state.verified
        ? { status: "done", detail: "sin vuelos" }
        : { status: "failed", detail: "con vuelos" }
  }
}
