import { parseQueuePlaceRemark } from "sabre-client"
import type { QueuePlaceRemark } from "./census-traits.ts"

/**
 * Los remarks `QUEUE_PLACE` de Get Booking (F10.7, #107; ADR-026, Q-090): las colocaciones que la
 * reserva tiene programadas.
 *
 * Desde F12.4 (#128) los separa `parseQueuePlaceRemark` del SDK (ADR-027, A4), con la forma real
 * de producción: `PCC` (3 o 4 caracteres) + `DDMMM` + cola + `/` + PIC, como `ABC25SEP146/015` o
 * `HDQ05JUL313/036`. Valida día 01–31, mes `JAN`–`DEC`, cola hasta 511 y PIC en 0–191 o 200–254,
 * y recorta los espacios. Acá solo queda lo del censo: el PCC no sale del servidor y se reduce a
 * `working` (el PCC de trabajo), `HDQ` u `other`.
 *
 * Diferencia con la regex propia que había antes (`QUEUE_PLACE_PATTERN`): el censo pasaba el texto
 * a mayúsculas antes de leerlo, y el SDK no. Un remark en minúsculas ahora no se reconoce. Sabre
 * los manda en mayúsculas, así que con datos reales no cambia nada.
 *
 * Si un remark no se reconoce, la reserva se queda sin `queuePlaceRemarks` (`null`) y solo con el
 * conteo: no se adivina.
 *
 * Solo importa una función pura del SDK, así que sus tests corren con `node --test`.
 */

/** Un remark, o `undefined` si no cumple la forma o trae una cola, un PIC o una fecha imposibles. */
export function parseQueuePlace(
  text: string,
  workingPcc: string
): QueuePlaceRemark | undefined {
  const remark = parseQueuePlaceRemark(text)
  if (remark === null) return undefined
  const working = workingPcc.trim().toUpperCase()
  return {
    pcc:
      working !== "" && remark.pcc === working
        ? "working"
        : remark.pcc === "HDQ"
          ? "HDQ"
          : "other",
    date: remark.date,
    queue: remark.queue,
    pic: remark.pic,
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
