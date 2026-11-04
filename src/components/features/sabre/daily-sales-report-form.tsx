"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { useForm } from "@tanstack/react-form"
import { z } from "zod"
import { Loader2, MapPin, User, Clock, Copy, Globe, Home } from "lucide-react"
import { getDailySalesReport } from "@/services/sabre/daily-sales/report"
import { toast } from "sonner"
import { DailySalesReportRS } from "sabre-legacy-client"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const formSchema = z.object({
  pcc: z
    .string()
    .min(4, "PCC must be at least 4 characters.")
    .max(4, "PCC must be at most 4 characters."),
  date: z
    .string()
    .min(1, "Date is required."),
})

// The library types payment as Payment[] but the API can return a single object
function getPaymentForm(payment: unknown): { content: string; amount: string; currencyCode: string } | undefined {
  if (!payment) return undefined
  const p = Array.isArray(payment) ? payment[0] : payment
  return (p as any)?.form
}

const FOP_LABELS: Record<string, string> = {
  CA: "Cash",
  VI: "Visa",
  IK: "MasterCard",
  AX: "Amex",
  EX: "Exchange",
}

export function DailySalesReportForm({
  defaultValues = {
    pcc: "",
    date: "",
  }
}: {
  defaultValues?: {
    pcc?: string
    date?: string
  }
}) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<DailySalesReportRS | null>(null)
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0]

  const form = useForm({
    defaultValues: {
      pcc: defaultValues.pcc || "",
      date: defaultValues.date || yesterday,
    },
    validators: {
      onSubmit: formSchema,
    },
    onSubmit: async ({ value }) => {
      setLoading(true)
      try {
        const data = await getDailySalesReport({ date: value.date, pcc: value.pcc || undefined })
        setResult(data)
        toast.success("Daily Sales Report loaded successfully")
      } catch (error) {
        console.error(error)
        toast.error("Failed to get daily sales report", {
          description: `${error}`,
        })
      } finally {
        setLoading(false)
      }
    },
  })

  const handleCopyReport = async () => {
    if (result?.salesReport) {
      await navigator.clipboard.writeText(JSON.stringify(result.salesReport, null, 2))
      toast.success("Report copied to clipboard")
    }
  }

  const issuanceData = result?.salesReport?.issuanceData
  const totalAmount = issuanceData
    ? issuanceData.reduce((sum, item) => sum + Number(getPaymentForm(item.payment)?.amount ?? 0), 0)
    : 0

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
                const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid
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
                    {isInvalid && <FieldError errors={field.state.meta.errors} />}
                  </Field>
                )
              }}
            />
            <form.Field
              name="date"
              children={(field) => {
                const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>Report Date</FieldLabel>
                    <Input
                      id={field.name}
                      name={field.name}
                      type="date"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      aria-invalid={isInvalid}
                      required
                    />
                    {isInvalid && <FieldError errors={field.state.meta.errors} />}
                  </Field>
                )
              }}
            />
          </div>
        </FieldGroup>
        <Button
          type="submit"
          disabled={loading}
          className="w-full mt-4 md:w-auto bg-white text-black hover:bg-zinc-200"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading...
            </>
          ) : (
            "Get Report"
          )}
        </Button>
      </form>

      {result && (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
          <Separator className="bg-zinc-800" />

          {result.salesReport ? (
            <>
              {/* Header info */}
              <div className="bg-zinc-900/50 rounded-lg p-4 border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-zinc-500 uppercase tracking-wider">Report Details</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopyReport}
                    className="text-zinc-500 hover:text-white h-7 px-2"
                  >
                    <Copy className="h-3.5 w-3.5 mr-1" />
                    Copy JSON
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="flex items-center gap-2 text-zinc-400">
                    <MapPin className="h-4 w-4 shrink-0" />
                    <span>{result.salesReport.creationDetails.source.pseudoCityCode}</span>
                  </div>
                  <div className="flex items-center gap-2 text-zinc-400">
                    <User className="h-4 w-4 shrink-0" />
                    <span>{result.salesReport.creationDetails.source.agencyName}</span>
                  </div>
                  <div className="flex items-center gap-2 text-zinc-400">
                    <Clock className="h-4 w-4 shrink-0" />
                    <span>{result.salesReport.creationDetails.source.createDateTime}</span>
                  </div>
                </div>
              </div>

              {/* Totals summary */}
              {issuanceData && issuanceData.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div className="bg-zinc-950 rounded-lg p-3 border border-zinc-800">
                    <p className="text-xs text-zinc-500 mb-1">Total Tickets</p>
                    <p className="text-xl font-bold text-zinc-100">{issuanceData.length}</p>
                  </div>
                  <div className="bg-zinc-950 rounded-lg p-3 border border-zinc-800">
                    <p className="text-xs text-zinc-500 mb-1">Total Amount</p>
                    <p className="text-xl font-bold text-emerald-400">
                      {getPaymentForm(issuanceData[0]?.payment)?.currencyCode}{" "}
                      {totalAmount.toLocaleString()}
                    </p>
                  </div>
                  <div className="bg-zinc-950 rounded-lg p-3 border border-zinc-800">
                    <p className="text-xs text-zinc-500 mb-1">Status</p>
                    <p className="text-sm font-medium text-zinc-300">{result.applicationResults?.status ?? "—"}</p>
                  </div>
                </div>
              )}

              {/* Issuance table */}
              {issuanceData && issuanceData.length > 0 ? (
                <div className="rounded-md border border-zinc-800 bg-zinc-950 overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-zinc-900/50">
                      <TableRow className="border-zinc-800">
                        <TableHead className="text-zinc-100 whitespace-nowrap">Passenger</TableHead>
                        <TableHead className="text-zinc-100">Ticket #</TableHead>
                        <TableHead className="text-zinc-100">PNR</TableHead>
                        <TableHead className="text-zinc-100">Agent</TableHead>
                        <TableHead className="text-zinc-100">FOP</TableHead>
                        <TableHead className="text-zinc-100 text-right">Amount</TableHead>
                        <TableHead className="text-zinc-100 text-right">Commission</TableHead>
                        <TableHead className="text-zinc-100">Route</TableHead>
                        <TableHead className="text-zinc-100">Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {issuanceData.map((item, idx) => {
                        const paymentForm = getPaymentForm(item.payment)
                        const fop = paymentForm?.content
                        const fopLabel = fop ? (FOP_LABELS[fop] ?? fop) : "—"
                        const isIntl = item.domesticInternational === "I"
                        return (
                          <TableRow key={idx} className="border-zinc-800 hover:bg-zinc-900/30">
                            <TableCell className="text-zinc-300 whitespace-nowrap text-xs">
                              {item.personName ?? "—"}
                            </TableCell>
                            <TableCell className="font-mono text-zinc-400 text-xs whitespace-nowrap">
                              {item.ticketingInfo?.ticketing?.eTicketNumber ?? "—"}
                            </TableCell>
                            <TableCell className="font-mono text-zinc-300 text-xs">
                              {item.itineraryRef ?? "—"}
                            </TableCell>
                            <TableCell className="text-zinc-400 text-xs font-medium">
                              {item.agentSine}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="bg-zinc-800 text-zinc-300 border-zinc-700 text-xs whitespace-nowrap">
                                {fopLabel}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-zinc-300 text-xs text-right font-mono whitespace-nowrap">
                              {paymentForm?.currencyCode}{" "}
                              {Number(paymentForm?.amount ?? 0).toLocaleString()}
                            </TableCell>
                            <TableCell className="text-zinc-400 text-xs text-right font-mono">
                              {item.commission ? `${paymentForm?.currencyCode} ${Number(item.commission).toLocaleString()}` : "—"}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={isIntl
                                  ? "bg-blue-500/10 text-blue-400 border-blue-500/20 text-xs gap-1"
                                  : "bg-zinc-800 text-zinc-400 border-zinc-700 text-xs gap-1"
                                }
                              >
                                {isIntl ? <Globe className="h-3 w-3" /> : <Home className="h-3 w-3" />}
                                {isIntl ? "Intl" : "Dom"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-zinc-500 text-xs">
                              {item.issueTime
                                ? `${item.issueTime.slice(0, 2)}:${item.issueTime.slice(2)}`
                                : "—"}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-6 text-zinc-500 border border-dashed border-zinc-800 rounded-lg">
                  No issuance data found for the selected date.
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-6 text-zinc-500 border border-dashed border-zinc-800 rounded-lg">
              No sales report data available for the selected date and PCC.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
