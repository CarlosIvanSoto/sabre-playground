"use client"

import { Controller, useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet, FieldTitle } from "@/components/ui/field"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plane, CalendarIcon, Search, X, Users, PlusIcon, MinusIcon } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { ButtonGroup } from "@/components/ui/button-group"
import { ChangeEvent } from "react"

const MAX_PASSENGERS = 5;

const formSchema = z
  .object({
    tripType: z.enum(["roundtrip", "oneway", "multicity"]),
    origin: z.string().min(2, "Origen requerido"),
    destination: z.string().min(2, "Destino requerido"),
    departureDate: z.date().optional(),
    returnDate: z.date().optional(),
    passengers: z
      .object({ adults: z.number().min(1).max(MAX_PASSENGERS), children: z.number().min(0).max(MAX_PASSENGERS), infants: z.number().min(0).max(MAX_PASSENGERS) })
      .refine((p) => p.adults >= 1, { message: "Debe haber al menos 1 adulto", path: ["adults"] }),
  })
  .superRefine((data, ctx) => {
    if (!data.departureDate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Fecha de salida requerida", path: ["departureDate"] })
    }

    if (data.tripType === "roundtrip") {
      if (!data.returnDate) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Fecha de regreso requerida para ida y vuelta", path: ["returnDate"] })
      } else if (data.departureDate && data.returnDate < data.departureDate) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "La fecha de regreso no puede ser anterior a la de salida", path: ["returnDate"] })
      }
    }
  })

export function AdvancedSearch() {

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    mode: "onChange",
    defaultValues: {
      tripType: "roundtrip",
      origin: "TRC",
      destination: "MEX",
      departureDate: undefined,
      returnDate: undefined,
      passengers: { adults: 1, children: 0, infants: 0 },
    },
  })
  function onSubmit(data: z.infer<typeof formSchema>) {
    toast("You submitted the following values:", {
      description: (
        <pre className="bg-code text-code-foreground mt-2 w-[320px] overflow-x-auto rounded-md p-4">
          <code>{JSON.stringify(data, null, 2)}</code>
        </pre>
      ),
      position: "bottom-right",
      classNames: {
        content: "flex flex-col gap-2",
      },
      style: {
        "--border-radius": "calc(var(--radius)  + 4px)",
      } as React.CSSProperties,
    })
  }
  function onChangeInputNumber(fn: (value: number) => void) {
    const onCI = (event: ChangeEvent<HTMLInputElement>) => {
      const value = parseInt(event.target.value, 10)
      if (!isNaN(value)) 
        fn(value)
        // fn(value > MAX_PASSENGERS ? MAX_PASSENGERS : value) 
      else 
        fn(0)
    }
    return onCI
  }

  const tripType = useWatch({ control: form.control, name: "tripType" })
  const departureDate = useWatch({ control: form.control, name: "departureDate" })
  const passengers = useWatch({ control: form.control, name: "passengers" })

  return (
    <form id="form-advanced-search" onSubmit={form.handleSubmit(onSubmit)}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-foreground">Búsqueda Avanzada de Vuelos</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="roundtrip">
            <TabsList className="w-full max-w-md mb-2">
              <TabsTrigger value="roundtrip">Ida y vuelta</TabsTrigger>
              <TabsTrigger value="oneway">Solo IDA</TabsTrigger>
            </TabsList>
            <TabsContent value="roundtrip">
                <FieldGroup className="md:grid md:grid-cols-2 md:gap-4">
                  {/* Origin */}
                  <Controller
                    name="origin"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor={field.name}>Origen</FieldLabel>
                        <InputGroup>
                          <InputGroupInput 
                            {...field}
                            id={field.name} 
                            aria-invalid={fieldState.invalid}
                            placeholder="Ciudad o aeropuerto"
                          />
                          <InputGroupAddon>
                            <Plane />
                          </InputGroupAddon>
                        </InputGroup>
                        {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                      </Field>
                    )}
                  />

                  {/* Destination */}
                  <Controller
                    name="destination"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="destination">Destino</FieldLabel>
                        <InputGroup>
                          <InputGroupInput 
                            {...field}
                            id={field.name} 
                            aria-invalid={fieldState.invalid}
                            placeholder="Ciudad o aeropuerto"
                          />
                          <InputGroupAddon>
                            <Plane className="rotate-90" />
                          </InputGroupAddon>
                        </InputGroup>
                        {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                      </Field>
                    )}
                  />

                  {/* Departure Date */}
                  <Controller
                    name="departureDate"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel>Fecha de Salida</FieldLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal",
                                !field.value && "text-muted-foreground",
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {field.value ? format(field.value, "dd/MM/yyyy", { locale: es }) : "Seleccionar fecha"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={field.value} onSelect={field.onChange} />
                          </PopoverContent>
                        </Popover>
                        {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                      </Field>
                    )}
                  />

                  {/* Return Date */}
                  {tripType === "roundtrip" && (
                    <Controller
                      name="returnDate"
                      control={form.control}
                      render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                          <FieldLabel>Fecha de Regreso</FieldLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full justify-start text-left font-normal",
                                  !field.value && "text-muted-foreground",
                                )}
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {field.value ? format(field.value, "dd/MM/yyyy", { locale: es }) : "Seleccionar fecha"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                disabled={(date) => (departureDate ? date < departureDate : false)}
                              />
                            </PopoverContent>
                          </Popover>
                          {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                        </Field>
                      )}
                    />
                  )}

                  {/* Passengers */}
                  <FieldSet>
                    <FieldLegend variant="label">Pasajeros</FieldLegend>
                    <Popover> 
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal">
                          <Users className="mr-2 h-4 w-4" />
                          {passengers.adults + passengers.children + passengers.infants} {passengers.adults + passengers.children + passengers.infants === 1 ? "Pasajero" : "Pasajeros"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-80" align="start">
                        <FieldGroup>
                          <Controller 
                            key='adults'
                            name='passengers.adults'
                            control={form.control}
                            render={({ field: controllerField, fieldState }) => (
                              <Field orientation="horizontal" data-invalid={fieldState.invalid}>
                                <FieldContent>
                                  <FieldLabel htmlFor='form-rhf-passengers-adults'>Adultos</FieldLabel>
                                  <FieldDescription>12+ años</FieldDescription>
                                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                                </FieldContent>
                                <ButtonGroup>
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => controllerField.onChange(Math.max(1, controllerField.value - 1))}
                                  >
                                    <MinusIcon />
                                  </Button>
                                  <Input
                                    name={controllerField.name}
                                    value={controllerField.value}
                                    onChange={onChangeInputNumber((value) => controllerField.onChange(Math.max(1, value)))}
                                    className="w-22 text-center"
                                  />
                                  <Button
                                    id='form-rhf-passengers-adults'
                                    variant="outline"
                                    size="icon"
                                    onClick={() => controllerField.onChange(Math.min(5,controllerField.value + 1))}
                                  >
                                    <PlusIcon />
                                  </Button>
                                </ButtonGroup>
                              </Field>
                            )}
                          />
                          <Controller 
                            key='children'
                            name='passengers.children'
                            control={form.control}
                            render={({ field: controllerField, fieldState }) => (
                              <Field orientation="horizontal" data-invalid={fieldState.invalid}>
                                <FieldContent>
                                  <FieldLabel htmlFor='form-rhf-passengers-children'>Niños</FieldLabel>
                                  <FieldDescription>2-11 años</FieldDescription>
                                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                                </FieldContent>
                                <ButtonGroup>
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => controllerField.onChange(Math.max(0, controllerField.value - 1))}
                                  >
                                    <MinusIcon />
                                  </Button>
                                  <Input
                                    name={controllerField.name}
                                    value={controllerField.value}
                                    onChange={onChangeInputNumber((value) => controllerField.onChange(Math.max(1, value)))}
                                    className="w-22 text-center"
                                  />
                                  <Button
                                    id='form-rhf-passengers-children'
                                    variant="outline"
                                    size="icon"
                                    onClick={() => controllerField.onChange(Math.min(5,controllerField.value + 1))}
                                  >
                                    <PlusIcon />
                                  </Button>
                                </ButtonGroup>
                              </Field>
                            )}
                          />
                          <Controller 
                            key='infants'
                            name='passengers.infants'
                            control={form.control}
                            render={({ field: controllerField, fieldState }) => (
                              <Field orientation="horizontal" data-invalid={fieldState.invalid}>
                                <FieldContent>
                                  <FieldLabel htmlFor='form-rhf-passengers-infants'>Bebés</FieldLabel>
                                  <FieldDescription>{"<"} 2 años</FieldDescription>
                                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                                </FieldContent>
                                <ButtonGroup>
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => controllerField.onChange(Math.max(0, controllerField.value - 1))}
                                  >
                                    <MinusIcon />
                                  </Button>
                                  <Input
                                    name={controllerField.name}
                                    value={controllerField.value}
                                    onChange={onChangeInputNumber((value) => controllerField.onChange(Math.max(1, value)))}
                                    className="w-22 text-center"
                                  />
                                  <Button
                                    id='form-rhf-passengers-infants'
                                    variant="outline"
                                    size="icon"
                                    onClick={() => controllerField.onChange(Math.min(5,controllerField.value + 1))}
                                  >
                                    <PlusIcon />
                                  </Button>
                                </ButtonGroup>
                              </Field>
                            )}
                          />
                        </FieldGroup>
                      </PopoverContent>
                    </Popover>
                  </FieldSet>
                </FieldGroup>
            </TabsContent>
          </Tabs>
        </CardContent>
        <CardFooter>
          <Field orientation="horizontal" className="justify-end">
            <Button variant="outline" onClick={() => form.reset()}>
              Limpiar búsqueda
            </Button>
            <Button type='submit'>
              Buscar Vuelos
            </Button>
          </Field>
        </CardFooter>
      </Card>
    </form>
  )
}
