"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, type Path, useForm } from "react-hook-form"
import { armFakeTicketing } from "@/app/(console)/booking/actions"
import { useSessionStatus } from "@/components/session/use-session-status"
import { StepPanel } from "@/components/step/step-panel"
import { useStep } from "@/components/step/use-step"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DEFAULT_FAKE_TICKETING,
  DONE_OPTIONS,
  FAKE_BOOKING_OPEN,
  FAKE_BOOKING_TICKETED,
  FAKE_TICKET,
  type FakeTicketingInput,
  FULFILL_OPTIONS,
  fakeTicketingSchema,
  type OutcomeOption,
  VOID_OPTIONS,
} from "@/lib/fake-ticketing"

/**
 * Solo en fake (F16.6, #164): elegir el desenlace de la siguiente emisión y del siguiente void.
 * Rearma el fake, porque el de la 0.7.0 no deja cambiar sus desenlaces después de crearse.
 */
export function FakeTicketingStep() {
  const { status } = useSessionStatus()
  const open = status?.open === true
  const { run, pending, execute } = useStep("fake.ticketing", armFakeTicketing)
  const form = useForm<FakeTicketingInput>({
    resolver: zodResolver(fakeTicketingSchema),
    defaultValues: DEFAULT_FAKE_TICKETING,
  })
  const fulfill = form.watch("fulfill")
  const voided = form.watch("void")
  const isUncertain = (options: readonly OutcomeOption[], value: string) =>
    options.find((option) => option.value === value)?.uncertain === true

  return (
    <StepPanel
      title="Desenlaces del fake"
      description={
        <>
          El fake REST de <code>sabre-client/testing</code> 0.7.0 comparte el{" "}
          <code>fetch</code> con las colas. Reservas sembradas:{" "}
          <code>{FAKE_BOOKING_OPEN}</code> sin boletos, para emitir, y{" "}
          <code>{FAKE_BOOKING_TICKETED}</code> con el boleto{" "}
          <code>{FAKE_TICKET}</code> en <code>TE</code>, para anular, más los
          PNR de las colas. Elegir un desenlace <strong>rearma el fake</strong>:
          colas, reservas y ventas vuelven a como se sembraron.
        </>
      }
      run={run}
      pending={pending}
      form={
        <form
          onSubmit={form.handleSubmit((input) => execute(input))}
          className="flex flex-col gap-4"
        >
          <OutcomeSelect
            form={form}
            name="fulfill"
            label="Siguiente tickets.fulfill"
            options={FULFILL_OPTIONS}
          />
          {isUncertain(FULFILL_OPTIONS, fulfill) && (
            <DoneSelect form={form} name="fulfillDone" label="¿Emitió?" />
          )}
          <OutcomeSelect
            form={form}
            name="void"
            label="Siguiente booking.cancel con VOID"
            options={VOID_OPTIONS}
          />
          {isUncertain(VOID_OPTIONS, voided) && (
            <DoneSelect form={form} name="voidDone" label="¿Anuló?" />
          )}
          <Button type="submit" variant="outline" disabled={pending || open}>
            Rearmar el fake
          </Button>
          {open && (
            <FieldDescription>
              Para rearmarlo, primero cierra la sesión.
            </FieldDescription>
          )}
        </form>
      }
    />
  )
}

type Form = ReturnType<typeof useForm<FakeTicketingInput>>

function OutcomeSelect({
  form,
  name,
  label,
  options,
}: {
  form: Form
  name: Path<FakeTicketingInput>
  label: string
  options: readonly OutcomeOption[]
}) {
  return (
    <Controller
      control={form.control}
      name={name}
      render={({ field }) => (
        <Field>
          <FieldLabel htmlFor={`fake-${name}`}>{label}</FieldLabel>
          <Select
            items={options}
            value={field.value}
            onValueChange={(value) => {
              if (value !== null) field.onChange(value)
            }}
          >
            <SelectTrigger id={`fake-${name}`} className="font-mono">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem
                  key={option.value}
                  value={option.value}
                  className="font-mono"
                >
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}
    />
  )
}

function DoneSelect({
  form,
  name,
  label,
}: {
  form: Form
  name: Path<FakeTicketingInput>
  label: string
}) {
  return (
    <OutcomeSelect
      form={form}
      name={name}
      label={label}
      options={DONE_OPTIONS}
    />
  )
}
