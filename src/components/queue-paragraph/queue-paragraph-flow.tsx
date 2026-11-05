"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"
import {
  parseParagraph,
  resolveDate,
} from "@/app/(console)/queue-paragraph/actions"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  HOST_DATE_DIRECTIONS,
  type ParseParagraphInput,
  parseParagraphSchema,
  type ResolveHostDateInput,
  resolveHostDateSchema,
  SAMPLE_PARAGRAPH,
  today,
} from "@/lib/queue-paragraph"

/**
 * Flujo 7: pegar un párrafo de cola y ver qué saca `parseQueueParagraph`, y probar
 * `resolveHostDate` con una fecha suelta. Sin red: no importa el entorno elegido.
 */
export function QueueParagraphFlow() {
  return (
    <>
      <ParseStep />
      <ResolveStep />
    </>
  )
}

const REFERENCE_HINT = (
  <>
    El día contra el que se resuelve el año, en el calendario del PCC. Por
    defecto, hoy en este navegador.
  </>
)

function ParseStep() {
  const { run, pending, execute } = useStep(
    "parseQueueParagraph",
    parseParagraph
  )
  const form = useForm<ParseParagraphInput>({
    resolver: zodResolver(parseParagraphSchema),
    defaultValues: { text: SAMPLE_PARAGRAPH, referenceDate: today() },
  })
  const errors = form.formState.errors

  return (
    <StepPanel
      title="parseQueueParagraph"
      description={
        <>
          Best-effort: lo que no reconoce va a <code>unparsed</code>. Los
          segmentos y el ticketing usan la regla <code>nearest</code>, y la
          firma, <code>past</code>. Sin red.
        </>
      }
      run={run}
      pending={pending}
      form={
        <form
          onSubmit={form.handleSubmit((input) => execute(input))}
          className="flex flex-col gap-4"
        >
          <Field data-invalid={errors.text !== undefined}>
            <FieldLabel htmlFor="paragraph-text">Párrafo</FieldLabel>
            <Textarea
              id="paragraph-text"
              rows={12}
              spellCheck={false}
              className="font-mono text-xs whitespace-pre"
              aria-invalid={errors.text !== undefined}
              {...form.register("text")}
            />
            <FieldDescription>
              Una línea por renglón, con su sangría. El de ejemplo es sintético.
              No pegues aquí un PNR real si vas a compartir una captura.
            </FieldDescription>
            <FieldError errors={[errors.text]} />
          </Field>
          <Field data-invalid={errors.referenceDate !== undefined}>
            <FieldLabel htmlFor="paragraph-reference">referenceDate</FieldLabel>
            <Input
              id="paragraph-reference"
              type="date"
              aria-invalid={errors.referenceDate !== undefined}
              {...form.register("referenceDate")}
            />
            <FieldDescription>{REFERENCE_HINT}</FieldDescription>
            <FieldError errors={[errors.referenceDate]} />
          </Field>
          <Button type="submit" disabled={pending}>
            Interpretar
          </Button>
        </form>
      }
    />
  )
}

const DIRECTION_ITEMS = HOST_DATE_DIRECTIONS.map((value) => ({
  value,
  label: value,
}))

function ResolveStep() {
  const { run, pending, execute } = useStep("resolveHostDate", resolveDate)
  const form = useForm<ResolveHostDateInput>({
    resolver: zodResolver(resolveHostDateSchema),
    defaultValues: { text: "20MAR", referenceDate: today(), direction: "past" },
  })
  const errors = form.formState.errors

  return (
    <StepPanel
      title="resolveHostDate"
      description={
        <>
          Convierte una fecha de host en ISO sin zona. Si no la reconoce,
          devuelve <code>undefined</code> (aquí, <code>null</code>).
        </>
      }
      run={run}
      pending={pending}
      form={
        <form
          onSubmit={form.handleSubmit((input) => execute(input))}
          className="flex flex-col gap-4"
        >
          <Field data-invalid={errors.text !== undefined}>
            <FieldLabel htmlFor="host-date-text">Fecha de host</FieldLabel>
            <Input
              id="host-date-text"
              className="font-mono uppercase"
              aria-invalid={errors.text !== undefined}
              {...form.register("text")}
            />
            <FieldDescription>
              <code>06SEP</code>, <code>06SEP26</code>, <code>12-21T07:00</code>{" "}
              o <code>2024-05-15T13:24</code>.
            </FieldDescription>
            <FieldError errors={[errors.text]} />
          </Field>
          <Field data-invalid={errors.referenceDate !== undefined}>
            <FieldLabel htmlFor="host-date-reference">referenceDate</FieldLabel>
            <Input
              id="host-date-reference"
              type="date"
              aria-invalid={errors.referenceDate !== undefined}
              {...form.register("referenceDate")}
            />
            <FieldDescription>{REFERENCE_HINT}</FieldDescription>
            <FieldError errors={[errors.referenceDate]} />
          </Field>
          <Controller
            control={form.control}
            name="direction"
            render={({ field }) => (
              <Field>
                <FieldLabel htmlFor="host-date-direction">direction</FieldLabel>
                <Select
                  items={DIRECTION_ITEMS}
                  value={field.value}
                  onValueChange={(value) => {
                    if (value !== null) field.onChange(value)
                  }}
                >
                  <SelectTrigger id="host-date-direction" className="font-mono">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DIRECTION_ITEMS.map((item) => (
                      <SelectItem
                        key={item.value}
                        value={item.value}
                        className="font-mono"
                      >
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldDescription>
                  <code>past</code>: la más reciente no posterior a la
                  referencia (<code>placedAt</code>, <code>countedAt</code>).{" "}
                  <code>nearest</code>: la más cercana dentro de ±6 meses
                  (segmentos, ticketing).
                </FieldDescription>
              </Field>
            )}
          />
          <Button type="submit" disabled={pending}>
            Resolver
          </Button>
        </form>
      }
    />
  )
}
