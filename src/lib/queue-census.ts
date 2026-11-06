import type { QueueCountResponse, QueueEndReason } from "sabre-client"
import type { BookingTraits, ParagraphTraits } from "@/lib/census-traits"
import type { ConsoleEnvironmentId } from "@/lib/environment"
import { failureOf } from "@/lib/queue-desk"
import { formatQueueRef } from "@/lib/queues"
import type { StepRun } from "@/lib/step/types"

/**
 * El censo de colas (ADR-026, `/queue-census`): un recorrido de solo lectura que, en el PCC de
 * trabajo, cuenta las colas y, por cada cola numérica del rango 0–49 con PNR, entra (`access`),
 * lee hasta N PNR (`ignore`) y sale (`exit`). Nunca `place`, `remove` ni `process`.
 *
 * Este módulo es el estado del recorrido: vive en un `useReducer` de la página, en la memoria del
 * navegador (regla 7), y es puro. Por cada PNR guarda solo sus rasgos (F10.2,
 * `census-traits.ts`), que calcula el servidor; los consume la exportación (F10.3).
 */

/** Las colas que entran al censo (ADR-026). */
export const CENSUS_RANGE = [0, 49] as const

/** PNR por cola: 10 por defecto (decisión del usuario, 2026-11-05), 25 como máximo. */
export const DEFAULT_PER_QUEUE = 10
export const MAX_PER_QUEUE = 25

/**
 * Cómo terminó una cola, con los nombres de `queue-census/1`:
 * - `end-of-display`: se leyó hasta el fin de cola.
 * - `empty`: la cola estaba en el conteo, pero `access` la encontró vacía.
 * - `limit`: se llegó a N, o se paró el censo. En los dos casos se sale con `exit`.
 * - `error`: falló una llamada dentro de la cola.
 */
export type CensusEnded = QueueEndReason | "limit" | "error"

/** Un PNR leído en una cola: los rasgos del párrafo y, aparte, los de su reserva. */
export interface CensusItem extends ParagraphTraits {
  /** Posición en la cola, como `Q07-01`. */
  ref: string
  /** Desde 1. */
  position: number
  /**
   * Los rasgos de `booking.get`. `undefined` mientras no se pidió; `null` si falló o no se pudo
   * correr (fake), con la razón en `bookingError`.
   */
  booking?: BookingTraits | null
  /** El código del error de `booking.get`, o por qué no corrió. */
  bookingError?: string
}

/** Una cola del censo. */
export interface CensusQueue {
  queue: number
  /** Lo que dio `count` antes del recorrido. */
  count: number
  items: CensusItem[]
  /** Falta mientras no se recorrió, o si el censo paró antes de llegar a ella. */
  ended?: CensusEnded
  /** Por qué terminó en `error`. */
  failure?: string
}

/**
 * Lo que devuelven `censusAccess` y `censusIgnore`: el `QueueStep` del SDK con el PNR reducido a
 * rasgos y sin el mensaje del host. Los avisos van solo con su código.
 */
export type CensusStep =
  | { done: false; item: ParagraphTraits; warnings: string[] }
  | { done: true; reason: QueueEndReason; warnings: string[] }

/** Un PNR, el fin de cola o un fallo, leído de lo que devolvió `access` o `ignore`. */
export type CensusRead =
  | { kind: "item"; item: ParagraphTraits }
  | { kind: "end"; reason: QueueEndReason }
  /** `closed`: el paso no corrió porque no hay sesión. */
  | { kind: "failed"; failure: string; closed: boolean }

export function censusReadOf(run: StepRun): CensusRead {
  const failure = failureOf(run)
  if (failure !== undefined || !run.enabled) {
    return {
      kind: "failed",
      failure: failure ?? "la llamada falló",
      closed: !run.enabled,
    }
  }
  const step = run.step.result as CensusStep | undefined
  if (step === undefined || typeof step.done !== "boolean") {
    return {
      kind: "failed",
      failure: "respuesta sin la forma de QueueStep",
      closed: false,
    }
  }
  if (step.done) return { kind: "end", reason: step.reason }
  return { kind: "item", item: step.item }
}

/** Los rasgos de la reserva que devolvió `censusBooking`, o el código del fallo. */
export function bookingOf(
  run: StepRun
): { booking: BookingTraits } | { booking: null; error: string } {
  if (!run.enabled) return { booking: null, error: run.reason }
  if (!run.step.ok || run.step.result === undefined) {
    const error = run.step.error
    return {
      booking: null,
      error: error?.code ?? error?.class ?? "la llamada falló",
    }
  }
  return { booking: run.step.result as BookingTraits }
}

/** Una fila del conteo, ya en texto. */
export interface CensusCountRow {
  /** La cola como texto: `9`, `S`. */
  queue: string
  count: number
  /** Cola con nombre: se muestra, pero no se recorre (Q-086). */
  named: boolean
}

export interface CensusCount {
  rows: CensusCountRow[]
  /** Hora local de la consola al recibir el conteo (ISO 8601). */
  at: string
  /** `QueueInfo@DateTime` tal cual, sin año. */
  countedAt?: string
}

/**
 * - `idle`: sin correr, o cancelado antes de entrar a una cola.
 * - `counting`: el `count` de antes.
 * - `confirming`: producción, esperando la confirmación con el resumen.
 * - `walking`: recorriendo las colas.
 * - `recounting`: el `count` de después.
 * - `done`: terminó todo. `stopped` dice si fue por el botón de parar.
 * - `failed`: el censo se cortó (sesión cerrada, `exit` que falló, `count` que falló).
 */
export type CensusPhase =
  | "idle"
  | "counting"
  | "confirming"
  | "walking"
  | "recounting"
  | "done"
  | "failed"

export interface QueueCensus {
  phase: CensusPhase
  environment?: ConsoleEnvironmentId
  /** El PCC de trabajo con el que se toma; vacío es el de la sesión. */
  pcc: string
  perQueue: number
  /** ISO 8601, al arrancar y al terminar. */
  startedAt?: string
  finishedAt?: string
  before?: CensusCount
  after?: CensusCount
  /** Las colas del rango con PNR, en el orden del conteo. */
  queues: CensusQueue[]
  /** Las colas con nombre del conteo: no se recorren (Q-086). */
  named: CensusCountRow[]
  /** La cola en la que está el recorrido. */
  current?: number
  /** Se apretó parar. */
  stopped: boolean
  /** Por qué se cortó, en `failed`, o por qué se canceló, en `idle`. */
  failure?: string
  /** Por qué falló el `count` de después, si falló. El censo queda igual. */
  recountFailure?: string
}

export type QueueCensusAction =
  | {
      type: "start"
      environment: ConsoleEnvironmentId
      pcc: string
      perQueue: number
      at: string
    }
  /** El `count` de antes (arma las colas del recorrido) o el de después. */
  | { type: "counted"; when: "before" | "after"; count: CensusCount }
  /** Producción: esperar la confirmación. */
  | { type: "confirm" }
  /** Arrancar el recorrido, ya confirmado. */
  | { type: "walk" }
  /** Cancelado en la confirmación: no se entró a ninguna cola. */
  | { type: "cancel" }
  | { type: "enter"; queue: number }
  | { type: "item"; queue: number; item: ParagraphTraits }
  /** Los rasgos de `booking.get` de un PNR ya leído. */
  | {
      type: "booking"
      queue: number
      position: number
      booking: BookingTraits | null
      error?: string
    }
  | { type: "ended"; queue: number; ended: CensusEnded; failure?: string }
  | { type: "stop" }
  | { type: "recount" }
  | { type: "finish"; at: string; recountFailure?: string }
  | { type: "fail"; failure: string; at: string }
  /** Cambiar el PCC de trabajo, fuera de un recorrido. Borra el censo anterior. */
  | { type: "pcc"; pcc: string }
  /** Cambiar N, fuera de un recorrido. */
  | { type: "perQueue"; perQueue: number }

export function initialQueueCensus(
  pcc = "",
  perQueue = DEFAULT_PER_QUEUE
): QueueCensus {
  return { phase: "idle", pcc, perQueue, queues: [], named: [], stopped: false }
}

/** Si el censo está en curso: no se cambia el PCC ni N, y se puede parar. */
export function isRunning(census: QueueCensus): boolean {
  return (
    census.phase === "counting" ||
    census.phase === "confirming" ||
    census.phase === "walking" ||
    census.phase === "recounting"
  )
}

/** N como número válido: entero de 1 a 25. `undefined` si no lo es. */
export function parsePerQueue(text: string): number | undefined {
  if (!/^\d{1,2}$/.test(text.trim())) return undefined
  const value = Number(text)
  return value >= 1 && value <= MAX_PER_QUEUE ? value : undefined
}

/** `Q07-01`: la posición en la cola, con dos dígitos (N llega a 25). */
export function itemRef(queue: number, position: number): string {
  const pad = (value: number) => String(value).padStart(2, "0")
  return `Q${pad(queue)}-${pad(position)}`
}

/** Si una cola entra al censo: numérica, en el rango y con PNR. */
export function inCensusRange(row: CensusCountRow): boolean {
  if (row.named || row.count <= 0) return false
  const queue = Number(row.queue)
  return queue >= CENSUS_RANGE[0] && queue <= CENSUS_RANGE[1]
}

/** El conteo de un `count` que salió bien. `undefined` si falló o no tiene la forma. */
export function censusCountOf(run: StepRun): CensusCount | undefined {
  if (!run.enabled || !run.step.ok) return undefined
  const response = run.step.result as QueueCountResponse | undefined
  if (!Array.isArray(response?.queues)) return undefined
  return {
    rows: response.queues.map(({ queue, count }) => ({
      queue: formatQueueRef(queue),
      count,
      named: typeof queue !== "number",
    })),
    at: new Date().toISOString(),
    countedAt: response.countedAt,
  }
}

/** Las colas que cambiaron entre el conteo de antes y el de después. */
export function countChanges(
  before: CensusCount,
  after: CensusCount
): { queue: string; before: number; after: number }[] {
  const was = new Map(before.rows.map((row) => [row.queue, row.count]))
  const now = new Map(after.rows.map((row) => [row.queue, row.count]))
  const queues = [...new Set([...was.keys(), ...now.keys()])]
  return queues
    .map((queue) => ({
      queue,
      before: was.get(queue) ?? 0,
      after: now.get(queue) ?? 0,
    }))
    .filter((change) => change.before !== change.after)
}

/** Cuántos PNR se van a leer de una cola como máximo: su conteo, con tope N. */
export function plannedOf(queue: CensusQueue, perQueue: number): number {
  return Math.min(queue.count, perQueue)
}

/** El resumen de la confirmación: "Leer hasta 10 PNR y su reserva en 14 colas de P1…". */
export function censusSummary(census: QueueCensus, pcc: string): string {
  const queues = census.queues.length
  return `Leer hasta ${census.perQueue} PNR y su reserva en ${queues} ${queues === 1 ? "cola" : "colas"} de ${pcc}, solo lectura (count, access, ignore, exit y booking.get).`
}

function updateQueue(
  state: QueueCensus,
  queue: number,
  update: (row: CensusQueue) => CensusQueue
): QueueCensus {
  return {
    ...state,
    queues: state.queues.map((row) =>
      row.queue === queue ? update(row) : row
    ),
  }
}

export function queueCensusReducer(
  state: QueueCensus,
  action: QueueCensusAction
): QueueCensus {
  switch (action.type) {
    case "start":
      return {
        ...initialQueueCensus(state.pcc, action.perQueue),
        phase: "counting",
        environment: action.environment,
        pcc: action.pcc,
        startedAt: action.at,
      }
    case "counted":
      if (action.when === "after") return { ...state, after: action.count }
      return {
        ...state,
        before: action.count,
        queues: action.count.rows.filter(inCensusRange).map((row) => ({
          queue: Number(row.queue),
          count: row.count,
          items: [],
        })),
        named: action.count.rows.filter((row) => row.named),
      }
    case "confirm":
      return { ...state, phase: "confirming" }
    case "walk":
      return { ...state, phase: "walking" }
    case "cancel":
      return {
        ...state,
        phase: "idle",
        failure: "Cancelado en la confirmación: no se entró a ninguna cola.",
      }
    case "enter":
      return { ...state, current: action.queue }
    case "item":
      return updateQueue(state, action.queue, (row) => {
        const position = row.items.length + 1
        return {
          ...row,
          items: [
            ...row.items,
            {
              ...action.item,
              position,
              ref: itemRef(row.queue, position),
            },
          ],
        }
      })
    case "booking":
      return updateQueue(state, action.queue, (row) => ({
        ...row,
        items: row.items.map((item) =>
          item.position === action.position
            ? { ...item, booking: action.booking, bookingError: action.error }
            : item
        ),
      }))
    case "ended":
      return {
        ...updateQueue(state, action.queue, (row) => ({
          ...row,
          ended: action.ended,
          failure: action.failure,
        })),
        current: undefined,
      }
    case "stop":
      return isRunning(state) ? { ...state, stopped: true } : state
    case "recount":
      return { ...state, phase: "recounting", current: undefined }
    case "finish":
      return {
        ...state,
        phase: "done",
        current: undefined,
        finishedAt: action.at,
        recountFailure: action.recountFailure,
      }
    case "fail":
      return {
        ...state,
        phase: "failed",
        current: undefined,
        failure: action.failure,
        finishedAt: action.at,
      }
    case "pcc":
      if (isRunning(state) || action.pcc === state.pcc) return state
      return initialQueueCensus(action.pcc, state.perQueue)
    case "perQueue":
      if (isRunning(state)) return state
      return { ...state, perQueue: action.perQueue }
  }
}
