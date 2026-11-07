import type { QueueEndReason, QueueState } from "sabre-client"
import type { StepRun } from "@/lib/step/types"

/**
 * El estado del recorrido del flujo 6 (colas), como `air-booking-journey` en el flujo 2: qué
 * cola se eligió, en qué PNR está el cursor y qué paneles ya no valen. Vive en memoria del
 * navegador (regla 7) y es puro: no llama a nada.
 *
 * Dónde está la sesión (`outside` / `inside` / `unknown`) lo sabe el SDK, en el servidor: el
 * recorrido no lo duplica. Lo recibe en `stepsFor` para decidir qué pasos se pueden correr.
 *
 * Invalidación: elegir otra cola vacía los paneles que dependen de ella (list, access,
 * process, place), que se vuelven a montar con la cola nueva. Cada vez que el cursor se mueve
 * (access, ignore, remove, place dentro de una cola, exit, process), los demás paneles de
 * navegación se vacían: su resultado mostraba un PNR en el que la cola ya no está.
 */

export const QUEUE_PANELS = [
  "count",
  "list",
  "access",
  "ignore",
  "remove",
  "place",
  "exit",
  "process",
] as const

export type QueuePanel = (typeof QUEUE_PANELS)[number]

/** Los paneles que mueven el cursor de la cola. */
const CURSOR_PANELS: readonly QueuePanel[] = [
  "access",
  "ignore",
  "remove",
  "place",
  "exit",
  "process",
]

/** Los paneles cuyo formulario arranca con la cola elegida. */
const QUEUE_FORM_PANELS: readonly QueuePanel[] = [
  "list",
  "access",
  "place",
  "process",
]

export interface QueueJourney {
  /** PCC elegido; vacío es el de la sesión. */
  pcc: string
  /** Cola elegida, como texto (`9`). */
  queue: string
  /** El PNR en el que está el cursor, según la última respuesta. */
  current?: string
  /** PNR que pasaron por el cursor desde el último `access`. */
  visited: number
  /** El último fin de cola: es un resultado, no un error. */
  ended?: { reason: QueueEndReason; message: string }
  generation: Record<QueuePanel, number>
}

export type QueueJourneyAction =
  /**
   * Elegir una cola: desde `count` o desde un formulario que se corrió con otra. `from` es el
   * panel que la eligió: no se vacía, porque su resultado es de esa cola.
   */
  | { type: "select"; pcc: string; queue: string; from?: QueuePanel }
  /** Respuesta de un paso que mueve el cursor. `run` es lo que devolvió la action. */
  | { type: "moved"; panel: QueuePanel; run: StepRun }
  /** La sesión se cerró o venció: no hay cursor. */
  | { type: "sessionGone" }

const zero = Object.fromEntries(
  QUEUE_PANELS.map((panel) => [panel, 0])
) as Record<QueuePanel, number>

export function initialQueueJourney(pcc = "", queue = ""): QueueJourney {
  return { pcc, queue, visited: 0, generation: zero }
}

function bump(
  state: QueueJourney,
  panels: readonly QueuePanel[]
): QueueJourney {
  const generation = { ...state.generation }
  for (const panel of panels) generation[panel] += 1
  return { ...state, generation }
}

/** Lo que devolvió un paso que mueve el cursor, leído sin confiar en la forma. */
function cursorOf(
  panel: QueuePanel,
  run: StepRun
):
  | { kind: "item"; locator: string }
  /** Un mensaje de la cola S: el cursor avanza, pero no hay PNR. */
  | { kind: "message" }
  | { kind: "end"; reason: QueueEndReason; message: string }
  | { kind: "outside"; visited?: number }
  | undefined {
  if (!run.enabled || !run.step.ok) return undefined
  if (panel === "exit") return { kind: "outside" }
  if (panel === "process") {
    const visited = (run.step.result as { visited?: unknown } | undefined)
      ?.visited
    return {
      kind: "outside",
      visited: typeof visited === "number" ? visited : undefined,
    }
  }
  const result = run.step.result as
    | {
        done?: boolean
        kind?: string
        item?: { locator?: string }
        reason?: QueueEndReason
        message?: string
      }
    | undefined
  if (result === undefined || typeof result.done !== "boolean") {
    // `place` fuera de una cola: no mueve nada.
    return undefined
  }
  if (result.done) {
    return {
      kind: "end",
      reason: result.reason ?? "end-of-display",
      message: result.message ?? "",
    }
  }
  if (result.kind === "message") return { kind: "message" }
  return typeof result.item?.locator === "string"
    ? { kind: "item", locator: result.item.locator }
    : undefined
}

export function queueJourneyReducer(
  state: QueueJourney,
  action: QueueJourneyAction
): QueueJourney {
  switch (action.type) {
    case "select": {
      const pcc = action.pcc.trim().toUpperCase()
      const queue = action.queue.trim().toUpperCase()
      if (pcc === state.pcc && queue === state.queue) return state
      const panels = QUEUE_FORM_PANELS.filter((panel) => panel !== action.from)
      return { ...bump(state, panels), pcc, queue }
    }
    case "moved": {
      const cursor = cursorOf(action.panel, action.run)
      if (cursor === undefined) return state
      const others = CURSOR_PANELS.filter((panel) => panel !== action.panel)
      const next = bump(state, others)
      const visited = action.panel === "access" ? 0 : state.visited
      switch (cursor.kind) {
        case "item":
          return {
            ...next,
            current: cursor.locator,
            visited: visited + 1,
            ended: undefined,
          }
        case "message":
          return {
            ...next,
            current: undefined,
            visited: visited + 1,
            ended: undefined,
          }
        case "end":
          return {
            ...next,
            current: undefined,
            visited,
            ended: { reason: cursor.reason, message: cursor.message },
          }
        case "outside":
          return {
            ...next,
            current: undefined,
            ended: undefined,
            visited: cursor.visited ?? visited,
          }
      }
      return next
    }
    case "sessionGone":
      if (state.current === undefined && state.ended === undefined) return state
      return {
        ...bump(state, CURSOR_PANELS),
        current: undefined,
        ended: undefined,
      }
  }
}

/** Dónde está la sesión, visto desde el navegador: cerrada o con su `queue.state`. */
export type SessionPlace = "closed" | QueueState

/**
 * Qué paneles se pueden correr según dónde está la sesión, con las reglas del SDK:
 * - `outside`: count, list, access, process y place (con `locators` o el PNR del AAA).
 * - `inside`: count, list, ignore, remove, place (el PNR actual) y exit.
 * - `unknown`: solo exit (tolera `CANNOT DO THIS IF OFF QUEUE`).
 * - sin sesión: ninguno.
 */
export function stepsFor(place: SessionPlace): ReadonlySet<QueuePanel> {
  switch (place) {
    case "closed":
      return new Set()
    case "outside":
      return new Set(["count", "list", "access", "process", "place"])
    case "inside":
      return new Set(["count", "list", "ignore", "remove", "place", "exit"])
    case "unknown":
      return new Set(["exit"])
  }
}

/** Por qué un paso no se puede correr donde está la sesión. Lo comparten el flujo 6 y la mesa. */
export function disabledReason(place: SessionPlace, panel: QueuePanel): string {
  if (place === "closed") return "Abre una sesión primero."
  if (place === "unknown") {
    return "La sesión está en unknown: primero queue.exit."
  }
  if (place === "inside") return "Solo fuera de una cola: primero queue.exit."
  return panel === "exit"
    ? "Solo dentro de una cola o en unknown."
    : "Solo dentro de una cola: primero queue.access."
}
