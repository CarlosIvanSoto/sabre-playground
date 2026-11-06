import type { QueuePlaceRemark } from "./census-traits.ts"

/**
 * Los remarks `QUEUE_PLACE` de Get Booking (F10.7, #107; ADR-026, Q-090): las colocaciones que la
 * reserva tiene programadas.
 *
 * Forma real, copiada a mano de producción el 2026-11-06: `PCC` (3 o 4 caracteres) + `DDMMM` +
 * cola + `/` + PIC, sin separadores, como `ABC25SEP146/015` o `HDQ05JUL313/036`. El PCC no sale del
 * servidor: se reduce a `working` (el PCC de trabajo), `HDQ` o `other`.
 *
 * Si un remark no cumple la expresión, la reserva se queda sin `queuePlaceRemarks` (`null`) y solo
 * con el conteo: no se adivina.
 *
 * Es puro y no importa nada de la app, para que sus tests corran con `node --test`.
 */
export const QUEUE_PLACE_PATTERN =
  /^([A-Z0-9]{3,4}?)(\d{2}[A-Z]{3})(\d{1,3})\/(\d{1,3})$/

const MONTHS = new Set([
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
])

/** Un remark, o `undefined` si no cumple la forma o trae una cola, un PIC o una fecha imposibles. */
export function parseQueuePlace(
  text: string,
  workingPcc: string
): QueuePlaceRemark | undefined {
  const match = QUEUE_PLACE_PATTERN.exec(text.trim().toUpperCase())
  if (match === null) return undefined
  const [, pcc = "", date = "", queueText = "", picText = ""] = match
  const day = Number(date.slice(0, 2))
  if (day < 1 || day > 31 || !MONTHS.has(date.slice(2))) return undefined
  const queue = Number(queueText)
  const pic = Number(picText)
  if (queue > 511) return undefined
  if (!((pic >= 0 && pic <= 191) || (pic >= 200 && pic <= 254))) {
    return undefined
  }
  const working = workingPcc.trim().toUpperCase()
  return {
    pcc:
      working !== "" && pcc === working
        ? "working"
        : pcc === "HDQ"
          ? "HDQ"
          : "other",
    date,
    queue,
    pic,
  }
}

/** Todos los remarks, o `null` si alguno no se reconoce. */
export function parseQueuePlaces(
  texts: readonly string[],
  workingPcc: string
): QueuePlaceRemark[] | null {
  const out: QueuePlaceRemark[] = []
  for (const text of texts) {
    const remark = parseQueuePlace(text, workingPcc)
    if (remark === undefined) return null
    out.push(remark)
  }
  return out
}
