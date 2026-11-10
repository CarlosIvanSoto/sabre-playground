import type {
  QueueActivityCounters,
  QueueActivityResponse,
  QueueCountResponse,
  QueueSelection,
} from "sabre-client"
import {
  initialQueueJourney,
  type QueueJourney,
  type QueuePanel,
  queueJourneyReducer,
} from "@/lib/queue-journey"
import { formatQueueRef } from "@/lib/queues"
import type { StepRun } from "@/lib/step/types"

/**
 * El estado de la mesa de colas (ADR-025, `/queue-desk`). Vive en un `useReducer` en la raíz
 * de la mesa, en la memoria del navegador (regla 7), y es puro: no llama a nada.
 *
 * El cursor de la cola es el mismo `queue-journey` del flujo 6. La mesa le suma el conteo de
 * la izquierda, el total de la cola al entrar (para `n de N`) y el último paso del cursor, que
 * es lo que se ve en el centro, los destinos recientes y el conteo estimado de mover y sacar
 * (F9.3), el localizador abierto en la hoja de reserva (F9.4) y el PCC de trabajo (F9.6). Como
 * la mesa es una sola página, no depende de ADR-024 (Zustand).
 *
 * El PCC de trabajo se pasa en cada operación (`pcc` en colas, `targetPcc` en REST); la sesión
 * SOAP sigue siendo la misma. Vacío es el PCC de la sesión.
 */

/** Una fila del conteo, ya en texto. */
export interface DeskQueue {
  /** La cola como texto: `9`, `S`. */
  queue: string
  count: number
  /** Cola con nombre: se ve, pero no se entra (Q-086). */
  named: boolean
}

export interface DeskCount {
  queues: DeskQueue[]
  /**
   * Colas ajustadas en el navegador después de un `place` o un `remove` (−1 / +1), hasta el
   * siguiente ⟳. No se corre `count` después de cada escritura (ADR-025).
   */
  estimated: string[]
  totals: QueueCountResponse["totals"]
  /** `QueueInfo@DateTime` tal cual, sin año. */
  countedAt?: string
  /** `AdditionalQueueInfo`, si llegó (0.6.0): tal cual, ninguna respuesta real lo trajo aún. */
  additionalInfo?: QueueCountResponse["additionalInfo"]
}

/**
 * Los contadores de `queue.activity` (F12.2), por cola en texto. Solo con el check «Actividad»
 * de la mesa (F13.3): se piden al prenderlo y después de cada `count`, y no se ajustan con mover
 * o sacar: valen lo del último ⟳. No se interpretan (Q-097).
 */
export interface DeskActivity {
  queues: Record<string, QueueActivityCounters>
  /** Colas que no están en el conteo pero tienen contadores (Sabre lista las vacías). */
  emptyWithCounters: string[]
  analyzedAt?: string
}

/** A qué colas se aplica el filtro de la mesa (F14.1). */
export type DeskFilterScope = "all" | "screen"

/**
 * El filtro de la mesa (F14.1, sabre-client 0.6.0): un `selection` que se usa al contar y al
 * entrar. `count` con `selection` cuenta una cola por request, así que con `all` la mesa pide
 * uno por cada cola del conteo, en serie, y con `screen`, solo el de la cola en pantalla.
 */
export interface DeskFilter {
  selection: QueueSelection[]
  scope: DeskFilterScope
  /** La cuenta filtrada de cada cola que ya respondió. */
  counts: Record<string, number>
  /** Las colas cuyo `count` filtrado falló, con el motivo (p. ej. el `TypeError` del SDK). */
  failures: Record<string, string>
}

/** El último paso que movió el cursor: lo que se ve en el centro. */
export interface DeskScreen {
  method: string
  run: StepRun
  /** Sube con cada paso: la vista del centro se vuelve a montar con él. */
  seq: number
  /** Qué hizo la escritura que trajo este PNR: "AAAAAA se movió a la 60 (PIC 11)". */
  note?: string
}

/** Un destino de `place`: cola, PCC y PIC, como texto. */
export interface DeskDestination {
  queue: string
  /** El PCC de la cola de destino; vacío es el de la sesión. */
  pcc: string
  instructionCode: string
}

/** Cuántos destinos recientes se ofrecen como chips. */
export const RECENT_DESTINATIONS = 3

export interface QueueDesk {
  /** El PCC de trabajo (F9.6); vacío es el de la sesión. */
  pcc: string
  journey: QueueJourney
  count?: DeskCount
  /** Por qué falló el último `count`, si falló. */
  countFailure?: string
  activity?: DeskActivity
  /** Por qué falló el último `activity`, si falló. */
  activityFailure?: string
  /**
   * «Actividad de la cola» (F14.1): los contadores de `activity` con `queue`, por cola. Se ven
   * aunque el check «Actividad» (todo el PCC) esté apagado.
   */
  queueActivity: Record<string, QueueActivityCounters>
  /** Por qué falló el último «Actividad de la cola», si falló. */
  queueActivityFailure?: string
  filter?: DeskFilter
  /** El conteo de la cola elegida al hacer clic, antes del `access`: la `N` de `n de N`. */
  total?: number
  screen?: DeskScreen
  /** Las últimas combinaciones de cola y PIC de `place`, la más nueva primero. */
  recent: DeskDestination[]
  /** El localizador abierto en la hoja de reserva (F9.4), si está abierta. */
  booking?: string
}

export type QueueDeskAction =
  /** Respuesta de `count`, con el PCC con el que se pidió. */
  | { type: "counted"; pcc: string; run: StepRun }
  /** Respuesta de `activity`, con el PCC con el que se pidió. */
  | { type: "activity"; pcc: string; run: StepRun }
  /** Aplicar el filtro de la mesa, o quitarlo con `selection` vacío. Borra las cuentas filtradas. */
  | { type: "filter"; selection?: QueueSelection[]; scope: DeskFilterScope }
  /** Respuesta de un `count` filtrado de una cola, con el PCC con el que se pidió. */
  | { type: "filtered"; pcc: string; queue: string; run: StepRun }
  /** Respuesta de «Actividad de la cola». */
  | { type: "queueActivity"; pcc: string; queue: string; run: StepRun }
  /** Clic en una cola del conteo, antes del `access`. */
  | { type: "select"; queue: string }
  /** Respuesta de un paso que mueve el cursor (`access`, `ignore`, `exit`…). */
  | {
      type: "moved"
      panel: QueuePanel
      method: string
      run: StepRun
      /** Solo `place`: el destino. */
      to?: DeskDestination
    }
  /** La sesión se cerró, venció o cambió el entorno: no hay cursor. */
  | { type: "sessionGone" }
  /** Abrir la hoja de reserva con el localizador en pantalla, o cerrarla. */
  | { type: "booking"; locator?: string }
  /**
   * Cambiar el PCC de trabajo. La mesa hace `exit` antes si el cursor está en una cola: aquí se
   * borran el conteo, el cursor y la pantalla, que eran del PCC anterior.
   */
  | { type: "pcc"; pcc: string }
  /**
   * El PCC de la sesión, cuando se conoce. Si el de trabajo es el mismo escrito a mano (por la
   * ruta `/queue-desk/<PCC>`), pasa a vacío sin borrar nada: es el mismo PCC.
   */
  | { type: "sessionPcc"; pcc: string }

export function initialQueueDesk(pcc = ""): QueueDesk {
  return {
    pcc,
    journey: initialQueueJourney(pcc),
    recent: [],
    queueActivity: {},
  }
}

/** Las colas del conteo que se pueden contar con filtro: las que no tienen nombre (Q-086). */
export function filterableQueues(count: DeskCount | undefined): string[] {
  return (count?.queues ?? [])
    .filter((row) => !row.named)
    .map((row) => row.queue)
}

/** Un filtro sin cuentas: al aplicarlo, al contar de nuevo o al cambiar de PCC. */
function clearCounts(filter: DeskFilter | undefined): DeskFilter | undefined {
  return filter === undefined
    ? undefined
    : { ...filter, counts: {}, failures: {} }
}

/** Un PCC escrito a mano, normalizado: vacío si es el de la sesión. */
export function workingPcc(text: string, sessionPcc: string): string {
  const pcc = text.trim().toUpperCase()
  return pcc === sessionPcc ? "" : pcc
}

/** `/booking` prellenado con el localizador y, si hay, el PCC de trabajo como `targetPcc`. */
export function bookingHref(locator: string, pcc: string): string {
  const params = new URLSearchParams({ confirmationId: locator })
  if (pcc !== "") params.set("targetPcc", pcc)
  return `/booking?${params}`
}

/** El PCC para mostrar: el de trabajo o, si está vacío, el de la sesión. */
export function shownPcc(pcc: string, sessionPcc: string): string {
  return pcc === "" ? sessionPcc : pcc
}

/** El motivo de un paso que no corrió o que falló. */
export function failureOf(run: StepRun | undefined): string | undefined {
  if (run === undefined) return undefined
  if (!run.enabled) return run.reason
  if (run.step.ok) return undefined
  const error = run.step.error
  if (error === undefined) return "la llamada falló"
  return error.code === undefined
    ? error.message
    : `${error.code}: ${error.message}`
}

export function countOf(run: StepRun): DeskCount | undefined {
  if (!run.enabled || !run.step.ok) return undefined
  const response = run.step.result as QueueCountResponse | undefined
  if (!Array.isArray(response?.queues)) return undefined
  return {
    queues: response.queues.map(({ queue, count }) => ({
      queue: formatQueueRef(queue),
      count,
      // La S (cola de mensajes) es un string y se puede abrir; un `{ name }` no (Q-086).
      named: typeof queue === "object",
    })),
    totals: response.totals ?? {},
    estimated: [],
    countedAt: response.countedAt,
    additionalInfo: response.additionalInfo,
  }
}

function activityOf(
  run: StepRun,
  count: DeskCount | undefined
): DeskActivity | undefined {
  if (!run.enabled || !run.step.ok) return undefined
  const response = run.step.result as QueueActivityResponse | undefined
  if (!Array.isArray(response?.queues)) return undefined
  const counted = new Set(count?.queues.map((row) => row.queue))
  const queues: Record<string, QueueActivityCounters> = {}
  for (const { queue, ...counters } of response.queues) {
    queues[formatQueueRef(queue)] = counters
  }
  return {
    queues,
    emptyWithCounters: Object.keys(queues).filter(
      (queue) => !counted.has(queue)
    ),
    analyzedAt: response.analyzedAt,
  }
}

/**
 * Un `place` o un `remove` que salió bien dentro de una cola: de qué cola salió el PNR y qué
 * se dice en el centro. `undefined` si el paso no fue una escritura o falló.
 */
function writeOf(
  state: QueueDesk,
  action: Extract<QueueDeskAction, { type: "moved" }>
): { from: string; note: string } | undefined {
  if (action.panel !== "place" && action.panel !== "remove") return undefined
  if (!action.run.enabled || !action.run.step.ok) return undefined
  const locator = state.journey.current
  const from = state.journey.queue
  if (locator === undefined || from === "") return undefined
  if (action.panel === "remove") {
    return { from, note: `${locator} salió de la cola ${from}.` }
  }
  if (action.to === undefined) return undefined
  // Otro PCC que el de trabajo: se nombra, porque el conteo de la izquierda no lo incluye.
  const elsewhere =
    action.to.pcc === state.pcc
      ? ""
      : ` de ${action.to.pcc === "" ? "el PCC de la sesión" : action.to.pcc}`
  return {
    from,
    note: `${locator} se movió de la ${from} a la ${action.to.queue}${elsewhere} (PIC ${action.to.instructionCode}).`,
  }
}

/** −1 en la cola de origen y +1 en la de destino, si está en la lista. Quedan como estimadas. */
function adjust(
  count: DeskCount | undefined,
  from: string,
  to?: string
): DeskCount | undefined {
  if (count === undefined) return undefined
  const touched = new Set(count.estimated)
  const queues = count.queues.map((row) => {
    if (row.queue === from) {
      touched.add(row.queue)
      return { ...row, count: Math.max(0, row.count - 1) }
    }
    if (to !== undefined && row.queue === to) {
      touched.add(row.queue)
      return { ...row, count: row.count + 1 }
    }
    return row
  })
  return { ...count, queues, estimated: [...touched] }
}

function remember(
  recent: DeskDestination[],
  to: DeskDestination
): DeskDestination[] {
  const others = recent.filter(
    (item) =>
      item.queue !== to.queue ||
      item.pcc !== to.pcc ||
      item.instructionCode !== to.instructionCode
  )
  return [to, ...others].slice(0, RECENT_DESTINATIONS)
}

export function queueDeskReducer(
  state: QueueDesk,
  action: QueueDeskAction
): QueueDesk {
  switch (action.type) {
    case "counted": {
      // Un conteo que llega después de cambiar de PCC es del anterior: no se mezcla.
      if (action.pcc !== state.pcc) return state
      const count = countOf(action.run)
      // Un `count` que falla deja a la vista el último que salió bien.
      if (count === undefined) {
        return { ...state, countFailure: failureOf(action.run) }
      }
      return {
        ...state,
        count,
        countFailure: undefined,
        filter: clearCounts(state.filter),
      }
    }
    case "activity": {
      if (action.pcc !== state.pcc) return state
      const activity = activityOf(action.run, state.count)
      if (activity === undefined) {
        return { ...state, activityFailure: failureOf(action.run) }
      }
      return { ...state, activity, activityFailure: undefined }
    }
    case "filter": {
      const selection = action.selection ?? []
      if (selection.length === 0) return { ...state, filter: undefined }
      return {
        ...state,
        filter: { selection, scope: action.scope, counts: {}, failures: {} },
      }
    }
    case "filtered": {
      if (action.pcc !== state.pcc || state.filter === undefined) return state
      const { counts, failures } = state.filter
      const response =
        action.run.enabled && action.run.step.ok
          ? (action.run.step.result as QueueCountResponse | undefined)
          : undefined
      const row = response?.queues?.find(
        (item) => formatQueueRef(item.queue) === action.queue
      )
      const { [action.queue]: _count, ...otherCounts } = counts
      const { [action.queue]: _failure, ...otherFailures } = failures
      return {
        ...state,
        filter: {
          ...state.filter,
          counts:
            row === undefined
              ? otherCounts
              : { ...otherCounts, [action.queue]: row.count },
          failures:
            row === undefined
              ? {
                  ...otherFailures,
                  [action.queue]:
                    failureOf(action.run) ?? "la respuesta no trae la cola",
                }
              : otherFailures,
        },
      }
    }
    case "queueActivity": {
      if (action.pcc !== state.pcc) return state
      const activity = activityOf(action.run, state.count)
      const counters = activity?.queues[action.queue]
      if (counters === undefined) {
        return {
          ...state,
          queueActivityFailure:
            failureOf(action.run) ?? "la respuesta no trae la cola",
        }
      }
      return {
        ...state,
        queueActivity: { ...state.queueActivity, [action.queue]: counters },
        queueActivityFailure: undefined,
      }
    }
    case "select": {
      const journey = queueJourneyReducer(state.journey, {
        type: "select",
        pcc: state.pcc,
        queue: action.queue,
      })
      // Con filtro, la `N` de `n de N` es la cuenta filtrada, si ya llegó.
      const total =
        state.filter?.counts[journey.queue] ??
        state.count?.queues.find((row) => row.queue === journey.queue)?.count
      return { ...state, journey, total }
    }
    case "moved": {
      const journey = queueJourneyReducer(state.journey, {
        type: "moved",
        panel: action.panel,
        run: action.run,
      })
      const write = writeOf(state, action)
      return {
        ...state,
        journey,
        count:
          write === undefined
            ? state.count
            : // +1 solo si el destino está en el conteo, que es del PCC de trabajo.
              adjust(
                state.count,
                write.from,
                action.to !== undefined && action.to.pcc === state.pcc
                  ? action.to.queue
                  : undefined
              ),
        recent:
          write !== undefined && action.to !== undefined
            ? remember(state.recent, action.to)
            : state.recent,
        screen: {
          method: action.method,
          run: action.run,
          seq: (state.screen?.seq ?? 0) + 1,
          note: write?.note,
        },
      }
    }
    case "pcc":
      if (action.pcc === state.pcc) return state
      return {
        ...initialQueueDesk(action.pcc),
        recent: state.recent,
        filter: clearCounts(state.filter),
      }
    case "sessionPcc":
      if (action.pcc === "" || state.pcc !== action.pcc) return state
      return { ...state, pcc: "", journey: { ...state.journey, pcc: "" } }
    case "booking":
      return state.booking === action.locator
        ? state
        : { ...state, booking: action.locator }
    case "sessionGone": {
      const journey = queueJourneyReducer(state.journey, {
        type: "sessionGone",
      })
      if (journey === state.journey && state.screen === undefined) return state
      return { ...state, journey, screen: undefined }
    }
  }
}
