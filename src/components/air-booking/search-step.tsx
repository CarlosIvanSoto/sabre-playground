"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { searchFlights } from "@/app/(console)/air-booking/actions"
import { ItineraryList } from "@/components/air-booking/itinerary-list"
import { StepPanel } from "@/components/step/step-panel"
import { useStep } from "@/components/step/use-step"
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
  SEARCH_DEFAULTS,
  type SearchInput,
  type SearchQuery,
  searchSchema,
} from "@/lib/air-booking"
import type { SearchSelection } from "@/lib/air-booking-journey"

/** Paso 1 (F3.1): Bargain Finder Max con un formulario mínimo, y elegir un itinerario. */
export function SearchStep({
  selection,
  disabled = false,
  onStart,
  onDone,
  onSelect,
}: {
  selection?: SearchSelection
  /** El recorrido no deja buscar (p. ej. hay una reserva sin limpiar). */
  disabled?: boolean
  onStart: () => void
  onDone: (ok: boolean) => void
  onSelect: (selection: SearchSelection) => void
}) {
  const { run, pending, execute } = useStep(
    "air.bargainFinderMax",
    searchFlights
  )
  // La búsqueda que produjo el resultado que se ve, no la que hay escrita en el formulario.
  const [submitted, setSubmitted] = useState<SearchQuery>()
  const form = useForm<SearchInput, unknown, SearchQuery>({
    resolver: zodResolver(searchSchema),
    defaultValues: SEARCH_DEFAULTS,
  })
  const errors = form.formState.errors

  const submit = (input: SearchQuery) => {
    setSubmitted(input)
    // Una búsqueda nueva deja sin efecto la elección anterior.
    onStart()
    execute(input, (result) => onDone(result.enabled && result.step.ok))
  }

  return (
    <StepPanel
      title="air.bargainFinderMax"
      description={
        <>
          Busca itinerarios de solo ida para adultos (<code>ADT</code>). La
          aerolínea y &quot;solo directos&quot; van a <code>VendorPref</code> y{" "}
          <code>MaxStopsQuantity</code>. En CERT, DFW→LAX con AA sí deja
          reservar.
        </>
      }
      run={run}
      pending={pending}
      resultView={(result) =>
        submitted === undefined ? null : (
          <ItineraryList
            result={result}
            chosenKey={selection?.key}
            onChoose={
              disabled
                ? undefined
                : (key, chosen) =>
                    onSelect({ ...chosen, key, query: submitted })
            }
          />
        )
      }
      form={
        <form
          onSubmit={form.handleSubmit(submit)}
          className="flex flex-col gap-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <Field data-invalid={errors.origin !== undefined}>
              <FieldLabel htmlFor="search-origin">Origen</FieldLabel>
              <Input
                id="search-origin"
                className="font-mono uppercase"
                aria-invalid={errors.origin !== undefined}
                {...form.register("origin")}
              />
              <FieldError errors={[errors.origin]} />
            </Field>
            <Field data-invalid={errors.destination !== undefined}>
              <FieldLabel htmlFor="search-destination">Destino</FieldLabel>
              <Input
                id="search-destination"
                className="font-mono uppercase"
                aria-invalid={errors.destination !== undefined}
                {...form.register("destination")}
              />
              <FieldError errors={[errors.destination]} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field data-invalid={errors.departureDate !== undefined}>
              <FieldLabel htmlFor="search-date">Fecha</FieldLabel>
              <Input
                id="search-date"
                type="date"
                aria-invalid={errors.departureDate !== undefined}
                {...form.register("departureDate")}
              />
              <FieldError errors={[errors.departureDate]} />
            </Field>
            <Field data-invalid={errors.adults !== undefined}>
              <FieldLabel htmlFor="search-adults">Adultos</FieldLabel>
              <Input
                id="search-adults"
                type="number"
                min={1}
                max={4}
                aria-invalid={errors.adults !== undefined}
                {...form.register("adults")}
              />
              <FieldError errors={[errors.adults]} />
            </Field>
          </div>
          <Field data-invalid={errors.airline !== undefined}>
            <FieldLabel htmlFor="search-airline">
              Aerolínea (opcional)
            </FieldLabel>
            <Input
              id="search-airline"
              className="font-mono uppercase"
              aria-invalid={errors.airline !== undefined}
              {...form.register("airline")}
            />
            <FieldDescription>
              Código IATA, p. ej. <code>AA</code>. Vacío: cualquiera.
            </FieldDescription>
            <FieldError errors={[errors.airline]} />
          </Field>
          <Controller
            control={form.control}
            name="directOnly"
            render={({ field }) => (
              <Field orientation="horizontal">
                <Checkbox
                  id="search-directOnly"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
                <FieldLabel htmlFor="search-directOnly">
                  Solo directos
                </FieldLabel>
              </Field>
            )}
          />
          <Button type="submit" disabled={pending || disabled}>
            Buscar
          </Button>
        </form>
      }
    />
  )
}
