"use client"

import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
// Label no usado: usamos FieldLabel
import { Checkbox } from "@/components/ui/checkbox"
import { Slider } from "@/components/ui/slider"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"

export function AdvancedFilters() {
  const formSchema = z.object({
    priceRange: z
      .tuple([z.number().min(0), z.number().max(5000)])
      .refine(([min, max]) => min <= max, {
        message: "El rango mínimo debe ser menor o igual al máximo",
      }),
    stops: z.array(z.string()),
    cabin: z.string().nonempty("Selecciona una clase de cabina"),
    airlines: z.array(z.string()),
  })

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    mode: "onChange",
    defaultValues: {
      priceRange: [0, 5000],
      stops: [],
      cabin: "economy",
      airlines: [],
    },
  })

  return (
    <div  className="space-y-6 p-6 bg-muted/30 rounded-lg border border-border">
      <FieldGroup>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Price Range */}
          <Controller
            name="priceRange"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid} className="space-y-3">
                <FieldLabel>Rango de Precio</FieldLabel>
                <div className="pt-2">
                  <Slider value={field.value} onValueChange={field.onChange} max={5000} step={100} className="w-full" />
                  <div className="flex justify-between mt-2 text-sm text-muted-foreground">
                    <span>${field.value[0]}</span>
                    <span>${field.value[1]}</span>
                  </div>
                </div>
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />

          {/* Stops */}
          <Controller
            name="stops"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid} className="space-y-3">
                <FieldLabel>Escalas</FieldLabel>
                <div className="space-y-2">
                  {["Directo", "1 escala", "2+ escalas"].map((stop) => (
                    <div key={stop} className="flex items-center space-x-2">
                      <Checkbox
                        id={stop}
                        checked={field.value.includes(stop)}
                        onCheckedChange={(checked) => {
                          const next = checked ? [...field.value, stop] : field.value.filter((s: string) => s !== stop)
                          field.onChange(next)
                        }}
                      />
                      <label htmlFor={stop} className="text-sm font-normal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                        {stop}
                      </label>
                    </div>
                  ))}
                </div>
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />

          {/* Cabin Class */}
          <Controller
            name="cabin"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid} className="space-y-3">
                <FieldLabel>Clase de Cabina</FieldLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="economy">Económica</SelectItem>
                    <SelectItem value="premium">Premium Economy</SelectItem>
                    <SelectItem value="business">Business</SelectItem>
                    <SelectItem value="first">Primera Clase</SelectItem>
                  </SelectContent>
                </Select>
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />

          {/* Airlines */}
          <Controller
            name="airlines"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid} className="space-y-3">
                <FieldLabel>Aerolíneas</FieldLabel>
                <div className="space-y-2">
                  {["American Airlines", "Delta", "United"].map((airline) => (
                    <div key={airline} className="flex items-center space-x-2">
                      <Checkbox
                        id={airline}
                        checked={field.value.includes(airline)}
                        onCheckedChange={(checked) => {
                          const next = checked ? [...field.value, airline] : field.value.filter((a: string) => a !== airline)
                          field.onChange(next)
                        }}
                      />
                      <label htmlFor={airline} className="text-sm font-normal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                        {airline}
                      </label>
                    </div>
                  ))}
                </div>
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
        </div>
      </FieldGroup>
    </div>
  )
}
