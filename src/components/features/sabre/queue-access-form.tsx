"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Field, FieldContent, FieldError, FieldGroup, FieldLabel, FieldTitle } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useForm } from "@tanstack/react-form"
import { z } from "zod"
import {
  User,
  MapPin,
  Clock,
  AlertCircle,
  FileText,
  ExternalLink,
  Loader2,
  Ticket,
  Plane,
  XCircle,
  CheckCircle2,
  AlertTriangle,
  Info,
  Copy
} from "lucide-react"
import {
  getQueueAccess,
  getQueueExit,
  getQueueIgnore,
  getQueueRemove,
} from "@/services/sabre/queue/access"
import { toast } from "sonner"
import Link from "next/link"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { format, formatDate } from "date-fns"
import { QueueAccessResponse } from "sabre-legacy-client"
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupText, InputGroupTextarea } from "@/components/ui/input-group"
import { Checkbox } from "@/components/ui/checkbox"

const formSchema = z.object({
  pcc: z
    .string()
    .min(4, "PCC must be at least 4 characters.")
    .max(4, "PCC must be at most 4 characters."),
  number: z
    .string()
    .min(1, "Queue number is required."),
})

export function QueueAccessForm({
  defaultValues = {
    pcc: "",
    number: "",
  }
}: {
  defaultValues?: {
    pcc?: string,
    number?: string,
  }
}) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<QueueAccessResponse | null>(null)
  const [ignore, setIgnore] = useState(false)
  const [remove, setRemove] = useState(false)
  const [count, setCount] = useState<number>(0)

  const form = useForm({
    defaultValues: {
      pcc: defaultValues.pcc || "",
      number: defaultValues.number || "",
    },
    validators: {
      onSubmit: formSchema,
    },
    onSubmit: async ({ value }) => {
      setLoading(true)
      try {
        const data = await getQueueAccess(value)
        setResult(data)
        setCount(count + 1)
        toast.success(`Accessed Queue ${data.context.queueNumber} successfully`)
      } catch (error) {
        console.error(error)
        toast.error("Failed to access queue", {
          description: `${error}`,
          action: {
            label: "Exit Queue",
            onClick: handleExit
          }
        })
      } finally {
        setLoading(false)
      }
    },
  })
  const handleRemove = async () => {
    setLoading(true)
    try {
      const data = await getQueueRemove()
      setResult(data)
      setCount(count + 1)
      toast.success(`Removed Queue ${data.context.queueNumber} successfully`)
    } catch (error) {
      console.error(error)
      toast.error("Failed to remove queue")
    } finally {
      setLoading(false)
    }
  }

  const handleIgnore = async () => {
    setLoading(true)
    try {
      const data = await getQueueIgnore()
      setResult(data)
      setCount(count + 1)
      toast.success(`Ignored Queue ${data.context.queueNumber} successfully`)
    } catch (error) {
      console.error(error)
      if (error instanceof Error) {
        toast.error("Failed to ignore queue", {
          description: `${error.message}`,
          action: {
            label: "Clean",
            onClick: () => {
              setResult(null)
              setCount(0)
            }
          }
        })
      } else {
        toast.error("Failed to ignore queue")
      }
    } finally {
      setLoading(false)
    }
  }

  const handleExit = async () => {
    setLoading(true)
    try {
      await getQueueExit()
      setResult(null)
      setCount(0)
      toast.success("Exited queue successfully")
    } catch (error) {
      console.error(error)
      toast.error("Failed to exit queue")
    } finally {
      setLoading(false)
    }
  }
  const handlerCopySummaryObject = async () => {
    if (result?.paragraph.text && result.paragraph.text.length > 0) {
      await navigator.clipboard.writeText(JSON.stringify(result.paragraph.text, null, 2))
      toast.success('Summary object copied to clipboard')
    }
  }
  const handlerCopySummary = async () => {
    if (result?.paragraph.text && result.paragraph.text.length > 0) {
      await navigator.clipboard.writeText(result.paragraph.text.join('\n'))
      toast.success('Summary copied to clipboard')
    }
  }

  useEffect(() => {
    // auto-ignore ticketed queue
    if (ignore && result?.classify.isTicketed) {
      handleIgnore()
    }
    // auto-remove queue
    if (remove && !result?.classify.isTicketed && result?.classify.action === "remove") {
      handleRemove()
    }
  }, [ignore, result, remove])
  return (
    <div className="space-y-6">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          form.handleSubmit()
        }}>

        <FieldGroup>
          <div className="grid grid-cols-2 gap-4">
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
          </div>
        </FieldGroup>
        <div className="flex justify-between items-center">
          <Button
            type="submit"
            disabled={loading}
            className="w-full mt-4 md:w-auto bg-white text-black hover:bg-zinc-200"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Accessing...
              </>
            ) : (
              "Access Queue"
            )}
          </Button>
          {count > 0 &&
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
              {count}
            </Badge>
          }
        </div>
      </form>
      {result && (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
          <Separator className="bg-zinc-800" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-4">
              <div className="bg-zinc-900/50 rounded-lg p-4 border border-zinc-800 space-y-3">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <p className="text-xs text-zinc-500 uppercase tracking-wider">Current Booking</p>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-mono font-bold text-white">{result.bookingId}</span>
                      <Link
                        href={`/sabre/booking/${result.bookingId}`}
                        className="p-1 hover:bg-zinc-800 rounded transition-colors"
                      >
                        <ExternalLink className="h-4 w-4 text-primary" />
                      </Link>
                    </div>
                  </div>
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                    Queue {result.context.queueNumber}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm pt-2">
                  <div className="flex items-center gap-2 text-zinc-400">
                    <User className="h-4 w-4" />
                    <span>{result.source.agentSine}</span>
                  </div>
                  <div className="flex items-center gap-2 text-zinc-400">
                    <MapPin className="h-4 w-4" />
                    <span>{result.source.pseudoCityCode}</span>
                  </div>
                  <div className="flex items-center gap-2 text-zinc-400 col-span-2">
                    <Clock className="h-4 w-4" />
                    {result.dateTime ? format(new Date(result.dateTime), "PPpp") : "N/A"}
                  </div>
                </div>
              </div>

              {/* Classification Info */}
              {result.classify && (
                <div className="bg-zinc-900/50 rounded-lg p-4 border border-zinc-800 space-y-4">
                  <p className="text-xs text-zinc-500 uppercase tracking-wider">Classification & Status</p>

                  <div className="flex flex-wrap gap-2">
                    {(result as any).classify.isTicketed ? (
                      <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 gap-1.5 py-1 px-3">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Ticketed
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-zinc-800 text-zinc-400 border-zinc-700 gap-1.5 py-1 px-3">
                        <Ticket className="h-3.5 w-3.5" />
                        Not Ticketed
                      </Badge>
                    )}

                    {result.classify.allCancelled && (
                      <Badge variant="destructive" className="bg-red-500/10 text-red-400 border-red-500/20 gap-1.5 py-1 px-3">
                        <XCircle className="h-3.5 w-3.5" />
                        All Cancelled
                      </Badge>
                    )}

                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 gap-1.5 py-1 px-3">
                      <Info className="h-3.5 w-3.5" />
                      Action: {result.classify.action}
                    </Badge>
                  </div>

                  {result.classify.flightStatuses.length > 0 
                  ? (
                    <div className="space-y-2">
                      <p className="text-[10px] text-zinc-500 uppercase font-bold px-1">Flight Statuses</p>
                      <div className="flex flex-wrap gap-2">
                        {result.classify.flightStatuses.map((status, i) => (
                          <Badge key={i} variant="outline" className={status.includes('X') ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300" : "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"}>
                            <Plane className="h-3 w-3" />
                            {status}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )
                   : (
                    <Badge variant='destructive'>
                      <Plane className="h-3 w-3" />
                      No Flight Segments
                    </Badge>
                   )
                   }

                  {result.classify.ticketingDeadline && (
                    <div className="flex items-center gap-3 bg-zinc-950/50 border border-zinc-800 rounded-lg p-3">
                      <Clock className={`h-4 w-4 ${result.classify.deadlineExpired ? "text-red-400" : "text-amber-400"}`} />
                      <div className="flex-1">
                        <p className="text-[10px] text-zinc-500 uppercase font-bold">Ticketing Deadline</p>
                        <p className="text-sm text-zinc-300">{format(new Date(result.classify.ticketingDeadline), "PPpp")}</p>
                      </div>
                      {result.classify.deadlineExpired && (
                        <Badge className="bg-red-500/20 text-red-400 border-red-500/40 animate-pulse">
                          EXPIRED
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              )}

              {result.notifications && result.notifications.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-zinc-500 uppercase px-1">Notifications</p>
                  {result.notifications.map((notif, idx) => (
                    <div key={idx} className="flex gap-3 bg-amber-500/5 border border-amber-500/20 rounded-lg p-3 text-sm">
                      <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p className="font-medium text-amber-200">Code {notif.warning.code}</p>
                        <p className="text-zinc-400 leading-relaxed">{notif.warning.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <FieldGroup className="gap-2">
              <div className="grid w-full max-w-md gap-4">
                <InputGroup>
                  <InputGroupTextarea
                    id="booking-preview"
                    value={result.paragraph.text.join("\n")}
                    className="max-h-[400px] leading-relaxed overflow-x-auto whitespace-pre text-muted-foreground"
                    readOnly
                  />
                  <InputGroupAddon align='block-start' className="border-b">
                    <InputGroupText className="font-medium">
                      <FileText />
                      Booking Preview
                    </InputGroupText>
                    <InputGroupButton className="ml-auto" variant="ghost" size="icon-xs" onClick={handlerCopySummaryObject}>
                      <Copy />
                    </InputGroupButton>
                    <InputGroupButton variant="ghost" size="icon-xs" onClick={handlerCopySummary}>
                      <Copy />
                    </InputGroupButton>
                  </InputGroupAddon>
                </InputGroup>
              </div>
              {/* <p className="text-xs font-medium text-zinc-500 uppercase px-1 flex items-center gap-2">
                <FileText className="h-3 w-3" />
                Booking Preview
              </p>
              <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 font-mono text-sm leading-relaxed overflow-x-auto whitespace-pre custom-scrollbar max-h-[400px]">
                {result.paragraph.text.map((line, idx) => (
                  <div key={idx} className="text-zinc-300 min-h-[1.25rem]">
                    {line}
                  </div>
                ))}
              </div> */}
              <FieldLabel>
                <Field orientation="horizontal">
                  <Checkbox id="toggle-auto-ignore" name="auto-ignore" checked={ignore} onCheckedChange={() => setIgnore(!ignore)} />
                  <FieldContent>
                    <FieldTitle>Auto Ignore Tickets</FieldTitle>
                  </FieldContent>
                </Field>
              </FieldLabel>
              <FieldLabel>
                <Field orientation="horizontal">
                  <Checkbox id="toggle-auto-remove" name="auto-remove" checked={remove} onCheckedChange={() => setRemove(!remove)} />
                  <FieldContent>
                    <FieldTitle>Auto Remove Expired Bookings</FieldTitle>
                  </FieldContent>
                </Field>
              </FieldLabel>
              <div className="flex justify-between pt-2">
                <Button onClick={handleRemove} disabled={loading} variant="outline" size="sm" className="border-zinc-800 text-zinc-400 hover:text-white">
                  Remove & Next
                </Button>
                <Button onClick={handleIgnore} disabled={loading} variant="outline" size="sm" className="border-zinc-800 text-zinc-400 hover:text-white">
                  Ignore & Next
                </Button>
                <Button onClick={handleExit} disabled={loading} size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
                  Exit
                </Button>
              </div>
            </FieldGroup>
          </div>
        </div>
      )}
    </div >
  )
}
