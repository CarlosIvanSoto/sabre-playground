"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { useForm } from "@tanstack/react-form"
import { z } from "zod"
import { Loader2, MapPin, Copy } from "lucide-react"
import { getDailySalesSummary } from "@/services/sabre/daily-sales/summary"
import { toast } from "sonner"
import { DailySalesSummaryRS } from "sabre-legacy-client"
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

export function DailySalesSummaryForm({
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
  const [result, setResult] = useState<DailySalesSummaryRS | null>(null)

  const form = useForm({
    defaultValues: {
      pcc: defaultValues.pcc || "",
      date: defaultValues.date || "",
    },
    validators: {
      onSubmit: formSchema,
    },
    onSubmit: async ({ value }) => {
      setLoading(true)
      try {
        const data = await getDailySalesSummary({ date: value.date, pcc: value.pcc || undefined })
        setResult(data)
        toast.success("Daily Sales Summary loaded successfully")
      } catch (error) {
        console.error(error)
        toast.error("Failed to get daily sales summary", {
          description: `${error}`,
        })
      } finally {
        setLoading(false)
      }
    },
  })

  const handleCopySummary = async () => {
    if (result) {
      await navigator.clipboard.writeText(JSON.stringify(result, null, 2))
      toast.success("Summary copied to clipboard")
    }
  }

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
            "Get Summary"
          )}
        </Button>
      </form>

      {result && (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
          <Separator className="bg-zinc-800" />

          <div className="bg-zinc-900/50 rounded-lg p-4 border border-zinc-800 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-zinc-500 uppercase tracking-wider">Summary Header</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopySummary}
                className="text-zinc-500 hover:text-white h-7 px-2"
              >
                <Copy className="h-3.5 w-3.5 mr-1" />
                Copy
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2 text-zinc-400">
                <MapPin className="h-4 w-4 shrink-0" />
                <span>{result.dSHeader.pseudoCityCode}</span>
              </div>
              <div className="text-zinc-400">
                <span className="text-zinc-500 text-xs mr-2">Agency:</span>
                {result.dSHeader.agencyName}
              </div>
              <div className="text-zinc-400">
                <span className="text-zinc-500 text-xs mr-2">Report Date:</span>
                {result.dailySalesReport.reportDate}
              </div>
              <div className="text-zinc-400">
                <span className="text-zinc-500 text-xs mr-2">Status:</span>
                {result.isQueryStillRunning === "true" ? (
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-xs">
                    Still Running
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs">
                    Complete
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Totals */}
          {result.dailySalesReport.totalDailySales && (
            <div className="bg-zinc-900/50 rounded-lg p-4 border border-zinc-800 space-y-3">
              <p className="text-xs text-zinc-500 uppercase tracking-wider">Sales Totals</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-zinc-950 rounded-lg p-3 border border-zinc-800">
                  <p className="text-xs text-zinc-500 mb-1">Settlement</p>
                  <p className="text-sm font-medium text-zinc-300">
                    {result.dailySalesReport.totalDailySales.salesBySettlement?.settlementType ?? "N/A"}
                  </p>
                </div>
                <div className="bg-zinc-950 rounded-lg p-3 border border-zinc-800">
                  <p className="text-xs text-zinc-500 mb-1">Cash Total</p>
                  <p className="text-sm font-medium text-zinc-300">
                    {result.dailySalesReport.totalDailySales.salesBySettlement?.saleTotals?.currencyCode}{" "}
                    {result.dailySalesReport.totalDailySales.salesBySettlement?.saleTotals?.cashTotals?.content ?? 0}
                    <span className="text-xs text-zinc-500 ml-1">
                      ({result.dailySalesReport.totalDailySales.salesBySettlement?.saleTotals?.cashTotals?.count ?? 0} tx)
                    </span>
                  </p>
                </div>
                <div className="bg-zinc-950 rounded-lg p-3 border border-zinc-800">
                  <p className="text-xs text-zinc-500 mb-1">Credit Total</p>
                  <p className="text-sm font-medium text-zinc-300">
                    {result.dailySalesReport.totalDailySales.salesBySettlement?.saleTotals?.currencyCode}{" "}
                    {result.dailySalesReport.totalDailySales.salesBySettlement?.saleTotals?.creditTotals?.content ?? 0}
                    <span className="text-xs text-zinc-500 ml-1">
                      ({result.dailySalesReport.totalDailySales.salesBySettlement?.saleTotals?.creditTotals?.count ?? 0} tx)
                    </span>
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Transactions */}
          {result.dailySalesReport.transaction && result.dailySalesReport.transaction.length > 0 ? (
            <div className="rounded-md border border-zinc-800 bg-zinc-950">
              <Table>
                <TableHeader className="bg-zinc-900/50">
                  <TableRow className="border-zinc-800">
                    <TableHead className="text-zinc-100">PNR</TableHead>
                    <TableHead className="text-zinc-100">Passenger</TableHead>
                    <TableHead className="text-zinc-100">Doc Type</TableHead>
                    <TableHead className="text-zinc-100">Doc Number</TableHead>
                    <TableHead className="text-zinc-100">Airline</TableHead>
                    <TableHead className="text-zinc-100">Agent</TableHead>
                    <TableHead className="text-zinc-100">Date/Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.dailySalesReport.transaction.map((tx, idx) => (
                    <TableRow key={idx} className="border-zinc-800 hover:bg-zinc-900/30">
                      <TableCell className="font-mono text-zinc-300">{tx.pnrLocator ?? "—"}</TableCell>
                      <TableCell className="text-zinc-400 text-sm">{tx.passengerName ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-zinc-800 text-zinc-300 border-zinc-700 text-xs">
                          {tx.documentType}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-zinc-400 text-xs">{tx.documentDetails.documentNumber}</TableCell>
                      <TableCell className="text-zinc-400 text-sm">{tx.airlineCode.content}</TableCell>
                      <TableCell className="text-zinc-400 text-sm">{tx.agentSine}</TableCell>
                      <TableCell className="text-zinc-500 text-xs">{tx.transactionDateTime}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-6 text-zinc-500 border border-dashed border-zinc-800 rounded-lg">
              No transactions found for the selected date.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
