"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { StepPanel } from "@/components/step/step-panel"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import type { StepRun } from "@/lib/step/types"
import {
  countFakeQueues,
  getBooking,
  openAndCloseSession,
  searchFlights,
} from "./actions"
import {
  type BookingGetInput,
  bookingGetSchema,
  MISSING_LOCATOR,
} from "./schema"

export function BookingGetProbe() {
  const [run, setRun] = useState<StepRun>()
  const [pending, startTransition] = useTransition()
  const form = useForm<BookingGetInput>({
    resolver: zodResolver(bookingGetSchema),
    defaultValues: { confirmationId: MISSING_LOCATOR },
  })
  const error = form.formState.errors.confirmationId

  const onSubmit = form.handleSubmit((input) =>
    startTransition(async () => {
      setRun(await getBooking(input))
    })
  )

  return (
    <StepPanel
      title="booking.get"
      description="Lee una reserva por localizador. El default no existe: termina en BOOKING_NOT_FOUND."
      run={run}
      pending={pending}
      form={
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <Field data-invalid={error !== undefined}>
            <FieldLabel htmlFor="confirmationId">Localizador</FieldLabel>
            <Input
              id="confirmationId"
              className="font-mono uppercase"
              aria-invalid={error !== undefined}
              {...form.register("confirmationId")}
            />
            <FieldError errors={[error]} />
          </Field>
          <Button type="submit" disabled={pending}>
            Correr
          </Button>
        </form>
      }
    />
  )
}

/** Un paso sin formulario: solo el botón de correr. */
function ButtonProbe({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action: () => Promise<StepRun>
}) {
  const [run, setRun] = useState<StepRun>()
  const [pending, startTransition] = useTransition()

  return (
    <StepPanel
      title={title}
      description={description}
      run={run}
      pending={pending}
      form={
        <Button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setRun(await action())
            })
          }
        >
          Correr
        </Button>
      }
    />
  )
}

export function SessionProbe() {
  return (
    <ButtonProbe
      title="openSession + close"
      description="Abre una sesión SOAP y la cierra en el mismo paso."
      action={openAndCloseSession}
    />
  )
}

export function SearchProbe() {
  return (
    <ButtonProbe
      title="air.bargainFinderMax"
      description="Ida MEX → CUN dentro de 30 días, 1 adulto. Una respuesta REST grande."
      action={searchFlights}
    />
  )
}

export function FakeQueueProbe() {
  return (
    <ButtonProbe
      title="session.queue.count (fake)"
      description="Contra createQueueFake, sin red ni credenciales: un sobre SOAP de cola con datos sintéticos."
      action={countFakeQueues}
    />
  )
}
