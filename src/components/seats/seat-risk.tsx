import { TriangleAlert } from "lucide-react"
import type { BookingSeatSelection, GetSeatsResponse } from "sabre-client"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  characteristicText,
  findSeat,
  riskySeats,
  SEAT_MARK_TEXT,
  SEAT_RISK_WARNING,
  seatPrices,
} from "@/lib/seat-marks"

/**
 * El aviso antes de Create (F16.7, #165): un asiento de pago, preferente o restringido pedido
 * por número puede rechazarlo `AirSeatLLSRQ`, y entonces Create falla entero sin PNR. No bloquea:
 * avisa.
 */
export function SeatRiskAlert({
  seats,
  availability,
}: {
  seats: BookingSeatSelection[]
  availability: GetSeatsResponse | undefined
}) {
  const risky = riskySeats(seats, availability)
  if (risky.length === 0) return null
  return (
    <Alert variant="destructive">
      <TriangleAlert />
      <AlertTitle>Asiento con marcas</AlertTitle>
      <AlertDescription>
        <ul>
          {risky.map((seat) => (
            <li key={seat.segmentRef} className="font-mono">
              {seat.segmentRef} {seat.number}:{" "}
              {seat.marks.map((mark) => SEAT_MARK_TEXT[mark]).join(", ")}
            </li>
          ))}
        </ul>
        <p>
          Por número, {SEAT_RISK_WARNING}. Elige un asiento sin marcas o sigue
          sin asiento.
        </p>
      </AlertDescription>
    </Alert>
  )
}

/** Las `characteristics` y el precio de cada asiento elegido, tal como los da Get Seats. */
export function ChosenSeatsDetail({
  seats,
  availability,
}: {
  seats: BookingSeatSelection[]
  availability: GetSeatsResponse | undefined
}) {
  if (availability === undefined || seats.length === 0) return null
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
      {seats.map((selection) => {
        const segmentRef = `S${selection.segmentIndex}`
        const seat = findSeat(
          availability.response,
          segmentRef,
          selection.number
        )
        const details =
          seat === undefined
            ? ["no está en el mapa"]
            : [
                ...seatPrices(seat, availability.response),
                ...(seat.characteristics ?? []).map(characteristicText),
              ]
        return (
          <div key={segmentRef} className="contents">
            <dt className="font-mono">
              {segmentRef} {selection.number}
            </dt>
            <dd className="text-muted-foreground font-mono">
              {details.length === 0
                ? "sin características"
                : details.join(" · ")}
            </dd>
          </div>
        )
      })}
    </dl>
  )
}
