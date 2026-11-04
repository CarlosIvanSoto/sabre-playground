"use client"

import { useState } from "react"
import {
  type SearchSelection,
  SearchStep,
} from "@/components/air-booking/search-step"

/**
 * Flujo 2: Air Booking de punta a punta. Cada paso es un `StepPanel`, y lo que un paso le pasa
 * al siguiente vive acá, en memoria del navegador.
 */
export function AirBookingFlow() {
  const [selection, setSelection] = useState<SearchSelection>()
  return <SearchStep selection={selection} onSelect={setSelection} />
}
