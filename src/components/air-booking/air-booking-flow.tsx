"use client"

import { useReducer } from "react"
import {
  CleanupStep,
  CreateStep,
  ReadStep,
} from "@/components/air-booking/booking-steps"
import { JourneyProgress } from "@/components/air-booking/journey-progress"
import { RevalidateStep } from "@/components/air-booking/revalidate-step"
import { SearchStep } from "@/components/air-booking/search-step"
import { SeatsStep } from "@/components/air-booking/seats-step"
import { useEnvironment } from "@/components/environment/environment-provider"
import {
  hasLiveBooking,
  INITIAL_JOURNEY,
  journeyReducer,
} from "@/lib/air-booking-journey"

/**
 * Flujo 2: Air Booking de punta a punta. Cada paso es un `StepPanel`. Lo que un paso le pasa
 * al siguiente vive en `journeyReducer`, en memoria del navegador: si cambia un paso, los
 * posteriores se vacían (su `key` es la generación del paso).
 *
 * Dos bloqueos:
 *
 * - Con una reserva sin limpiar, los pasos 1 a 4 no corren: cambiarlos perdería el localizador
 *   y dejaría el PNR vivo.
 * - El recorrido corre en el entorno de la búsqueda. Si se elige otro, los pasos siguientes
 *   no corren hasta volver a ese entorno (o empezar de nuevo).
 */
export function AirBookingFlow() {
  const { environment, options } = useEnvironment()
  const [journey, dispatch] = useReducer(journeyReducer, INITIAL_JOURNEY)
  const { generation, confirmationId } = journey

  const live = hasLiveBooking(journey)
  const elsewhere =
    journey.environment !== undefined && journey.environment !== environment.id
  const journeyLabel =
    options.find((option) => option.id === journey.environment)?.label ??
    journey.environment

  const blocked = live
    ? {
        title: "Hay una reserva sin limpiar",
        description: (
          <>
            Los pasos 1 a 4 quedan bloqueados hasta cancelar{" "}
            <code className="font-mono">{confirmationId}</code> con
            &quot;Limpiar&quot;: cambiarlos dejaría el PNR vivo.
            {elsewhere && ` Vuelve a ${journeyLabel} para limpiarla.`}
          </>
        ),
      }
    : elsewhere
      ? {
          title: `El recorrido corre en ${journeyLabel}`,
          description: (
            <>
              Vuelve a {journeyLabel} para seguir, o busca de nuevo en{" "}
              {environment.label}.
            </>
          ),
        }
      : undefined

  // Con otro entorno elegido, solo se puede buscar de nuevo (si no hay reserva viva).
  const early = live || elsewhere
  const late = elsewhere

  return (
    <>
      <JourneyProgress
        journey={journey}
        blocked={blocked}
        canReset={!live && journey.environment !== undefined}
        onReset={() => dispatch({ type: "reset" })}
      />
      <SearchStep
        key={`search-${generation.search}`}
        selection={journey.selection}
        disabled={live}
        onStart={() =>
          dispatch({ type: "search", environment: environment.id })
        }
        onDone={(ok) => dispatch({ type: "searched", ok })}
        onSelect={(selection) => dispatch({ type: "select", selection })}
      />
      <RevalidateStep
        key={`revalidate-${generation.revalidate}`}
        selection={journey.selection}
        disabled={early}
        onStart={() => dispatch({ type: "revalidate" })}
        onRevalidated={(revalidated) =>
          dispatch({ type: "revalidated", revalidated })
        }
      />
      <SeatsStep
        key={`seats-${generation.seats}`}
        revalidated={journey.revalidated}
        plan={journey.seatPlan}
        disabled={early}
        onStart={() => dispatch({ type: "loadSeats" })}
        onDone={(ok) => dispatch({ type: "seatsLoaded", ok })}
        onPlan={(plan) => dispatch({ type: "seatPlan", plan })}
      />
      <CreateStep
        key={`create-${generation.create}`}
        revalidated={journey.revalidated}
        travelers={journey.selection?.query.adults ?? 1}
        seatPlan={journey.seatPlan}
        disabled={early}
        onStart={() => dispatch({ type: "create" })}
        onCreated={(id) => dispatch({ type: "created", confirmationId: id })}
      />
      <ReadStep
        key={`read-${generation.read}`}
        confirmationId={confirmationId}
        waitingFor={
          confirmationId === undefined ? "Reserva en el paso 4." : undefined
        }
        disabled={late}
        onRead={(ok) => dispatch({ type: "read", ok })}
      />
      <CleanupStep
        key={`cleanup-${generation.cleanup}`}
        confirmationId={confirmationId}
        // Ya limpia: otro Cancel solo daría `NO_ITEMS_CANCELLED`.
        disabled={late || journey.cancelled}
        onCancelled={(ok) => dispatch({ type: "cancelled", ok })}
      />
      <ReadStep
        key={`verify-${generation.verify}`}
        final
        confirmationId={confirmationId}
        waitingFor={
          confirmationId === undefined
            ? "Reserva en el paso 4."
            : !journey.cancelled
              ? "Limpia la reserva antes de comprobar."
              : undefined
        }
        disabled={late}
        onRead={(ok, noFlights) =>
          dispatch({ type: "verified", ok, noFlights })
        }
      />
    </>
  )
}
