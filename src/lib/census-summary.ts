import type { QueueCensusExport } from "./census-export.ts"

/**
 * La vista de resumen del censo (F10.4, #98; ADR-026, "Vista de resumen en la consola"). Se
 * calcula del mismo `queue-census/1` que se exporta, así los números coinciden con el JSON.
 *
 * No clasifica ni nombra la función de una cola: eso lo hace el ingest en el wiki. Solo cuenta.
 */

export interface PicCount {
  code: number
  count: number
}

export interface QueueSummary {
  queue: number
  /** PNR leídos de la cola. */
  sampled: number
  /** PNR con los rasgos de la reserva: la base de los porcentajes de boleto, TAW y horario. */
  withBooking: number
  /** Los PIC de la cola, del más frecuente al menos. */
  pics: PicCount[]
  /** Segmentos aéreos por estado (`HK`: 12). */
  segmentStatus: Record<string, number>
  /** Segmentos por aerolínea comercializadora. */
  carriers: Record<string, number>
  /** PNR con reserva y sin boleto: la base de `pctTawExpired`. */
  unticketed: number
  /** Porcentajes redondeados; `null` si su base es 0. */
  /** Sobre `withBooking`. */
  pctTicketed: number | null
  /**
   * Sobre `unticketed`: en un PNR emitido el plazo de compra siempre queda en el pasado, así que
   * contarlo daría 100% en una cola de boletos emitidos.
   */
  pctTawExpired: number | null
  /** Sobre `withBooking`: PNR con algún segmento en un estado de cambio de horario. */
  pctScheduleChange: number | null
  /** Media de `placedAgeHours`, que es una cota (Q-034); `null` sin datos. */
  meanPlacedAgeHours: number | null
}

export interface CensusSummary {
  /** Las columnas de la matriz: los PIC vistos, en orden. */
  pics: number[]
  /** Filas: cola → PIC → PNR con ese PIC. */
  matrix: { queue: number; cells: Record<number, number> }[]
  /** Los PIC que aparecen en más de una cola. */
  sharedPics: number[]
  /** Los PNR que están en más de una cola, con sus referencias. */
  sharedPnrs: { pnr: string; refs: string[] }[]
  queues: QueueSummary[]
}

/**
 * Los estados de segmento de un cambio de horario (ADR-026, "Cómo se clasifica una cola"): `UN`
 * el vuelo que cambió, `TK` el nuevo, `SC` y `WK`. No se usa `scheduleChangeMinutes`: según el
 * spec v1.33, `updatedDeparture*` es la salida estimada o real (demoras), no el cambio de horario
 * del itinerario (Q-091).
 */
export const SCHEDULE_CHANGE_STATUS: ReadonlySet<string> = new Set([
  "UN",
  "TK",
  "SC",
  "WK",
])

const percent = (part: number, total: number): number | null =>
  total === 0 ? null : Math.round((part / total) * 100)

function bump(record: Record<string, number>, key: string) {
  record[key] = (record[key] ?? 0) + 1
}

export function summarizeCensus(doc: QueueCensusExport): CensusSummary {
  const picQueues = new Map<number, Set<number>>()
  const pnrRefs = new Map<string, { queues: Set<number>; refs: string[] }>()
  const matrix: CensusSummary["matrix"] = []
  const queues: QueueSummary[] = []

  for (const queue of doc.queues) {
    const cells: Record<number, number> = {}
    const segmentStatus: Record<string, number> = {}
    const carriers: Record<string, number> = {}
    let withBooking = 0
    let unticketed = 0
    let ticketed = 0
    let tawExpired = 0
    let scheduleChange = 0
    const ages: number[] = []

    for (const item of queue.items) {
      // Un PNR con el mismo PIC dos veces cuenta una vez en la celda.
      for (const code of new Set(item.pics.map((pic) => pic.code))) {
        cells[code] = (cells[code] ?? 0) + 1
        const seen = picQueues.get(code) ?? new Set<number>()
        seen.add(queue.queue)
        picQueues.set(code, seen)
      }
      const entry = pnrRefs.get(item.pnr) ?? { queues: new Set(), refs: [] }
      entry.queues.add(queue.queue)
      entry.refs.push(item.ref)
      pnrRefs.set(item.pnr, entry)
      if (item.placedAgeHours !== null) ages.push(item.placedAgeHours)

      const booking = item.booking
      if (booking === null) continue
      withBooking += 1
      if (booking.isTicketed === true) {
        ticketed += 1
      } else {
        unticketed += 1
        if (
          booking.hoursToPurchaseDeadline !== null &&
          booking.hoursToPurchaseDeadline < 0
        ) {
          tawExpired += 1
        }
      }
      if (
        booking.flights.some(
          (flight) =>
            flight.status !== null && SCHEDULE_CHANGE_STATUS.has(flight.status)
        )
      ) {
        scheduleChange += 1
      }
      for (const flight of booking.flights) {
        if (flight.status !== null) bump(segmentStatus, flight.status)
        if (flight.carrier !== null) bump(carriers, flight.carrier)
      }
    }

    matrix.push({ queue: queue.queue, cells })
    queues.push({
      queue: queue.queue,
      sampled: queue.items.length,
      withBooking,
      unticketed,
      pics: Object.entries(cells)
        .map(([code, count]) => ({ code: Number(code), count }))
        .sort((a, b) => b.count - a.count || a.code - b.code),
      segmentStatus,
      carriers,
      pctTicketed: percent(ticketed, withBooking),
      pctTawExpired: percent(tawExpired, unticketed),
      pctScheduleChange: percent(scheduleChange, withBooking),
      meanPlacedAgeHours:
        ages.length === 0
          ? null
          : Math.round(ages.reduce((sum, age) => sum + age, 0) / ages.length),
    })
  }

  const pics = [...picQueues.keys()].sort((a, b) => a - b)
  return {
    pics,
    matrix,
    sharedPics: pics.filter((code) => (picQueues.get(code)?.size ?? 0) > 1),
    sharedPnrs: [...pnrRefs]
      .filter(([, entry]) => entry.queues.size > 1)
      .map(([pnr, entry]) => ({ pnr, refs: entry.refs })),
    queues,
  }
}
