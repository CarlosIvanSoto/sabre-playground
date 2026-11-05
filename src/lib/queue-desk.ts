import {
  initialQueueJourney,
  type QueueJourney,
  type QueueJourneyAction,
  queueJourneyReducer,
} from "@/lib/queue-journey"

/**
 * El estado de la mesa de colas (ADR-025, `/queue-desk`). Vive en un `useReducer` en la raíz
 * de la mesa, en la memoria del navegador (regla 7), y es puro: no llama a nada.
 *
 * El cursor de la cola es el mismo `queue-journey` del flujo 6. Las tareas siguientes de la
 * Fase 9 le suman el conteo (F9.2 y F9.3), los destinos recientes (F9.3) y el localizador
 * abierto en la hoja de reserva (F9.4). Como la mesa es una sola página, no depende de
 * ADR-024 (Zustand).
 */
export interface QueueDesk {
  journey: QueueJourney
}

export type QueueDeskAction =
  /** Una acción del recorrido de la cola, tal cual la entiende `queue-journey`. */
  { type: "journey"; action: QueueJourneyAction }

export function initialQueueDesk(): QueueDesk {
  return { journey: initialQueueJourney() }
}

export function queueDeskReducer(
  state: QueueDesk,
  action: QueueDeskAction
): QueueDesk {
  switch (action.type) {
    case "journey": {
      const journey = queueJourneyReducer(state.journey, action.action)
      return journey === state.journey ? state : { ...state, journey }
    }
  }
}
