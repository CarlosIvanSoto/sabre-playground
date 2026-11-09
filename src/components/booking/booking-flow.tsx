"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import Link from "next/link"
import { type ComponentProps, useState } from "react"
import {
  Controller,
  type FieldError as FieldErrorType,
  useForm,
} from "react-hook-form"
import {
  cancelBooking,
  getBooking,
  reservationHistory,
} from "@/app/(console)/booking/actions"
import { PnrHistoryView } from "@/components/booking/pnr-history"
import { useEnvironment } from "@/components/environment/environment-provider"
import { useSessionStatus } from "@/components/session/use-session-status"
import { StepPanel } from "@/components/step/step-panel"
import { useStep } from "@/components/step/use-step"
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
import { Checkbox } from "@/components/ui/checkbox"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  type BookingCancelInput,
  type BookingGetInput,
  bookingCancelSchema,
  bookingGetSchema,
  MISSING_LOCATOR,
  type ReservationHistoryInput,
  reservationHistorySchema,
} from "@/lib/booking"

/**
 * Flujo 4: leer o cancelar una reserva por su localizador, y ver su historial
 * (`reservation.history`, F12.3). Cancel pide confirmación y no aparece con un entorno de solo
 * lectura (producción).
 */
export function BookingFlow({
  initialConfirmationId,
  initialTargetPcc,
}: {
  /** De `?confirmationId=`: prellena `booking.get`. */
  initialConfirmationId?: string
  /** De `?targetPcc=`: prellena el PCC de `booking.get`. */
  initialTargetPcc?: string
}) {
  const { environment } = useEnvironment()
  return (
    <>
      <BookingGetStep
        initialConfirmationId={initialConfirmationId}
        initialTargetPcc={initialTargetPcc}
      />
      <HistoryStep initialLocator={initialConfirmationId} />
      {!environment.readOnly && <BookingCancelStep />}
    </>
  )
}

/**
 * `reservation.history`: SOAP, en la sesión registrada del navegador (la de `/session` o la
 * mesa). También corre en fake, donde `AAAAAA` trae una historia sembrada.
 */
function HistoryStep({ initialLocator }: { initialLocator?: string }) {
  const { status } = useSessionStatus()
  const { run, pending, execute } = useStep(
    "reservation.history",
    reservationHistory
  )
  const form = useForm<ReservationHistoryInput>({
    resolver: zodResolver(reservationHistorySchema),
    defaultValues: { locator: initialLocator ?? MISSING_LOCATOR },
  })
  const errors = form.formState.errors
  const open = status?.open === true
  const inside = status?.open === true && status.queueState === "inside"

  return (
    <StepPanel
      title="reservation.history"
      description={
        <>
          <code>TravelItineraryHistoryLLSRQ</code> (el <code>*H</code> del
          host): una entrada por transacción, con quién la firmó, cuándo y lo
          que cambió. Es SOAP: usa la sesión abierta. Dentro de una cola, Sabre
          solo acepta el PNR en pantalla; otro da <code>NAK6</code> (Q-102).
        </>
      }
      run={run}
      pending={pending}
      resultView={(result) => <PnrHistoryView result={result} />}
      form={
        <form
          onSubmit={form.handleSubmit((input) => execute(input))}
          className="flex flex-col gap-4"
        >
          <Field data-invalid={errors.locator !== undefined}>
            <FieldLabel htmlFor="history-locator">Localizador</FieldLabel>
            <Input
              id="history-locator"
              className="font-mono uppercase"
              maxLength={6}
              aria-invalid={errors.locator !== undefined}
              {...form.register("locator")}
            />
            <FieldDescription>
              Seis letras o dígitos. Sin localizador (<code>JX HST</code>) no se
              ofrece.
            </FieldDescription>
            <FieldError errors={[errors.locator]} />
          </Field>
          {!open && (
            <FieldDescription>
              Abre una sesión primero, en{" "}
              <Link href="/session" className="underline">
                Sesión
              </Link>{" "}
              o en la mesa de colas.
            </FieldDescription>
          )}
          {inside && (
            <FieldDescription>
              La sesión está dentro de una cola: con otro PNR que el de
              pantalla, Sabre responde <code>NAK6</code> y la sesión sigue en la
              cola.
            </FieldDescription>
          )}
          <Button type="submit" disabled={pending || !open}>
            Ver historial
          </Button>
        </form>
      }
    />
  )
}

function BookingGetStep({
  initialConfirmationId,
  initialTargetPcc,
}: {
  initialConfirmationId?: string
  initialTargetPcc?: string
}) {
  const { run, pending, execute } = useStep("booking.get", getBooking)
  const form = useForm<BookingGetInput>({
    resolver: zodResolver(bookingGetSchema),
    defaultValues: {
      confirmationId: initialConfirmationId ?? MISSING_LOCATOR,
      surname: "",
      targetPcc: initialTargetPcc ?? "",
    },
  })
  const errors = form.formState.errors

  return (
    <StepPanel
      title="booking.get"
      description={
        <>
          Lee la reserva completa. Con <code>{MISSING_LOCATOR}</code>, que no
          existe, termina en <code>BOOKING_NOT_FOUND</code>.
        </>
      }
      run={run}
      pending={pending}
      form={
        <form
          onSubmit={form.handleSubmit((input) => execute(input))}
          className="flex flex-col gap-4"
        >
          <Field data-invalid={errors.confirmationId !== undefined}>
            <FieldLabel htmlFor="get-confirmationId">Localizador</FieldLabel>
            <Input
              id="get-confirmationId"
              className="font-mono uppercase"
              aria-invalid={errors.confirmationId !== undefined}
              {...form.register("confirmationId")}
            />
            <FieldError errors={[errors.confirmationId]} />
          </Field>
          <Field data-invalid={errors.surname !== undefined}>
            <FieldLabel htmlFor="get-surname">Apellido (opcional)</FieldLabel>
            <Input
              id="get-surname"
              className="uppercase"
              placeholder="TEST"
              aria-invalid={errors.surname !== undefined}
              {...form.register("surname")}
            />
            <FieldDescription>
              Si no coincide con el PNR, Sabre responde{" "}
              <code>UNAUTHORIZED_ACCESS</code>.
            </FieldDescription>
            <FieldError errors={[errors.surname]} />
          </Field>
          <TargetPccField
            id="get-targetPcc"
            error={errors.targetPcc}
            {...form.register("targetPcc")}
          />
          <Button type="submit" disabled={pending}>
            Correr
          </Button>
        </form>
      }
    />
  )
}

function BookingCancelStep() {
  const { environment } = useEnvironment()
  const { run, pending, execute } = useStep("booking.cancel", cancelBooking)
  const form = useForm<BookingCancelInput>({
    resolver: zodResolver(bookingCancelSchema),
    defaultValues: {
      confirmationId: MISSING_LOCATOR,
      targetPcc: "",
      retrieveBooking: false,
    },
  })
  const errors = form.formState.errors
  // Lo validado, esperando la confirmación del diálogo.
  const [pendingInput, setPendingInput] = useState<BookingCancelInput>()

  const confirm = () => {
    if (pendingInput !== undefined) execute(pendingInput)
    setPendingInput(undefined)
  }

  return (
    <StepPanel
      title="booking.cancel"
      description={
        <>
          Cancela todos los segmentos (<code>cancelAll</code>), sin reintento.
          Si no se canceló nada, el SDK lanza <code>NO_ITEMS_CANCELLED</code>.
          No aparece en producción.
        </>
      }
      run={run}
      pending={pending}
      form={
        <form
          onSubmit={form.handleSubmit((input) => setPendingInput(input))}
          className="flex flex-col gap-4"
        >
          <Field data-invalid={errors.confirmationId !== undefined}>
            <FieldLabel htmlFor="cancel-confirmationId">Localizador</FieldLabel>
            <Input
              id="cancel-confirmationId"
              className="font-mono uppercase"
              aria-invalid={errors.confirmationId !== undefined}
              {...form.register("confirmationId")}
            />
            <FieldError errors={[errors.confirmationId]} />
          </Field>
          <TargetPccField
            id="cancel-targetPcc"
            error={errors.targetPcc}
            {...form.register("targetPcc")}
          />
          <Controller
            control={form.control}
            name="retrieveBooking"
            render={({ field }) => (
              <Field orientation="horizontal">
                <Checkbox
                  id="cancel-retrieveBooking"
                  checked={field.value ?? false}
                  onCheckedChange={field.onChange}
                />
                <FieldLabel htmlFor="cancel-retrieveBooking">
                  Traer la reserva después de cancelar
                </FieldLabel>
              </Field>
            )}
          />
          <Button type="submit" variant="destructive" disabled={pending}>
            Cancelar reserva
          </Button>
          <AlertDialog
            open={pendingInput !== undefined}
            onOpenChange={(open) => {
              if (!open) setPendingInput(undefined)
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Cancelar la reserva?</AlertDialogTitle>
                <AlertDialogDescription>
                  Se cancelan todos los segmentos de{" "}
                  <code className="font-mono">
                    {pendingInput?.confirmationId.trim().toUpperCase()}
                  </code>{" "}
                  en {environment.label}
                  {pendingInput?.targetPcc?.trim() &&
                    `, PCC ${pendingInput.targetPcc.trim().toUpperCase()}`}
                  . No se puede deshacer.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Volver</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={confirm}>
                  Cancelar reserva
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </form>
      }
    />
  )
}

/** `targetPcc` opcional: el cambio de contexto de Booking Management. */
function TargetPccField({
  id,
  error,
  ...input
}: { id: string; error?: FieldErrorType } & ComponentProps<"input">) {
  return (
    <Field data-invalid={error !== undefined}>
      <FieldLabel htmlFor={id}>PCC (opcional)</FieldLabel>
      <Input
        id={id}
        className="font-mono uppercase"
        maxLength={4}
        aria-invalid={error !== undefined}
        {...input}
      />
      <FieldDescription>
        <code>targetPcc</code>. Vacío es el PCC de auth.
      </FieldDescription>
      <FieldError errors={[error]} />
    </Field>
  )
}
