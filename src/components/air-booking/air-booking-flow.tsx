"use client"

import { useState } from "react"
import {
  CleanupStep,
  CreateStep,
  ReadStep,
} from "@/components/air-booking/booking-steps"
import { RevalidateStep } from "@/components/air-booking/revalidate-step"
import {
  type SearchSelection,
  SearchStep,
} from "@/components/air-booking/search-step"
import { SeatsStep } from "@/components/air-booking/seats-step"
import type { ChosenItinerary, SeatPlan } from "@/lib/air-booking"

/**
 * Flujo 2: Air Booking de punta a punta. Cada paso es un `StepPanel`, y lo que un paso le pasa
 * al siguiente vive acá, en memoria del navegador.
 */
export function AirBookingFlow() {
  const [selection, setSelection] = useState<SearchSelection>()
  const [revalidated, setRevalidated] = useState<ChosenItinerary>()
  // Cuenta las revalidaciones: cada una vacía el panel de asientos.
  const [revalidation, setRevalidation] = useState(0)
  const [seatPlan, setSeatPlan] = useState<SeatPlan>()
  const [confirmationId, setConfirmationId] = useState<string>()
  const [cancelled, setCancelled] = useState(false)

  const revalidate = (next: ChosenItinerary | undefined) => {
    setRevalidated(next)
    setRevalidation((count) => count + 1)
    setSeatPlan(undefined)
  }
  const select = (next: SearchSelection | undefined) => {
    setSelection(next)
    revalidate(undefined)
  }
  const created = (next: string | undefined) => {
    setConfirmationId(next)
    setCancelled(false)
  }

  return (
    <>
      <SearchStep selection={selection} onSelect={select} />
      {/* Otro itinerario vacía los pasos siguientes. */}
      <RevalidateStep
        key={selection?.key ?? "sin-itinerario"}
        selection={selection}
        onRevalidated={revalidate}
      />
      <SeatsStep
        key={revalidation}
        revalidated={revalidated}
        plan={seatPlan}
        onPlan={setSeatPlan}
      />
      <CreateStep
        revalidated={revalidated}
        travelers={Number(selection?.query.adults ?? 1)}
        seatPlan={seatPlan}
        onCreated={created}
      />
      <ReadStep
        key={`leer-${confirmationId}`}
        confirmationId={confirmationId}
        waitingFor={
          confirmationId === undefined ? "Reserva en el paso 4." : undefined
        }
      />
      <CleanupStep
        key={`limpiar-${confirmationId}`}
        confirmationId={confirmationId}
        onCancelled={setCancelled}
      />
      <ReadStep
        key={`comprobar-${confirmationId}-${cancelled}`}
        final
        confirmationId={confirmationId}
        waitingFor={
          confirmationId === undefined
            ? "Reserva en el paso 4."
            : !cancelled
              ? "Limpia la reserva antes de comprobar."
              : undefined
        }
      />
    </>
  )
}
