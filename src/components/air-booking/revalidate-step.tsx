"use client"

import { revalidateItinerary } from "@/app/(console)/air-booking/actions"
import {
  ItineraryBrief,
  ItineraryList,
} from "@/components/air-booking/itinerary-list"
import { StepPanel } from "@/components/step/step-panel"
import { useStep } from "@/components/step/use-step"
import { Button } from "@/components/ui/button"
import {
  type ChosenItinerary,
  type RevalidateInput,
  revalidatedItinerary,
} from "@/lib/air-booking"
import type { SearchSelection } from "@/lib/air-booking-journey"

/**
 * Paso 2 (F3.2): revalidar el itinerario elegido en el paso 1. El request lo arma
 * `buildRevalidateItineraryRequest` en el servidor: acá no se escribe nada.
 */
export function RevalidateStep({
  selection,
  disabled = false,
  onStart,
  onRevalidated,
}: {
  selection?: SearchSelection
  disabled?: boolean
  onStart: () => void
  /** El itinerario revalidado, o `undefined` si el paso falló. */
  onRevalidated: (revalidated: ChosenItinerary | undefined) => void
}) {
  const { run, pending, execute } = useStep(
    "air.revalidateItinerary",
    revalidateItinerary
  )

  const revalidate = () => {
    if (selection === undefined) return
    const input: RevalidateInput = {
      query: selection.query,
      group: selection.group,
      itinerary: selection.itinerary,
    }
    onStart()
    execute(input, (result) =>
      onRevalidated(
        result.enabled && result.step.ok
          ? revalidatedItinerary(result.step.result)
          : undefined
      )
    )
  }

  return (
    <StepPanel
      title="air.revalidateItinerary"
      description={
        <>
          Revalida disponibilidad y precio del itinerario elegido, sin retener
          inventario. El request sale de{" "}
          <code>buildRevalidateItineraryRequest</code> con la búsqueda del paso
          1.
        </>
      }
      run={run}
      pending={pending}
      resultView={(result) => <ItineraryList result={result} />}
      form={
        <div className="flex flex-col gap-4">
          {selection === undefined ? (
            <p className="text-muted-foreground text-sm">
              Elige un itinerario en el paso 1.
            </p>
          ) : (
            <ItineraryBrief chosen={selection} label="Elegido en el paso 1" />
          )}
          <Button
            onClick={revalidate}
            disabled={pending || disabled || selection === undefined}
          >
            Revalidar
          </Button>
        </div>
      }
    />
  )
}
