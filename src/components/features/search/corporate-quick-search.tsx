"use client"

import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
// useState not needed
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Plane, CalendarIcon, Search, Briefcase } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { cn } from "@/lib/utils"

export function CorporateQuickSearch() {
  const formSchema = z.object({
    origin: z.string().min(2, "Origen requerido"),
    destination: z.string().min(2, "Destino requerido"),
    departureDate: z.date(),
  })

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    mode: "onChange",
    defaultValues: {
      origin: "",
      destination: "",
      departureDate: undefined,
    },
  })

  const { handleSubmit } = form

  function onSubmit(data: z.infer<typeof formSchema>) {
    console.log("Corporate quick search:", data)
  }

  return (
    <div className="space-y-6">
      <Card className="border-border shadow-lg max-w-4xl mx-auto">
        <CardHeader className="text-center pb-4">
          <div className="flex justify-center mb-4">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-accent/10">
              <Briefcase className="w-8 h-8 text-accent" />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold text-foreground">Acceso Corporativo</CardTitle>
          <CardDescription className="text-base mt-2">Búsqueda rápida para clientes empresariales</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Origin */}
            <div className="space-y-2">
              <Controller
                name="origin"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid} className="space-y-2">
                    <FieldLabel htmlFor="corp-origin">Origen</FieldLabel>
                    <div className="relative">
                      <Plane className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input id="corp-origin" {...field} placeholder="Ej: Madrid (MAD)" className="pl-10 h-12" />
                    </div>
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
            </div>

            {/* Destination */}
            <div className="space-y-2">
              <Controller
                name="destination"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid} className="space-y-2">
                    <FieldLabel htmlFor="corp-destination">Destino</FieldLabel>
                    <div className="relative">
                      <Plane className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground rotate-90" />
                      <Input id="corp-destination" {...field} placeholder="Ej: Barcelona (BCN)" className="pl-10 h-12" />
                    </div>
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
            </div>

            {/* Departure Date */}
            <div className="space-y-2">
              <Controller
                name="departureDate"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid} className="space-y-2">
                    <FieldLabel>Fecha de Salida</FieldLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full h-12 justify-start text-left font-normal",
                            !field.value && "text-muted-foreground",
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {field.value ? format(field.value, "dd/MM/yyyy", { locale: es }) : "Seleccionar fecha"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                      </PopoverContent>
                    </Popover>
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
            </div>
          </div>

          <Button
            className="w-full h-12 text-base bg-accent hover:bg-accent/90"
            size="lg"
            onClick={() => {
              handleSubmit(onSubmit)()
            }}
          >
            <Search className="mr-2 h-5 w-5" />
            Buscar Vuelos Rápido
          </Button>

          {/* Corporate Benefits */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6 border-t border-border">
            <div className="text-center space-y-2">
              <div className="text-2xl font-bold text-accent">24/7</div>
              <p className="text-sm text-muted-foreground">Soporte dedicado</p>
            </div>
            <div className="text-center space-y-2">
              <div className="text-2xl font-bold text-accent">-15%</div>
              <p className="text-sm text-muted-foreground">Descuento corporativo</p>
            </div>
            <div className="text-center space-y-2">
              <div className="text-2xl font-bold text-accent">∞</div>
              <p className="text-sm text-muted-foreground">Cambios flexibles</p>
            </div>
          </div>
        </CardContent>
      </Card>

    </div>
  )
}
