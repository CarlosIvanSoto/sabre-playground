"use client"

import { useState } from "react"
import { RevalidateStep } from "@/components/air-booking/revalidate-step"
import {
  type SearchSelection,
  SearchStep,
} from "@/components/air-booking/search-step"
import type { ChosenItinerary } from "@/lib/air-booking"

/**
 * Flujo 2: Air Booking de punta a punta. Cada paso es un `StepPanel`, y lo que un paso le pasa
 * al siguiente vive acá, en memoria del navegador.
 */
export function AirBookingFlow() {
  const [selection, setSelection] = useState<SearchSelection>()
  // Lo lee el paso de asientos (F3.3).
  const [, setRevalidated] = useState<ChosenItinerary>()

  const select = (next: SearchSelection | undefined) => {
    setSelection(next)
    setRevalidated(undefined)
  }

  return (
    <>
      <SearchStep selection={selection} onSelect={select} />
      {/* Otro itinerario vacía el panel de Revalidate. */}
      <RevalidateStep
        key={selection?.key ?? "sin-itinerario"}
        selection={selection}
        onRevalidated={setRevalidated}
      />
    </>
  )
}
