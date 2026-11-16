import type {
  BookingSeatSelection,
  GetSeatsResponse,
  Seat,
  SeatAvailabilityResponse,
  SeatCharacteristic,
} from "sabre-client"
import type { StepError } from "./step/types.ts"

/**
 * Marcas del mapa de asientos (F16.7, #165). Salen de las `characteristics` de Get Seats (PADIS
 * 9825), no del texto del host. En CERT, `AirSeatLLSRQ` rechazó en Create un asiento de pago
 * (`CH`) y uno preferente y restringido (`O` y `1`) pedidos por número, y Create falló entero
 * sin PNR (`get-seats` en el wiki, 2026-11-16). Ojo: la característica `O` (preferente) no es el
 * `occupationStatusCode` `O` (ocupado).
 */

/** Por qué un asiento puede no ser asignable por número. */
export type SeatMark = "priced" | "preferred" | "restricted"

/** Característica PADIS 9825 → marca. `CH` es cobrable, aunque no traiga `offerItemRefIds`. */
const MARK_BY_CODE: Record<string, SeatMark> = {
  CH: "priced",
  O: "preferred",
  "1": "restricted",
}

/** Letra de la marca en la celda del mapa, después del `occupationStatusCode`. */
export const SEAT_MARK_SYMBOL: Record<SeatMark, string> = {
  priced: "$",
  preferred: "P",
  restricted: "R",
}

export const SEAT_MARK_TEXT: Record<SeatMark, string> = {
  priced: "de pago",
  preferred: "preferente",
  restricted: "restringido",
}

export const SEAT_RISK_WARNING =
  "puede rechazarlo AirSeatLLSRQ y Create falla sin PNR"

/** Las marcas del asiento, en el orden de `SeatMark`, sin repetir. */
export function seatMarks(seat: Seat): SeatMark[] {
  const marks = new Set<SeatMark>()
  if ((seat.offerItemRefIds?.length ?? 0) > 0) marks.add("priced")
  for (const characteristic of seat.characteristics ?? []) {
    const mark = MARK_BY_CODE[characteristic.code]
    if (mark !== undefined) marks.add(mark)
  }
  return (["priced", "preferred", "restricted"] as const).filter((mark) =>
    marks.has(mark)
  )
}

/** `CH Chargeable seat`, o solo el código si no trae descripción. */
export function characteristicText({ code, description }: SeatCharacteristic) {
  return description === undefined ? code : `${code} ${description}`
}

/**
 * El precio del asiento: `offerItemRefIds` → `offerItems[].priceDefinitionRef` →
 * `priceDefinitions[].totalPrice`. Un texto por ítem con precio (`859 MXN`).
 */
export function seatPrices(
  seat: Seat,
  response: SeatAvailabilityResponse
): string[] {
  return (seat.offerItemRefIds ?? []).flatMap((id) => {
    const item = response.offerItems.find((offer) => offer.id === id)
    const price = response.priceDefinitions?.find(
      (definition) => definition.id === item?.priceDefinitionRef
    )
    if (price === undefined) return []
    return [`${price.totalPrice.amount} ${price.currencyCode}`]
  })
}

/** El asiento `number` (`15C`) del segmento `segmentRef` (`S2`), o `undefined`. */
export function findSeat(
  response: SeatAvailabilityResponse,
  segmentRef: string,
  number: string
): Seat | undefined {
  const match = /^(\d+)([A-Z])$/.exec(number)
  if (match === null) return undefined
  const row = Number(match[1])
  const column = match[2]
  for (const map of response.seatMaps) {
    if (map.segmentRef !== segmentRef) continue
    for (const cabin of map.cabinCompartments ?? []) {
      const seat = cabin.seatRows
        ?.find((seatRow) => seatRow.row === row)
        ?.seats.find((candidate) => candidate.column === column)
      if (seat !== undefined) return seat
    }
  }
  return undefined
}

export interface RiskySeat {
  segmentRef: string
  number: string
  marks: SeatMark[]
}

/** Los asientos elegidos para Create que tienen alguna marca. */
export function riskySeats(
  seats: BookingSeatSelection[],
  availability: GetSeatsResponse | undefined
): RiskySeat[] {
  if (availability === undefined) return []
  return seats.flatMap((selection) => {
    const segmentRef = `S${selection.segmentIndex}`
    const seat = findSeat(availability.response, segmentRef, selection.number)
    const marks = seat === undefined ? [] : seatMarks(seat)
    return marks.length === 0
      ? []
      : [{ segmentRef, number: selection.number, marks }]
  })
}

const AIR_SEAT_SERVICE = "AirSeatLLSRQ"

/**
 * El mapa del host que trae un rechazo de `AirSeatLLSRQ` en Create, con un renglón por cada
 * parte separada por comas (Sabre lo manda en una sola línea). Busca en `errors[].description` y
 * en `message`. `undefined` si el error no es de `AirSeatLLSRQ`. No se parsea: solo se parte.
 */
export function hostSeatMapOf(error: StepError): string | undefined {
  const texts = [
    ...(error.errors ?? []).map((item) =>
      typeof item === "object" && item !== null && "description" in item
        ? String(item.description)
        : ""
    ),
    error.message,
  ]
  const text = texts.find((candidate) => candidate.includes(AIR_SEAT_SERVICE))
  if (text === undefined) return undefined
  return text
    .split(",")
    .map((line) => line.trimEnd())
    .join("\n")
}
