"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { cancelBooking, getBooking } from "@/app/(console)/booking/actions"
import { useEnvironment } from "@/components/environment/environment-provider"
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
} from "@/lib/booking"

/**
 * Flujo 4: leer o cancelar una reserva por su localizador. Cancel pide confirmación y no
 * aparece con un entorno de solo lectura (producción).
 */
export function BookingFlow({
  initialConfirmationId,
}: {
  /** De `?confirmationId=`: prellena `booking.get`. */
  initialConfirmationId?: string
}) {
  const { environment } = useEnvironment()
  return (
    <>
      <BookingGetStep initialConfirmationId={initialConfirmationId} />
      {!environment.readOnly && <BookingCancelStep />}
    </>
  )
}

function BookingGetStep({
  initialConfirmationId,
}: {
  initialConfirmationId?: string
}) {
  const { run, pending, execute } = useStep("booking.get", getBooking)
  const form = useForm<BookingGetInput>({
    resolver: zodResolver(bookingGetSchema),
    defaultValues: {
      confirmationId: initialConfirmationId ?? MISSING_LOCATOR,
      surname: "",
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
    defaultValues: { confirmationId: MISSING_LOCATOR, retrieveBooking: false },
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
                  en {environment.label}. No se puede deshacer.
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
