"use client"

import type { GetSeatsResponse } from "sabre-client"
import { getSeatsForItinerary } from "@/app/(console)/air-booking/actions"
import { ItineraryBrief } from "@/components/air-booking/itinerary-list"
import { SeatMapView } from "@/components/seats/seat-map"
import { StepPanel } from "@/components/step/step-panel"
import { useStep } from "@/components/step/use-step"
import { Button } from "@/components/ui/button"
import {
  type ChosenItinerary,
  type SeatPlan,
  segmentIndex,
} from "@/lib/air-booking"

/**
 * Paso 3, opcional (F3.3): el mapa de asientos del itinerario revalidado, por payload. Se
 * elige un asiento por vuelo para el primer viajero, o se sigue sin asiento.
 *
 * En CERT el mapa no es confiable (Q-071): un asiento libre acá puede estar ocupado en el host,
 * y entonces Create falla entero (`AUTH-176`) sin dejar PNR.
 */
export function SeatsStep({
  revalidated,
  plan,
  disabled = false,
  onStart,
  onDone,
  onPlan,
}: {
  revalidated?: ChosenItinerary
  plan?: SeatPlan
  disabled?: boolean
  onStart: () => void
  onDone: (ok: boolean) => void
  onPlan: (plan: SeatPlan) => void
}) {
  const { run, pending, execute } = useStep(
    "air.getSeats",
    getSeatsForItinerary
  )
  const availability =
    run?.enabled && run.step.ok
      ? (run.step.result as GetSeatsResponse)
      : undefined
  const seats = plan?.seats ?? []
  // `segmentRef` (S1, S2…) → asiento, para marcar en el mapa lo elegido.
  const picked = Object.fromEntries(
    seats.map((seat) => [`S${seat.segmentIndex}`, seat.number])
  )

  const load = () => {
    if (revalidated === undefined) return
    onStart()
    execute(
      { group: revalidated.group, itinerary: revalidated.itinerary },
      (result) => onDone(result.enabled && result.step.ok)
    )
  }

  const pick = (segmentRef: string, number: string) => {
    const index = segmentIndex(segmentRef)
    if (index === undefined) return
    const others = seats.filter((seat) => seat.segmentIndex !== index)
    // Otro clic en el mismo asiento lo suelta.
    const next =
      picked[segmentRef] === number
        ? others
        : [...others, { segmentIndex: index, travelerIndex: 1, number }]
    next.sort((a, b) => a.segmentIndex - b.segmentIndex)
    onPlan({ seats: next, availability })
  }

  return (
    <StepPanel
      title="air.getSeats"
      description={
        <>
          Opcional. Mapa por <code>byReservationPayload</code>, armado con{" "}
          <code>buildSeatAvailabilityRequest</code>. Un asiento por vuelo, para
          el primer viajero. En CERT todos llegan <code>F</code> (Q-071): si el
          asiento está ocupado en el host, Create falla entero.
        </>
      }
      run={run}
      pending={pending}
      resultView={(result) => (
        <SeatMapView
          result={result}
          picked={picked}
          onPick={disabled ? undefined : pick}
        />
      )}
      form={
        <div className="flex flex-col gap-4">
          {revalidated === undefined ? (
            <p className="text-muted-foreground text-sm">
              Revalida un itinerario en el paso 2.
            </p>
          ) : (
            <ItineraryBrief
              chosen={revalidated}
              label="Revalidado en el paso 2"
            />
          )}
          <Button
            onClick={load}
            disabled={pending || disabled || revalidated === undefined}
          >
            Ver asientos
          </Button>
          <div className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Para Create:</span>
            {plan === undefined ? (
              <span>Sin decidir: Create va sin asiento.</span>
            ) : seats.length === 0 ? (
              <span>Sin asiento.</span>
            ) : (
              <span className="font-mono">
                {seats
                  .map((seat) => `S${seat.segmentIndex} ${seat.number}`)
                  .join(" · ")}
              </span>
            )}
          </div>
          <Button
            variant="outline"
            onClick={() => onPlan({ seats: [] })}
            disabled={pending || disabled || revalidated === undefined}
          >
            Seguir sin asiento
          </Button>
        </div>
      }
    />
  )
}
