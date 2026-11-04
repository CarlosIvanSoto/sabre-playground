"use client"

import { CircleCheck, CircleX } from "lucide-react"
import { useState } from "react"
import { createBooking } from "@/app/(console)/air-booking/actions"
import { cancelBooking, getBooking } from "@/app/(console)/booking/actions"
import { ItineraryBrief } from "@/components/air-booking/itinerary-list"
import { useEnvironment } from "@/components/environment/environment-provider"
import { StepPanel } from "@/components/step/step-panel"
import { useStep } from "@/components/step/use-step"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  bookedFlights,
  type ChosenItinerary,
  type CreateInput,
  hasNoFlights,
  type SeatPlan,
  syntheticTravelers,
} from "@/lib/air-booking"
import type { BookingCancelInput, BookingGetInput } from "@/lib/booking"

/**
 * Paso 4 (F3.4): reservar con `TEST/PASSENGER`, leer la reserva, limpiarla con
 * `booking.cancel` y comprobar con un último `booking.get` que quedó sin vuelos. Create y
 * Cancel no corren en producción: se ven deshabilitados.
 */

/** `booking.create` con el itinerario revalidado y, si hay, los asientos del paso 3. */
export function CreateStep({
  revalidated,
  travelers,
  seatPlan,
  onCreated,
}: {
  revalidated?: ChosenItinerary
  travelers: number
  seatPlan?: SeatPlan
  onCreated: (confirmationId: string | undefined) => void
}) {
  const { environment } = useEnvironment()
  const { run, pending, execute } = useStep("booking.create", createBooking)
  const seats = seatPlan?.seats ?? []
  const names = syntheticTravelers(travelers).map(
    (traveler) => `${traveler.surname}/${traveler.givenName}`
  )

  const create = () => {
    if (revalidated === undefined) return
    const input: CreateInput = {
      group: revalidated.group,
      itinerary: revalidated.itinerary,
      travelers,
      seats,
      seatAvailability: seats.length > 0 ? seatPlan?.availability : undefined,
    }
    onCreated(undefined)
    execute(input, (result) =>
      onCreated(
        result.enabled && result.step.ok
          ? (result.step.result as { confirmationId?: string }).confirmationId
          : undefined
      )
    )
  }

  return (
    <StepPanel
      title="booking.create"
      description={
        <>
          Reserva por el camino ATPCO con <code>buildBookingFlightDetails</code>
          , en el PCC de auth. Viajeros y contacto sintéticos. Es una escritura:
          ni el SDK ni la consola la reintentan. Si falla, el error se ve tal
          cual en la pestaña Error.
        </>
      }
      run={run}
      pending={pending}
      resultView={(result) => <BookedFlightsView result={result} />}
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
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Viajeros</dt>
            <dd className="font-mono">{names.join(", ")}</dd>
            <dt className="text-muted-foreground">Asientos</dt>
            <dd className="font-mono">
              {seats.length === 0
                ? "sin asiento"
                : seats
                    .map((seat) => `S${seat.segmentIndex} ${seat.number}`)
                    .join(" · ")}
            </dd>
          </dl>
          <Button
            onClick={create}
            disabled={
              pending || revalidated === undefined || environment.readOnly
            }
          >
            Reservar
          </Button>
          {environment.readOnly && <ReadOnlyNote />}
        </div>
      }
    />
  )
}

/** `booking.get` de la reserva creada. Con `final`, comprueba que quedó sin vuelos. */
export function ReadStep({
  confirmationId,
  final = false,
  waitingFor,
  onRead,
}: {
  confirmationId?: string
  final?: boolean
  /** Qué falta para poder correr el paso, si falta algo. */
  waitingFor?: string
  onRead?: (ok: boolean) => void
}) {
  const { run, pending, execute } = useStep("booking.get", getBooking)
  const read = () => {
    if (confirmationId === undefined) return
    const input: BookingGetInput = { confirmationId }
    execute(input, (result) => onRead?.(result.enabled && result.step.ok))
  }

  return (
    <StepPanel
      title="booking.get"
      description={
        final ? (
          <>
            Comprobación final. Después de cancelar, Sabre omite las secciones
            vacías: la reserva quedó limpia si <code>flights</code> no viene o
            viene vacío. El PNR sigue existiendo.
          </>
        ) : (
          <>
            Lee la reserva recién creada. El <code>Booking</code> viene en el
            primer nivel, no anidado como en Create.
          </>
        )
      }
      run={run}
      pending={pending}
      resultView={(result) =>
        final ? (
          <CancelledCheck result={result} />
        ) : (
          <BookedFlightsView result={result} />
        )
      }
      form={
        <div className="flex flex-col gap-4">
          <Locator confirmationId={confirmationId} waitingFor={waitingFor} />
          <Button onClick={read} disabled={pending || waitingFor !== undefined}>
            {final ? "Comprobar" : "Leer"}
          </Button>
        </div>
      }
    />
  )
}

/** El botón "limpiar": `booking.cancel` con `cancelAll`, con confirmación. */
export function CleanupStep({
  confirmationId,
  onCancelled,
}: {
  confirmationId?: string
  onCancelled: (ok: boolean) => void
}) {
  const { environment } = useEnvironment()
  const { run, pending, execute } = useStep("booking.cancel", cancelBooking)
  const [confirming, setConfirming] = useState(false)

  const cancel = () => {
    setConfirming(false)
    if (confirmationId === undefined) return
    const input: BookingCancelInput = { confirmationId, retrieveBooking: false }
    execute(input, (result) => onCancelled(result.enabled && result.step.ok))
  }

  return (
    <StepPanel
      title="booking.cancel"
      description={
        <>
          Limpia la reserva: cancela todos los segmentos (<code>cancelAll</code>
          ), sin reintento. No se usa <code>isCancelable</code>: no dice si se
          puede cancelar.
        </>
      }
      run={run}
      pending={pending}
      form={
        <div className="flex flex-col gap-4">
          <Locator
            confirmationId={confirmationId}
            waitingFor={
              confirmationId === undefined ? "Reserva en el paso 4." : undefined
            }
          />
          <Button
            variant="destructive"
            onClick={() => setConfirming(true)}
            disabled={
              pending || confirmationId === undefined || environment.readOnly
            }
          >
            Limpiar
          </Button>
          {environment.readOnly && <ReadOnlyNote />}
          <AlertDialog open={confirming} onOpenChange={setConfirming}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Cancelar la reserva?</AlertDialogTitle>
                <AlertDialogDescription>
                  Se cancelan todos los segmentos de{" "}
                  <code className="font-mono">{confirmationId}</code> en{" "}
                  {environment.label}. No se puede deshacer.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Volver</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={cancel}>
                  Cancelar reserva
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      }
    />
  )
}

function Locator({
  confirmationId,
  waitingFor,
}: {
  confirmationId?: string
  waitingFor?: string
}) {
  if (waitingFor !== undefined) {
    return <p className="text-muted-foreground text-sm">{waitingFor}</p>
  }
  return (
    <p className="text-sm">
      <span className="text-muted-foreground">Localizador: </span>
      <code className="font-mono">{confirmationId}</code>
    </p>
  )
}

function ReadOnlyNote() {
  return (
    <p className="text-muted-foreground text-sm">
      Deshabilitado: el entorno es de solo lectura.
    </p>
  )
}

/** Los vuelos de la reserva, de Create (anidados en `booking`) o de Get (primer nivel). */
function BookedFlightsView({ result }: { result: unknown }) {
  const flights = bookedFlights(result)
  if (flights === undefined || flights.length === 0) return null
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Vuelo</TableHead>
          <TableHead>Ruta</TableHead>
          <TableHead>Salida</TableHead>
          <TableHead>Clase</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead>Asientos</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {flights.map((flight, index) => (
          <TableRow
            // `itemId` puede faltar; el orden no cambia.
            key={flight.itemId ?? index}
            className="font-mono text-xs"
          >
            <TableCell>
              {flight.airlineCode}
              {flight.flightNumber}
            </TableCell>
            <TableCell>
              {flight.fromAirportCode}→{flight.toAirportCode}
            </TableCell>
            <TableCell>
              {flight.departureDate} {flight.departureTime?.slice(0, 5)}
            </TableCell>
            <TableCell>{flight.bookingClass}</TableCell>
            <TableCell>{flight.flightStatusCode}</TableCell>
            <TableCell>
              {(flight.seats ?? [])
                .map((seat) => `${seat.number} ${seat.statusCode ?? ""}`)
                .join(", ") || "—"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

/** El veredicto del último `booking.get`: sin vuelos, la reserva quedó cancelada. */
function CancelledCheck({ result }: { result: unknown }) {
  if (hasNoFlights(result)) {
    return (
      <Alert>
        <CircleCheck />
        <AlertTitle>Reserva cancelada</AlertTitle>
        <AlertDescription>
          Get Booking ya no trae <code>flights</code>. El PNR sigue existiendo,
          sin itinerario.
        </AlertDescription>
      </Alert>
    )
  }
  return (
    <div className="flex flex-col gap-3">
      <Alert variant="destructive">
        <CircleX />
        <AlertTitle>La reserva todavía tiene vuelos</AlertTitle>
        <AlertDescription>
          El Cancel no la limpió, o falta correrlo.
        </AlertDescription>
      </Alert>
      <BookedFlightsView result={result} />
    </div>
  )
}
