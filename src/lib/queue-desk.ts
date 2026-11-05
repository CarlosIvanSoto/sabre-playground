import type { QueueCountResponse } from "sabre-client"
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
 * es lo que se ve en el centro. F9.3 le suma los destinos recientes y el conteo estimado, y
 * F9.4, el localizador abierto en la hoja de reserva. Como la mesa es una sola página, no
 * depende de ADR-024 (Zustand).
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
  totals: QueueCountResponse["totals"]
  /** `QueueInfo@DateTime` tal cual, sin año. */
  countedAt?: string
}

/** El último paso que movió el cursor: lo que se ve en el centro. */
export interface DeskScreen {
  method: string
  run: StepRun
  /** Sube con cada paso: la vista del centro se vuelve a montar con él. */
  seq: number
}

export interface QueueDesk {
  journey: QueueJourney
  count?: DeskCount
  /** Por qué falló el último `count`, si falló. */
  countFailure?: string
  /** El conteo de la cola elegida al hacer clic, antes del `access`: la `N` de `n de N`. */
  total?: number
  screen?: DeskScreen
}

export type QueueDeskAction =
  /** Respuesta de `count`. */
  | { type: "counted"; run: StepRun }
  /** Clic en una cola del conteo, antes del `access`. */
  | { type: "select"; queue: string }
  /** Respuesta de un paso que mueve el cursor (`access`, `ignore`, `exit`…). */
  | { type: "moved"; panel: QueuePanel; method: string; run: StepRun }
  /** La sesión se cerró, venció o cambió el entorno: no hay cursor. */
  | { type: "sessionGone" }

export function initialQueueDesk(): QueueDesk {
  return { journey: initialQueueJourney() }
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

function countOf(run: StepRun): DeskCount | undefined {
  if (!run.enabled || !run.step.ok) return undefined
  const response = run.step.result as QueueCountResponse | undefined
  if (!Array.isArray(response?.queues)) return undefined
  return {
    queues: response.queues.map(({ queue, count }) => ({
      queue: formatQueueRef(queue),
      count,
      named: typeof queue !== "number",
    })),
    totals: response.totals ?? {},
    countedAt: response.countedAt,
  }
}

export function queueDeskReducer(
  state: QueueDesk,
  action: QueueDeskAction
): QueueDesk {
  switch (action.type) {
    case "counted": {
      const count = countOf(action.run)
      // Un `count` que falla deja a la vista el último que salió bien.
      if (count === undefined) {
        return { ...state, countFailure: failureOf(action.run) }
      }
      return { ...state, count, countFailure: undefined }
    }
    case "select": {
      const journey = queueJourneyReducer(state.journey, {
        type: "select",
        pcc: "",
        queue: action.queue,
      })
      const total = state.count?.queues.find(
        (row) => row.queue === journey.queue
      )?.count
      return { ...state, journey, total }
    }
    case "moved": {
      const journey = queueJourneyReducer(state.journey, {
        type: "moved",
        panel: action.panel,
        run: action.run,
      })
      return {
        ...state,
        journey,
        screen: {
          method: action.method,
          run: action.run,
          seq: (state.screen?.seq ?? 0) + 1,
        },
      }
    }
    case "sessionGone": {
      const journey = queueJourneyReducer(state.journey, {
        type: "sessionGone",
      })
      if (journey === state.journey && state.screen === undefined) return state
      return { ...state, journey, screen: undefined }
    }
  }
}
