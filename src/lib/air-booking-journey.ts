import type { ChosenItinerary, SearchQuery, SeatPlan } from "@/lib/air-booking"
import type { ConsoleEnvironmentId } from "@/lib/environment"

/**
 * El estado del recorrido del flujo 2 (F3.5): lo que cada paso le pasa al siguiente, qué pasos
 * ya corrieron y la invalidación. Si un paso cambia, todos los posteriores pierden su dato y
 * su panel se vacía (sube su `generation`, que es la `key` del panel).
 *
 * Vive en memoria del navegador (regla 7 del repo), y es puro: no llama a nada.
 *
 * Es el W4 de Bruno (F16.3): después de leer la reserva se emite (`tickets.fulfill`), se vuelve a
 * leer para ver los boletos en el PNR, Limpiar los anula (`VOID`) junto con la reserva, y
 * Comprobar mira que no queden vuelos y que esos boletos estén en `TV`. Emitir es opcional: sin
 * emisión, Limpiar cancela como antes.
 */

export const JOURNEY_STEPS = [
  "search",
  "revalidate",
  "seats",
  "create",
  "read",
  "fulfill",
  "ticketRead",
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
  /** El PCC en el que se reservó (vacío, el de auth): Get, Fulfill y Cancel corren ahí. */
  targetPcc: string
  read: boolean
  /**
   * Si se pidió una emisión, haya salido bien, incierta o mal. Con una emisión pedida, Limpiar
   * espera a que se lea la reserva otra vez: los boletos que anula salen del PNR.
   */
  fulfillRequested: boolean
  /** Lo que devolvió Fulfill: `issued`/`partial`, `uncertain` o `failed`. */
  fulfillOutcome?: "issued" | "uncertain" | "failed"
  /** El Get después de emitir ya corrió. */
  ticketRead: boolean
  /** Los boletos `TE` del PNR, según el Get después de emitir. Limpiar los anula. */
  liveTickets: string[]
  cancelled: boolean
  /**
   * Resultado de la comprobación final: `true` si Get Booking ya no trae vuelos y los boletos que
   * se anularon están en `TV`.
   */
  verified?: boolean
  /** Los boletos anulados que la comprobación final no vio en `TV`. */
  notVoided?: string[]
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
  | { type: "created"; confirmationId?: string; targetPcc?: string }
  | { type: "read"; ok: boolean }
  /** Arranca una emisión. */
  | { type: "fulfill" }
  | { type: "fulfilled"; outcome: "issued" | "uncertain" | "failed" }
  /** El Get después de emitir: los boletos `TE` del PNR. */
  | { type: "ticketsRead"; ok: boolean; liveTickets?: string[] }
  | { type: "cancelled"; ok: boolean }
  /** `notVoided`: los boletos anulados que no están en `TV` (vacío si todos lo están). */
  | {
      type: "verified"
      ok: boolean
      noFlights?: boolean
      notVoided?: string[]
    }
  /** Empezar de nuevo. */
  | { type: "reset" }

const zero = Object.fromEntries(
  JOURNEY_STEPS.map((step) => [step, 0])
) as Record<JourneyStep, number>

export const INITIAL_JOURNEY: Journey = {
  targetPcc: "",
  read: false,
  fulfillRequested: false,
  ticketRead: false,
  liveTickets: [],
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
      return { ...next, confirmationId: undefined, targetPcc: "" }
    case "read":
      return { ...next, read: false }
    case "fulfill":
      return { ...next, fulfillRequested: false, fulfillOutcome: undefined }
    case "ticketRead":
      return { ...next, ticketRead: false, liveTickets: [] }
    case "cleanup":
      return { ...next, cancelled: false }
    case "verify":
      return { ...next, verified: undefined, notVoided: undefined }
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
        targetPcc: action.targetPcc ?? "",
      }
    case "read":
      return { ...mark(state, "read", action.ok), read: action.ok }
    case "fulfill":
      // Una emisión nueva deja sin efecto la lectura de boletos y lo que venía después.
      return {
        ...invalidateAfter(clearStep(state, "fulfill"), "fulfill"),
        fulfillRequested: true,
      }
    case "fulfilled":
      return {
        ...mark(state, "fulfill", action.outcome !== "failed"),
        fulfillOutcome: action.outcome,
      }
    case "ticketsRead": {
      const next = invalidateAfter(
        mark(state, "ticketRead", action.ok),
        "ticketRead"
      )
      return {
        ...next,
        ticketRead: action.ok,
        liveTickets: action.ok ? (action.liveTickets ?? []) : [],
      }
    }
    case "cancelled": {
      // Un Cancel nuevo deja sin efecto la comprobación anterior.
      const next = invalidateAfter(mark(state, "cleanup", action.ok), "cleanup")
      return { ...next, cancelled: action.ok }
    }
    case "verified": {
      const clean =
        action.noFlights === true && (action.notVoided?.length ?? 0) === 0
      return {
        ...mark(state, "verify", action.ok && clean),
        verified: action.ok ? clean : undefined,
        notVoided: action.ok ? action.notVoided : undefined,
      }
    }
    case "reset":
      return JOURNEY_STEPS.reduce(clearStep, state)
  }
}

/**
 * Por qué Limpiar todavía no se puede correr, o `undefined` si se puede. Con una emisión pedida,
 * primero se lee la reserva: los boletos que se anulan salen del PNR, no de la respuesta de
 * Fulfill (así entra también un boleto que Fulfill dio por incierto y ya está en el PNR).
 */
export function cleanupWaitingFor(state: Journey): string | undefined {
  if (state.confirmationId === undefined) return "Reserva en el paso 4."
  if (state.fulfillRequested && !state.ticketRead) {
    return "Se emitió: lee la reserva otra vez antes de limpiar, para anular los boletos que tenga."
  }
  return undefined
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
    case "fulfill":
      if (!state.fulfillRequested)
        return { status: "skipped", detail: "opcional" }
      switch (state.fulfillOutcome) {
        case undefined:
          return { status: "pending" }
        case "issued":
          return { status: "done" }
        case "uncertain":
          return { status: "failed", detail: "incierto: verificar" }
        case "failed":
          return { status: "failed" }
      }
      return { status: "pending" }
    case "ticketRead":
      if (!state.fulfillRequested) return { status: "skipped" }
      return state.ticketRead
        ? {
            status: "done",
            detail:
              state.liveTickets.length === 0
                ? "sin boletos TE"
                : `${state.liveTickets.length} TE`,
          }
        : { status: "pending" }
    case "cleanup":
      return { status: state.cancelled ? "done" : "pending" }
    case "verify":
      if (state.verified === undefined) return { status: "pending" }
      if (state.verified) {
        return {
          status: "done",
          detail:
            state.liveTickets.length === 0 ? "sin vuelos" : "sin vuelos, TV",
        }
      }
      return {
        status: "failed",
        detail:
          (state.notVoided?.length ?? 0) > 0 ? "boletos sin TV" : "con vuelos",
      }
  }
}
