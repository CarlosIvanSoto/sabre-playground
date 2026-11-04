"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { getSeatsByPnr } from "@/app/(console)/seats/actions"
import { SeatMapView } from "@/components/seats/seat-map"
import { StepPanel } from "@/components/step/step-panel"
import { useStep } from "@/components/step/use-step"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { type SeatsByPnrInput, seatsByPnrSchema } from "@/lib/seats"

/** Flujo 3: el mapa de asientos de un PNR existente, por localizador. */
export function SeatsFlow() {
  const { run, pending, execute } = useStep("air.getSeats", getSeatsByPnr)
  const form = useForm<SeatsByPnrInput>({
    resolver: zodResolver(seatsByPnrSchema),
    defaultValues: { pnrLocator: "" },
  })
  const error = form.formState.errors.pnrLocator

  return (
    <StepPanel
      title="air.getSeats"
      description={
        <>
          Mapa de asientos por <code>pnrLocator</code>. Solo lee PNR del PCC de
          auth (<code>byPnrLocator</code> no tiene <code>targetPcc</code>) y no
          ve cambios sin confirmar.
        </>
      }
      run={run}
      pending={pending}
      resultView={(result) => <SeatMapView result={result} />}
      form={
        <form
          onSubmit={form.handleSubmit((input) => execute(input))}
          className="flex flex-col gap-4"
        >
          <Field data-invalid={error !== undefined}>
            <FieldLabel htmlFor="pnrLocator">Localizador</FieldLabel>
            <Input
              id="pnrLocator"
              className="font-mono uppercase"
              aria-invalid={error !== undefined}
              {...form.register("pnrLocator")}
            />
            <FieldDescription>
              Un PNR que exista en el entorno, con vuelos.
            </FieldDescription>
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
