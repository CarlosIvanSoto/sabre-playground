"use client"

import { CircleCheck, CircleX } from "lucide-react"
import { useState } from "react"
import { createBooking } from "@/app/(console)/air-booking/actions"
import { cancelBooking, getBooking } from "@/app/(console)/booking/actions"
import { ItineraryBrief } from "@/components/air-booking/itinerary-list"
import { TicketsTable, VerifyPanel } from "@/components/booking/fulfill-step"
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
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
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
import { uncertainOf } from "@/lib/step/uncertain"
import {
  bookingTicketsOf,
  liveTicketsOf,
  notVoidedOf,
  VOID_VERIFY_STATUS_TEXT,
} from "@/lib/ticketing"

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
  disabled = false,
  onStart,
  onCreated,
}: {
  revalidated?: ChosenItinerary
  travelers: number
  seatPlan?: SeatPlan
  disabled?: boolean
  onStart: () => void
  /** El localizador, o `undefined` si Create falló, y el PCC en el que se reservó. */
  onCreated: (confirmationId: string | undefined, targetPcc: string) => void
}) {
  const { environment } = useEnvironment()
  const { run, pending, execute } = useStep("booking.create", createBooking)
  // El PCC IATA de emisión, para que la reserva se pueda emitir después (F16.2).
  const [targetPcc, setTargetPcc] = useState(environment.ticketingPcc ?? "")
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
      targetPcc: targetPcc.trim().toUpperCase(),
    }
    onStart()
    execute(input, (result) =>
      onCreated(
        result.enabled && result.step.ok
          ? (result.step.result as { confirmationId?: string }).confirmationId
          : undefined,
        input.targetPcc ?? ""
      )
    )
  }

  return (
    <StepPanel
      title="booking.create"
      description={
        <>
          Reserva por el camino ATPCO con <code>buildBookingFlightDetails</code>
          , en el PCC de abajo (vacío, el de auth). Viajeros y contacto
          sintéticos, con el DK de diez ceros y Secure Flight, lo que pide un
          PCC IATA para emitir. Es una escritura: ni el SDK ni la consola la
          reintentan. Si falla, el error se ve tal cual en la pestaña Error.
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
          <Field>
            <FieldLabel htmlFor="create-targetPcc">
              PCC de la reserva (targetPcc)
            </FieldLabel>
            <Input
              id="create-targetPcc"
              className="font-mono uppercase"
              value={targetPcc}
              onChange={(event) => setTargetPcc(event.target.value)}
            />
            <FieldDescription>
              Para emitir, el PCC IATA. Vacío, el de auth.
            </FieldDescription>
          </Field>
          <Button
            onClick={create}
            disabled={
              pending ||
              disabled ||
              revalidated === undefined ||
              environment.readOnly
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
  targetPcc = "",
  mode = "read",
  voided = [],
  waitingFor,
  disabled = false,
  onRead,
}: {
  confirmationId?: string
  /** El PCC en el que se reservó (vacío, el de auth). */
  targetPcc?: string
  /**
   * `read`: la reserva recién creada. `tickets`: después de emitir, los boletos del PNR (W4,
   * F16.3). `final`: la comprobación después de limpiar.
   */
  mode?: "read" | "tickets" | "final"
  /** En `final`, los boletos que Limpiar anuló: tienen que estar en `TV`. */
  voided?: readonly string[]
  /** Qué falta para poder correr el paso, si falta algo. */
  waitingFor?: string
  disabled?: boolean
  /** Si leyó la reserva y, si leyó, la reserva tal cual llegó. */
  onRead: (ok: boolean, booking?: unknown) => void
}) {
  const final = mode === "final"
  const { run, pending, execute } = useStep("booking.get", getBooking)
  const read = () => {
    if (confirmationId === undefined) return
    const input: BookingGetInput = { confirmationId, targetPcc }
    execute(input, (result) => {
      const ok = result.enabled && result.step.ok
      onRead(ok, ok ? result.step.result : undefined)
    })
  }

  return (
    <StepPanel
      title="booking.get"
      description={
        final ? (
          <>
            Comprobación final. Después de cancelar, Sabre omite las secciones
            vacías: la reserva quedó limpia si <code>flights</code> no viene o
            viene vacío. Si se anularon boletos, tienen que estar en{" "}
            <code>TV</code> (por <code>ticketStatusCode</code>, no{" "}
            <code>isTicketed</code>, que sigue en true). El PNR sigue
            existiendo.
          </>
        ) : mode === "tickets" ? (
          <>
            Después de emitir: los boletos que tiene el PNR. Los <code>TE</code>{" "}
            de acá son los que anula Limpiar, aunque Fulfill haya quedado
            incierto.
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
          <CancelledCheck result={result} voided={voided} />
        ) : mode === "tickets" ? (
          <BookingTicketsView result={result} />
        ) : (
          <BookedFlightsView result={result} />
        )
      }
      form={
        <div className="flex flex-col gap-4">
          <Locator confirmationId={confirmationId} waitingFor={waitingFor} />
          <Button
            onClick={read}
            disabled={pending || disabled || waitingFor !== undefined}
          >
            {final ? "Comprobar" : mode === "tickets" ? "Leer boletos" : "Leer"}
          </Button>
        </div>
      }
    />
  )
}

/** El botón "limpiar": `booking.cancel` con `cancelAll`, con confirmación. */
export function CleanupStep({
  confirmationId,
  targetPcc = "",
  liveTickets = [],
  waitingFor,
  disabled = false,
  onCancelled,
}: {
  confirmationId?: string
  /** El PCC en el que se reservó (vacío, el de auth). */
  targetPcc?: string
  /** Los boletos `TE` de la reserva: con alguno, se anulan en la misma llamada (F16.3). */
  liveTickets?: string[]
  /** Qué falta para poder limpiar, si falta algo (p. ej. leer los boletos después de emitir). */
  waitingFor?: string
  disabled?: boolean
  onCancelled: (ok: boolean) => void
}) {
  const { environment } = useEnvironment()
  const { run, pending, execute } = useStep("booking.cancel", cancelBooking)
  const [confirming, setConfirming] = useState(false)
  const voiding = liveTickets.length > 0 && !environment.readOnly
  const uncertain = uncertainOf(run)

  const cancel = () => {
    setConfirming(false)
    if (confirmationId === undefined) return
    const input: BookingCancelInput = {
      confirmationId,
      retrieveBooking: false,
      targetPcc,
      voidTickets: voiding,
    }
    execute(input, (result) => onCancelled(result.enabled && result.step.ok))
  }

  return (
    <>
      <StepPanel
        title="booking.cancel"
        description={
          <>
            Limpia la reserva: cancela todos los segmentos (
            <code>cancelAll</code>
            ), sin reintento. No se usa <code>isCancelable</code>: no dice si se
            puede cancelar. Si se emitió, anula los boletos en la misma llamada
            (<code>VOID</code>, irreversible).
          </>
        }
        run={run}
        pending={pending}
        form={
          <div className="flex flex-col gap-4">
            <Locator confirmationId={confirmationId} waitingFor={waitingFor} />
            <Button
              variant="destructive"
              onClick={() => setConfirming(true)}
              disabled={
                pending ||
                disabled ||
                confirmationId === undefined ||
                waitingFor !== undefined ||
                environment.readOnly ||
                uncertain !== undefined
              }
            >
              {voiding ? "Anular boletos y limpiar" : "Limpiar"}
            </Button>
            {uncertain !== undefined && (
              <p className="text-muted-foreground text-xs">
                El último intento quedó incierto: verifica abajo antes de hacer
                otra cosa con la reserva.
              </p>
            )}
            {environment.readOnly && <ReadOnlyNote />}
            <AlertDialog open={confirming} onOpenChange={setConfirming}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {voiding
                      ? "¿Anular los boletos y cancelar la reserva?"
                      : "¿Cancelar la reserva?"}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {voiding &&
                      `Se anulan los boletos ${liveTickets.join(", ")}: el void es irreversible. `}
                    Se cancelan todos los segmentos de{" "}
                    <code className="font-mono">{confirmationId}</code> en{" "}
                    {environment.label}. No se puede deshacer.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Volver</AlertDialogCancel>
                  <AlertDialogAction variant="destructive" onClick={cancel}>
                    {voiding ? "Anular y cancelar" : "Cancelar reserva"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        }
      />
      {uncertain !== undefined && confirmationId !== undefined && (
        <VerifyPanel
          uncertain={uncertain}
          confirmationId={confirmationId}
          targetPcc={targetPcc}
          statusText={VOID_VERIFY_STATUS_TEXT}
          onVerified={(status) => {
            // Sin boletos vigentes, el void se hizo y la reserva quedó cancelada.
            if (status === "notFound") onCancelled(true)
          }}
        />
      )}
    </>
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
/** Los boletos del PNR (`flightTickets`), con su `ticketStatusCode`. */
function BookingTicketsView({ result }: { result: unknown }) {
  const tickets = bookingTicketsOf(result)
  const live = liveTicketsOf(result)
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm">
        {live.length === 0
          ? "El PNR no tiene boletos TE: Limpiar cancela sin VOID."
          : `Boletos TE: ${live.join(", ")}. Limpiar los anula.`}
      </p>
      <TicketsTable tickets={tickets} />
    </div>
  )
}

function CancelledCheck({
  result,
  voided,
}: {
  result: unknown
  voided: readonly string[]
}) {
  const notVoided = notVoidedOf(result, voided)
  if (notVoided.length > 0) {
    return (
      <div className="flex flex-col gap-3">
        <Alert variant="destructive">
          <CircleX />
          <AlertTitle>Boletos sin anular en el PNR</AlertTitle>
          <AlertDescription>
            {notVoided.join(", ")} no están en <code>TV</code>. Verifica antes
            de hacer otra cosa: no se reintenta.
          </AlertDescription>
        </Alert>
        <TicketsTable tickets={bookingTicketsOf(result)} />
      </div>
    )
  }
  if (hasNoFlights(result)) {
    return (
      <div className="flex flex-col gap-3">
        <Alert>
          <CircleCheck />
          <AlertTitle>Reserva cancelada</AlertTitle>
          <AlertDescription>
            Get Booking ya no trae <code>flights</code>
            {voided.length > 0 && ` y ${voided.join(", ")} quedaron en TV`}. El
            PNR sigue existiendo, sin itinerario.
          </AlertDescription>
        </Alert>
        {voided.length > 0 && (
          <TicketsTable tickets={bookingTicketsOf(result)} />
        )}
      </div>
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
