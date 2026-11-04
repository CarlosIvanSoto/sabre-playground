"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { QueueCountFilterResponse } from "@/services/sabre/queue/count"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import Link from "next/link"
import { z } from "zod"
import { useForm, useStore } from "@tanstack/react-form"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { reloadSession } from "@/services/sabre/common/session"

const formSchema = z.object({
  pcc: z
    .string()
    .min(4, "PCC must be at least 4 characters.")
    .max(4, "PCC must be at most 4 characters."),
  offset: z
    .string(),
  limit: z
    .string()
})

export function QueueCountForm({
  data,
  defaultValues = {
    pcc: "",
    offset: "",
    limit: "",
  }
}: {
  data?: QueueCountFilterResponse,
  defaultValues?: {
    pcc: string,
    offset?: string,
    limit?: string,
  }
}) {

  const form = useForm({
    defaultValues: {
      pcc: defaultValues.pcc,
      offset: defaultValues.offset || "",
      limit: defaultValues.limit || "",
    },
    validators: {
      onSubmit: formSchema,
    },
  })


  const pcc = useStore(form.store, (formState) => formState.values.pcc)
  const offset = useStore(form.store, (formState) => formState.values.offset)
  const limit = useStore(form.store, (formState) => formState.values.limit)

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
              name="offset"
              children={(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>From Number (Offset)</FieldLabel>
                    <Input
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      aria-invalid={isInvalid}
                      placeholder="e.g. 50"
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
              name="limit"
              children={(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>To Number (Limit)</FieldLabel>
                    <Input
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      aria-invalid={isInvalid}
                      placeholder="e.g. 100"
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

          </div>
        </FieldGroup>
        <Button
          type="submit"
          asChild
          className="w-full mt-4 md:w-auto bg-white text-black hover:bg-zinc-200"
        >
          <Link prefetch={false} href={`/sabre/queue/${pcc}/count?offset=${offset}&limit=${limit}`}>
            Run Count
          </Link>
        </Button>
      </form>

      {data?.queueIdentifier && data?.queueIdentifier.length > 0 && (
        <div className="rounded-md border border-zinc-800 bg-zinc-950">
          <Table>
            <TableHeader className="bg-zinc-900/50">
              <TableRow className="border-zinc-800">
                <TableHead className="text-zinc-100">Queue Number</TableHead>
                <TableHead className="text-zinc-100">Count</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.queueIdentifier.slice(0, 10).map((q) => (
                <TableRow key={q.number} className="border-zinc-800 group hover:bg-zinc-900/30">
                  <TableCell className="font-medium text-zinc-300">Q{q.number}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {q.count}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
              {data.queueIdentifier.length > 10 && (
                <TableRow className="border-zinc-800">
                  <TableCell colSpan={2} className="text-center text-zinc-500 text-xs py-2">
                    Showing first 10 results of {data.queueIdentifier.length}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {data?.queueIdentifier && data.queueIdentifier.length === 0 && (
        <div className="text-center py-6 text-zinc-500 border border-dashed border-zinc-800 rounded-lg">
          No queues found matching the criteria.
        </div>
      )}
    </div>
  )
}
