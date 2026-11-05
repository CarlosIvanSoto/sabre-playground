"use client"

import {
  Armchair,
  CircleAlert,
  CircleCheck,
  ExternalLink,
  Info,
} from "lucide-react"
import Link from "next/link"
import type { ReactNode } from "react"
import { useState } from "react"
import type { GetBookingResponse } from "sabre-client"
import { cancelBooking, getBooking } from "@/app/(console)/booking/actions"
import { JsonTree } from "@/components/custom/json-tree"
import { EnvironmentBadge } from "@/components/environment/environment-badge"
import { useEnvironment } from "@/components/environment/environment-provider"
import { Confirm } from "@/components/queue-desk/desk-write"
import { RawBody } from "@/components/step/raw-body"
import { useStep } from "@/components/step/use-step"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { bookingHref, failureOf } from "@/lib/queue-desk"
import type { StepRun } from "@/lib/step/types"

/**
 * La hoja de reserva de la mesa (F9.4, ADR-025): `booking.get` del PNR en pantalla, por REST
 * y sin la sesión SOAP, con *Resultado*, *Crudo* y *Error*, y los enlaces a la reserva en otra
 * pestaña (`/booking?confirmationId=`) y al mapa de asientos (flujo 3).
 *
 * Con un PCC de trabajo (F9.6), `get` y `cancel` lo mandan como `targetPcc`, y el mapa de
 * asientos queda deshabilitado: `byPnrLocator` no tiene `targetPcc` (ADR-017).
 *
 * Cancelar desde la hoja (decisión del usuario, 2026-11-05):
 * - Solo fuera de producción. En producción el botón sale deshabilitado con la razón, y la
 *   server action del flujo 4 lo rechaza igual. El desbloqueo de colas no lo habilita.
 * - Se confirma en un popover ("Cancelar AAAAAA (irreversible)") y después corre un
 *   `booking.get` que lo comprueba.
 * - Cancelar no saca el PNR de la cola: después la hoja ofrece sacarlo (`remove`), con su
 *   propia confirmación. No se encadenan solos.
 */
export function BookingSheet({
  locator,
  pcc,
  run,
  pending,
  onClose,
  removeFromQueue,
}: {
  /** El localizador abierto; sin él, la hoja está cerrada. */
  locator?: string
  /** El PCC de trabajo: el `targetPcc`. Vacío es el de la sesión. */
  pcc: string
  /** El `booking.get` que corrió la mesa al abrir la hoja. */
  run?: StepRun
  pending: boolean
  onClose: () => void
  /** "Sacar de la cola", si el PNR sigue en pantalla dentro de la cola. */
  removeFromQueue?: ReactNode
}) {
  return (
    // No modal: la mesa sigue a la vista, sin velo, para leer la reserva junto al párrafo.
    <Sheet
      modal={false}
      open={locator !== undefined}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <SheetContent showOverlay={false} className="w-full gap-0 sm:max-w-xl">
        {locator !== undefined && (
          <SheetBody
            key={locator}
            locator={locator}
            pcc={pcc}
            run={run}
            pending={pending}
            removeFromQueue={removeFromQueue}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}

function SheetBody({
  locator,
  pcc,
  run,
  pending,
  removeFromQueue,
}: {
  locator: string
  pcc: string
  run?: StepRun
  pending: boolean
  removeFromQueue?: ReactNode
}) {
  const { environment } = useEnvironment()
  const cancel = useStep("booking.cancel", cancelBooking)
  const verify = useStep("booking.get", getBooking)

  const read = failureOf(run) === undefined && run?.enabled === true
  const cancelReason = environment.readOnly
    ? "Cancel Booking no corre en producción (solo lectura). El desbloqueo de colas no lo habilita."
    : !read
      ? "Primero tiene que leerse la reserva."
      : undefined
  const cancelled =
    cancel.run !== undefined && failureOf(cancel.run) === undefined

  return (
    <>
      <SheetHeader className="border-b">
        <SheetTitle className="flex items-center gap-2">
          Reserva <span className="font-mono">{locator}</span>
          <EnvironmentBadge environment={environment.id} />
        </SheetTitle>
        <SheetDescription>
          <code>booking.get</code> por REST, sin la sesión SOAP de la cola.
          {pcc !== "" && (
            <>
              {" "}
              Con <code>targetPcc</code> {pcc}.
            </>
          )}
        </SheetDescription>
        <div className="flex flex-wrap gap-2">
          <Link
            href={bookingHref(locator, pcc)}
            target="_blank"
            rel="noopener"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <ExternalLink />
            En pestaña
          </Link>
          {pcc === "" ? (
            <Link
              href={`/seats?pnrLocator=${locator}`}
              target="_blank"
              rel="noopener"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <Armchair />
              Mapa de asientos
            </Link>
          ) : (
            <Button
              variant="outline"
              size="sm"
              disabled
              title={SEATS_OTHER_PCC}
            >
              <Armchair />
              Mapa de asientos
            </Button>
          )}
        </div>
        {pcc !== "" && (
          <p className="text-muted-foreground text-xs">{SEATS_OTHER_PCC}</p>
        )}
      </SheetHeader>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
        <StepTabs run={run} pending={pending} name={`booking-${locator}`} />
        <section className="flex flex-col gap-2 border-t pt-4">
          <h3 className="text-sm font-medium">Cancelar la reserva</h3>
          {!cancelled && (
            <Confirm
              label="Cancelar reserva"
              method="booking.cancel"
              variant="destructive"
              side="top"
              disabled={cancel.pending || cancelReason !== undefined}
              title={`Cancelar ${locator} (irreversible)`}
              summary={`Se cancelan todos los segmentos de ${locator} en ${environment.label}${pcc === "" ? "" : `, PCC ${pcc}`} (cancelAll). No se puede deshacer, y el PNR sigue en la cola.`}
              onConfirm={() =>
                cancel.execute(
                  { confirmationId: locator, targetPcc: pcc },
                  (result) => {
                    if (failureOf(result) === undefined) {
                      verify.execute({
                        confirmationId: locator,
                        surname: "",
                        targetPcc: pcc,
                      })
                    }
                  }
                )
              }
            />
          )}
          {cancelReason !== undefined && (
            <p className="text-muted-foreground text-xs">{cancelReason}</p>
          )}
          {cancel.pending && <Spinner />}
          {cancel.run !== undefined && !cancelled && (
            <Alert variant="destructive">
              <CircleAlert />
              <AlertTitle>No se canceló</AlertTitle>
              <AlertDescription className="break-words">
                {failureOf(cancel.run)}
              </AlertDescription>
            </Alert>
          )}
          {cancelled && (
            <>
              <Alert>
                <CircleCheck />
                <AlertTitle>{locator} cancelada</AlertTitle>
                <AlertDescription>
                  Comprobación con <code>booking.get</code>:
                </AlertDescription>
              </Alert>
              <StepTabs
                run={verify.run}
                pending={verify.pending}
                name={`booking-${locator}-verify`}
              />
              <Alert>
                <Info />
                <AlertTitle>El PNR sigue en la cola</AlertTitle>
                <AlertDescription>
                  Cancelar no lo saca. Si hace falta, sácalo aparte: tiene su
                  propia confirmación.
                </AlertDescription>
              </Alert>
              {removeFromQueue ?? (
                <p className="text-muted-foreground text-xs">
                  {locator} ya no está en pantalla dentro de una cola: para
                  sacarlo, entra a su cola.
                </p>
              )}
            </>
          )}
        </section>
      </div>
    </>
  )
}

/** Por qué el mapa de asientos no se ofrece con otro PCC. */
const SEATS_OTHER_PCC =
  "Mapa de asientos: byPnrLocator no tiene targetPcc y solo lee PNR del PCC de auth (ADR-017)."

type Tab = "result" | "raw" | "error"

/** *Resultado* (resumen y JSON), *Crudo* y *Error* de un `booking.get`. */
function StepTabs({
  run,
  pending,
  name,
}: {
  run?: StepRun
  pending: boolean
  name: string
}) {
  const [tab, setTab] = useState<Tab>("result")
  if (pending || run === undefined) return <Spinner />
  if (!run.enabled) {
    return <p className="text-muted-foreground text-sm">{run.reason}</p>
  }
  const { step } = run
  const failure = failureOf(run)
  const hasErrors =
    failure !== undefined ||
    (step.warnings?.length ?? 0) > 0 ||
    (step.partialErrors?.length ?? 0) > 0
  return (
    <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)}>
      <TabsList>
        <TabsTrigger value="result">Resultado</TabsTrigger>
        <TabsTrigger value="raw">Crudo</TabsTrigger>
        <TabsTrigger value="error">Error{hasErrors ? " ●" : ""}</TabsTrigger>
      </TabsList>
      <TabsContent value="result" className="flex flex-col gap-3">
        {step.ok ? (
          <>
            <BookingSummary booking={step.result as GetBookingResponse} />
            <JsonTree value={step.result} filename={`${name}.result.json`} />
          </>
        ) : (
          <p className="text-destructive text-sm break-words">{failure}</p>
        )}
      </TabsContent>
      <TabsContent value="raw">
        {step.raw === undefined ? (
          <p className="text-muted-foreground text-sm">Sin respuesta cruda.</p>
        ) : (
          <RawBody raw={step.raw} name={name} />
        )}
      </TabsContent>
      <TabsContent value="error" className="flex flex-col gap-3">
        {!hasErrors && (
          <p className="text-muted-foreground text-sm">Sin errores.</p>
        )}
        {failure !== undefined && (
          <JsonTree value={step.error} filename={`${name}.error.json`} />
        )}
        {step.warnings !== undefined && (
          <JsonTree value={step.warnings} filename={`${name}.warnings.json`} />
        )}
        {step.partialErrors !== undefined && (
          <JsonTree
            value={step.partialErrors}
            filename={`${name}.errors.json`}
          />
        )}
      </TabsContent>
    </Tabs>
  )
}

/** El primer nivel tipado de `GetBookingResponse` y cuántos vuelos y pasajeros trae. */
function BookingSummary({ booking }: { booking: GetBookingResponse }) {
  const size = (value: unknown) =>
    Array.isArray(value) ? String(value.length) : "—"
  const flag = (value?: boolean) =>
    value === undefined ? "—" : value ? "sí" : "no"
  const rows: [string, string][] = [
    ["bookingId", booking.bookingId ?? "—"],
    [
      "fechas",
      [booking.startDate, booking.endDate].filter(Boolean).join(" → ") || "—",
    ],
    ["isCancelable", flag(booking.isCancelable)],
    ["isTicketed", flag(booking.isTicketed)],
    ["vuelos", size(booking.flights)],
    ["pasajeros", size(booking.travelers)],
  ]
  return (
    <dl className="grid grid-cols-[7rem_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-muted-foreground font-mono text-xs leading-5">
            {label}
          </dt>
          <dd className="font-mono text-xs leading-5 break-words">{value}</dd>
        </div>
      ))}
    </dl>
  )
}
