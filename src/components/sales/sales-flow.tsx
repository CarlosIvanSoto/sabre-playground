"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Info, TriangleAlert } from "lucide-react"
import Link from "next/link"
import { useForm } from "react-hook-form"
import type { DailySalesSummaryResult } from "sabre-client"
import { dailySales } from "@/app/(console)/sales/actions"
import { useEnvironment } from "@/components/environment/environment-provider"
import { useSessionStatus } from "@/components/session/use-session-status"
import { StepPanel } from "@/components/step/step-panel"
import { useStep } from "@/components/step/use-step"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  type DailySalesInput,
  dailySalesOf,
  dailySalesSchema,
  isVoided,
  SALES_STATUS_TEXT,
  salesCounts,
} from "@/lib/daily-sales"

/**
 * Flujo 9: ventas del día (F16.5, #163, ADR-030). En la sesión SOAP abierta. Es lectura: corre
 * también en producción. Las horas van tal como llegan, sin zona (hora local del PCC), y las
 * anuladas (`V`) se marcan y no cuentan como vigentes. El nombre del pasajero no se muestra en
 * la tabla: queda solo en las pestañas, en memoria.
 */
export function SalesFlow() {
  const { environment } = useEnvironment()
  const { status } = useSessionStatus()
  const { run, pending, execute } = useStep(
    "reporting.dailySalesSummary",
    dailySales
  )
  const form = useForm<DailySalesInput>({
    resolver: zodResolver(dailySalesSchema),
    defaultValues: { pcc: "", date: "" },
  })
  const errors = form.formState.errors
  const open = status?.open === true

  return (
    <StepPanel
      title="session.reporting.dailySalesSummary"
      description={
        <>
          <code>DailySalesSummaryRQ</code> (el <code>DQB</code> del host), en la
          sesión abierta. Solo <code>complete</code> es el día entero. Las horas
          vienen sin zona, en la hora local del PCC, y se muestran tal cual.
        </>
      }
      run={run}
      pending={pending}
      resultView={(result) => <SalesView result={result} />}
      form={
        <form
          onSubmit={form.handleSubmit((input) => execute(input))}
          className="flex flex-col gap-4"
        >
          <Field data-invalid={errors.pcc !== undefined}>
            <FieldLabel htmlFor="sales-pcc">PCC (opcional)</FieldLabel>
            <Input
              id="sales-pcc"
              className="font-mono uppercase"
              maxLength={4}
              aria-invalid={errors.pcc !== undefined}
              {...form.register("pcc")}
            />
            <FieldDescription>
              Vacío, el home PCC del token. Otro PCC necesita Branch Access (si
              no, <code>45100</code>).
              {environment.ticketingPcc !== undefined && (
                <>
                  {" "}
                  Las emisiones de W4 están en{" "}
                  <code>{environment.ticketingPcc}</code>.
                </>
              )}
            </FieldDescription>
            <FieldError errors={[errors.pcc]} />
          </Field>
          <Field data-invalid={errors.date !== undefined}>
            <FieldLabel htmlFor="sales-date">Fecha (opcional)</FieldLabel>
            <Input
              id="sales-date"
              className="font-mono"
              placeholder="YYYY-MM-DD"
              aria-invalid={errors.date !== undefined}
              {...form.register("date")}
            />
            <FieldDescription>
              Vacía, el día en curso de Sabre.
            </FieldDescription>
            <FieldError errors={[errors.date]} />
          </Field>
          {environment.id === "cert" && (
            <FieldDescription>
              En CERT puede no haber ventas: solo aparecen los boletos que se
              emitieron en ese PCC ese día.
            </FieldDescription>
          )}
          {!open && (
            <FieldDescription>
              Abre una sesión primero, en{" "}
              <Link href="/session" className="underline">
                Sesión
              </Link>{" "}
              o en la mesa de colas.
            </FieldDescription>
          )}
          <Button type="submit" disabled={pending || !open}>
            Ver ventas
          </Button>
        </form>
      }
    />
  )
}

function SalesView({ result }: { result: unknown }) {
  const report = dailySalesOf(result)
  if (report === undefined) return null
  const counts = salesCounts(report.transactions)
  return (
    <div className="flex flex-col gap-3">
      <StatusBanner report={report} />
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge variant="outline" className="font-mono">
          {report.pcc || "PCC vacío"}
        </Badge>
        {report.reportDate !== undefined && (
          <Badge variant="outline" className="font-mono">
            {report.reportDate}
          </Badge>
        )}
        <span>
          {counts.live} vigentes · {counts.voided} anuladas · {counts.total}{" "}
          transacciones
        </span>
      </div>
      {report.transactions.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Hora (sin zona)</TableHead>
              <TableHead>Documento</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>PNR</TableHead>
              <TableHead>Aerolínea</TableHead>
              <TableHead className="text-right">Importe</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.transactions.map((transaction, index) => (
              <TableRow
                // Un documento puede repetirse (venta y reembolso): el índice lo desempata. La
                // lista no cambia de orden.
                // biome-ignore lint/suspicious/noArrayIndexKey: ver arriba
                key={`${transaction.documentNumber}-${index}`}
                className={isVoided(transaction) ? "opacity-60" : undefined}
              >
                <TableCell className="font-mono text-xs">
                  {transaction.transactionDateTime}
                </TableCell>
                <TableCell className="font-mono">
                  {transaction.documentNumber}
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {transaction.documentType} {transaction.transactionCode}
                </TableCell>
                <TableCell>
                  {isVoided(transaction) ? (
                    <Badge variant="secondary">V anulada</Badge>
                  ) : (
                    <span className="font-mono text-xs">
                      {transaction.documentStatusCode ?? "—"}
                    </span>
                  )}
                </TableCell>
                <TableCell className="font-mono">
                  {transaction.pnrLocator ?? "—"}
                </TableCell>
                <TableCell className="font-mono">
                  {transaction.airline.code}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {transaction.payments === undefined
                    ? "—"
                    : `${transaction.payments.total} ${transaction.payments.currencyCode}`}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <TotalsView totals={report.totals} voided={counts.voided} />
    </div>
  )
}

function StatusBanner({ report }: { report: DailySalesSummaryResult }) {
  if (report.status === "complete") {
    return (
      <Alert>
        <Info />
        <AlertTitle>
          <Badge>complete</Badge>
        </AlertTitle>
        <AlertDescription>{SALES_STATUS_TEXT.complete}</AlertDescription>
      </Alert>
    )
  }
  return (
    <Alert variant="destructive">
      <TriangleAlert />
      <AlertTitle>
        <Badge variant="destructive">{report.status}</Badge>
      </AlertTitle>
      <AlertDescription>
        <p>{SALES_STATUS_TEXT[report.status]}</p>
        {report.failedDocuments !== undefined &&
          report.failedDocuments.length > 0 && (
            <p>
              Documentos fallidos:{" "}
              <code className="font-mono">
                {report.failedDocuments.join(", ")}
              </code>
            </p>
          )}
        {report.deferred?.reportId !== undefined && (
          <p>
            <code className="font-mono">reportId</code>{" "}
            {report.deferred.reportId}
            {report.deferred.queryStillRunning && " (todavía corriendo)"}
          </p>
        )}
      </AlertDescription>
    </Alert>
  )
}

function TotalsView({
  totals,
  voided,
}: {
  totals: DailySalesSummaryResult["totals"]
  voided: number
}) {
  if (totals.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Sin totales.
        {voided > 0 && " Las anuladas no aparecen en los totales."}
      </p>
    )
  }
  return (
    <div className="flex flex-col gap-1">
      <div className="text-muted-foreground font-mono text-xs">totals</div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Transacción</TableHead>
            <TableHead>Settlement</TableHead>
            <TableHead>Moneda</TableHead>
            <TableHead className="text-right">Efectivo</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {totals.map((total, index) => (
            <TableRow
              // Los totales no tienen id y la lista no cambia de orden.
              // biome-ignore lint/suspicious/noArrayIndexKey: ver arriba
              key={index}
            >
              <TableCell className="font-mono">
                {total.transactionType}
              </TableCell>
              <TableCell className="font-mono">
                {total.settlementType}
              </TableCell>
              <TableCell className="font-mono">
                {total.currencyCode ?? "—"}
              </TableCell>
              <TableCell className="text-right font-mono">
                {total.cash === undefined
                  ? "—"
                  : `${total.cash.amount}${total.cash.count === undefined ? "" : ` (${total.cash.count})`}`}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
