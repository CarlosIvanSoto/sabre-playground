"use client"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useForm } from "@tanstack/react-form"
import { useStore } from "@tanstack/react-store"
import Link from "next/link"
import { z } from "zod"
import { ArrowRight, Calendar, User, Users } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { format } from "date-fns"
import { GetPNRListResponse } from "@/services/sabre/queue/access-list"
import { Checkbox } from "@/components/ui/checkbox"

const formSchema = z.object({
  pcc: z
    .string()
    .min(4, "PCC must be at least 4 characters.")
    .max(4, "PCC must be at most 4 characters."),
  number: z
    .string()
    .min(1, "Queue number is required."),
  primaryPassenger: z
    .boolean(),
})

export function QueueAccessListForm({
  data,
  defaultValues = {
    pcc: "",
    number: "",
    primaryPassenger: false,
  }
}: {
  data?: GetPNRListResponse,
  defaultValues?: {
    pcc?: string,
    number?: string,
    primaryPassenger?: boolean,
  }
}) {

  const form = useForm({
    defaultValues: {
      pcc: defaultValues.pcc || "",
      number: defaultValues.number || "",
      primaryPassenger: defaultValues.primaryPassenger || false,
    },
    validators: {
      onSubmit: formSchema,
    }
  })

  const number = useStore(form.store, (formState) => formState.values.number)
  const pcc = useStore(form.store, (formState) => formState.values.pcc)
  const primaryPassenger = useStore(form.store, (formState) => formState.values.primaryPassenger)

  return (
    <div className="space-y-6">
      <form
        id="queue-count-form"
        onSubmit={(e) => {
          e.preventDefault()
          form.handleSubmit()
        }}>

        <FieldGroup>
          <div className="grid grid-cols-3 gap-4">
            <form.Field
              name="pcc"
              children={(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>PCC</FieldLabel>
                    <Input
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      aria-invalid={isInvalid}
                      placeholder="Target PCC"
                      autoComplete="off"
                      required
                    />
                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                )
              }}
            />
            <form.Field
              name="number"
              children={(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>Queue Number</FieldLabel>
                    <Input
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      aria-invalid={isInvalid}
                      placeholder="e.g. 1"
                      required
                    />
                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                )
              }}
            />
            <form.Field
              name="primaryPassenger"
              children={(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid
                return (
                  <FieldSet>
                    <FieldLegend variant="label">Primary Passenger (optional)</FieldLegend>
                    <FieldGroup data-slot="primaryPassenger-group" className="h-full justify-center">
                      <Field orientation='horizontal' data-invalid={isInvalid}>
                        <Checkbox
                          id={field.name}
                          name={field.name}
                          checked={field.state.value}
                          onCheckedChange={(checked) =>
                            field.handleChange(checked === true)
                          }
                        />
                        <FieldLabel htmlFor={field.name}>Get Name from PNR</FieldLabel>
                      </Field>
                    </FieldGroup>
                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </FieldSet>

                )
              }}
            />

          </div>
        </FieldGroup>
        <Button type="submit" asChild className="w-full mt-4 md:w-auto bg-white text-black hover:bg-zinc-200">
          <Link href={`/sabre/queue/${pcc}/access/${number}/list?primaryPassenger=${primaryPassenger}`}>Fetch PNR List</Link>
        </Button>
      </form>

      {data?.list && data.list.length > 0 && (
        <div className="rounded-md border border-zinc-800 bg-zinc-950">
          <Table>
            <TableHeader className="bg-zinc-900/50">
              <TableRow className="border-zinc-800">
                <TableHead className="w-[80px] text-zinc-100">#</TableHead>
                <TableHead className="text-zinc-100">Booking ID</TableHead>
                <TableHead className="text-zinc-100">Placed By</TableHead>
                <TableHead className="text-zinc-100">Date</TableHead>
                {primaryPassenger && (
                  <TableHead className="text-zinc-100">Name</TableHead>
                )}
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.list.map((item) => (
                <TableRow key={item.num} className="border-zinc-800 group hover:bg-zinc-900/30">
                  <TableCell className="font-medium text-zinc-500">{item.num}</TableCell>
                  <TableCell className="font-mono text-zinc-100">{item.bookingId}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-zinc-300">
                      <User className="h-3 w-3 text-zinc-500" />
                      {item.placeBy}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-zinc-300">
                      <Calendar className="h-3 w-3 text-zinc-500" />
                      {item.date ? format(new Date(item.date), "MMM d, HH:mm") : "N/A"}
                    </div>
                  </TableCell>
                  {primaryPassenger && (
                    <TableCell>
                      <div className="flex items-center gap-2 text-zinc-300">
                        <User className="h-3 w-3 text-zinc-500" />
                        {item.name}
                      </div>
                    </TableCell>
                  )}
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {data?.list && data.list.length === 0 && (
        <div className="text-center py-12 border border-dashed border-zinc-800 rounded-lg bg-zinc-900/10">
          <Users className="h-8 w-8 text-zinc-700 mx-auto mb-3" />
          <p className="text-zinc-400">No PNRs found in this queue.</p>
        </div>
      )}
    </div>
  )
}