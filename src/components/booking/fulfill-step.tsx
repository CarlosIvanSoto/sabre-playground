"use client"

import { TriangleAlert } from "lucide-react"
import { useState } from "react"
import { fulfillTickets, verifyTickets } from "@/app/(console)/booking/actions"
import { useEnvironment } from "@/components/environment/environment-provider"
import { Confirm } from "@/components/queue-desk/desk-write"
import { StepPanel } from "@/components/step/step-panel"
import { useStep } from "@/components/step/use-step"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { type UncertainOutcome, uncertainOf } from "@/lib/step/uncertain"
import {
  type FulfillInput,
  PROD_FULFILL_REASON,
  statusOf,
  type TicketRow,
  ticketsOf,
  VERIFY_STATUS_TEXT,
  type VerifyInput,
} from "@/lib/ticketing"

/**
 * W4 (F16.2, #160): `tickets.fulfill` con la receta de S8 (`CASH`, perfil de impresora 1,
 * comisión 0 %), con confirmación. En producción no se ofrece, y la server action lo rechaza
 * igual.
 *
 * Ante un desenlace incierto (ADR-031) hay **Verificar** (`tickets.verify`, con los `tickets` del
 * error como `expectedTickets`) y **nunca** un botón de reintentar: Emitir queda bloqueado para
 * esa reserva hasta que la verificación diga `notFound`.
 *
 * Con `confirmationId`, la reserva viene del recorrido (Air Booking) y no se escribe.
 */
export function FulfillStep({
  confirmationId: fixed,
  defaultTargetPcc,
  waitingFor,
  disabled = false,
  onDone,
}: {
  confirmationId?: string
  /** El PCC de emisión inicial; si no, `SABRE_CERT_TICKETING_PCC`. */
  defaultTargetPcc?: string
  /** Qué falta para poder emitir, si falta algo. */
  waitingFor?: string
  disabled?: boolean
  /** Los boletos emitidos, o confirmados por Verificar, y su reserva. */
  onDone?: (tickets: TicketRow[], confirmationId: string) => void
}) {
  const { environment } = useEnvironment()
  const fulfill = useStep("tickets.fulfill", fulfillTickets)
  const [typed, setTyped] = useState("")
  const [targetPcc, setTargetPcc] = useState(
    defaultTargetPcc ?? environment.ticketingPcc ?? ""
  )
  const confirmationId = (fixed ?? typed).trim().toUpperCase()
  // La reserva del último intento incierto: hasta verificar, no se vuelve a emitir.
  const [blockedFor, setBlockedFor] = useState<string>()
  // Cuántas emisiones se pidieron: cada una tiene su propia verificación.
  const [attempt, setAttempt] = useState(0)

  const uncertain = uncertainOf(fulfill.run)
  const blocked = blockedFor !== undefined && blockedFor === confirmationId
  const pcc = targetPcc.trim().toUpperCase()

  const reason = environment.readOnly
    ? PROD_FULFILL_REASON
    : (waitingFor ??
      (!/^[A-Z0-9]{6,}$/.test(confirmationId)
        ? "Falta el localizador."
        : blocked
          ? "El último intento quedó incierto: verifica antes de volver a emitir."
          : undefined))

  const emit = () => {
    const input: FulfillInput = { confirmationId, targetPcc: pcc }
    setAttempt((n) => n + 1)
    fulfill.execute(input, (run) => {
      if (uncertainOf(run) !== undefined) setBlockedFor(confirmationId)
      else if (run.enabled && run.step.ok) {
        onDone?.(ticketsOf(run.step.result), confirmationId)
      }
    })
  }

  return (
    <>
      <StepPanel
        title="tickets.fulfill"
        description={
          <>
            Emite con la receta probada en CERT: <code>CASH</code>, perfil de
            impresora 1 y comisión 0 %, con{" "}
            <code>acceptPriceChanges: false</code> y <code>Quit</code> (los
            defaults del SDK). Mueve dinero: nunca se reintenta. En producción
            no corre.
          </>
        }
        run={fulfill.run}
        pending={fulfill.pending}
        resultView={(result) => <FulfillView result={result} />}
        form={
          <div className="flex flex-col gap-4">
            {fixed === undefined ? (
              <Field>
                <FieldLabel htmlFor="fulfill-confirmationId">
                  Localizador
                </FieldLabel>
                <Input
                  id="fulfill-confirmationId"
                  className="font-mono uppercase"
                  value={typed}
                  onChange={(event) => setTyped(event.target.value)}
                />
              </Field>
            ) : (
              <p className="text-sm">
                Reserva <code className="font-mono">{fixed}</code>
              </p>
            )}
            <Field>
              <FieldLabel htmlFor="fulfill-targetPcc">
                PCC de emisión (targetPcc)
              </FieldLabel>
              <Input
                id="fulfill-targetPcc"
                className="font-mono uppercase"
                value={targetPcc}
                onChange={(event) => setTargetPcc(event.target.value)}
              />
              <FieldDescription>
                Un PCC IATA: si no, Sabre responde{" "}
                <code>INVALID TICKET STOCK</code>. Vacío, el de auth.
                {environment.ticketingPcc !== undefined &&
                  " El valor inicial sale de SABRE_CERT_TICKETING_PCC."}
              </FieldDescription>
            </Field>
            <Confirm
              label="Emitir"
              method="tickets.fulfill"
              variant="destructive"
              side="top"
              disabled={disabled || fulfill.pending || reason !== undefined}
              title={`Emitir ${confirmationId} (mueve dinero)`}
              summary={`Se emiten los boletos de ${confirmationId} en ${environment.label}${pcc === "" ? "" : `, PCC ${pcc}`}, en efectivo. No se reintenta: si el desenlace es incierto, se verifica.`}
              onConfirm={emit}
            />
            {reason !== undefined && (
              <p className="text-muted-foreground text-xs">{reason}</p>
            )}
          </div>
        }
      />
      {uncertain !== undefined && (
        <VerifyPanel
          // Un intento nuevo es otra verificación.
          key={attempt}
          uncertain={uncertain}
          confirmationId={uncertain.confirmationId ?? confirmationId}
          targetPcc={pcc}
          statusText={VERIFY_STATUS_TEXT}
          onVerified={(status, tickets) => {
            // Solo `notFound` dice que no se emitió: entonces Emitir se puede volver a pedir,
            // con su propia confirmación. Con `issued` o `notCommitted`, los boletos existen.
            if (status === "notFound") setBlockedFor(undefined)
            else onDone?.(tickets, uncertain.confirmationId ?? confirmationId)
          }}
        />
      )}
    </>
  )
}

function FulfillView({ result }: { result: unknown }) {
  const status = statusOf(result)
  return (
    <div className="flex flex-col gap-3">
      {status === "partial" && (
        <Alert>
          <TriangleAlert />
          <AlertTitle>Emisión parcial</AlertTitle>
          <AlertDescription>
            Sabre emitió solo una parte (<code>PARTIAL_FULFILLMENT</code>): hay
            pasajeros sin boleto. Mira los avisos en la pestaña Error.
          </AlertDescription>
        </Alert>
      )}
      <TicketsTable status={status} tickets={ticketsOf(result)} />
    </div>
  )
}

/**
 * **Verificar** ante un desenlace incierto (ADR-031): `tickets.verify`, con los boletos que Sabre
 * alcanzó a devolver como `expectedTickets`. Lo usan la emisión y el void, cada uno con sus textos
 * para cada `status`. No hay botón de reintentar.
 */
export function VerifyPanel({
  uncertain,
  confirmationId,
  targetPcc,
  statusText,
  onVerified,
}: {
  uncertain: UncertainOutcome
  confirmationId: string
  targetPcc: string
  statusText: Record<string, string>
  onVerified?: (status: string | undefined, tickets: TicketRow[]) => void
}) {
  const verify = useStep("tickets.verify", verifyTickets)
  const status =
    verify.run?.enabled === true && verify.run.step.ok
      ? statusOf(verify.run.step.result)
      : undefined
  const run = () => {
    const input: VerifyInput = {
      confirmationId,
      targetPcc,
      expectedTickets: uncertain.tickets.map((ticket) => ticket.number),
    }
    verify.execute(input, (result) => {
      if (!result.enabled || !result.step.ok) return
      onVerified?.(statusOf(result.step.result), ticketsOf(result.step.result))
    })
  }
  return (
    <StepPanel
      title="tickets.verify"
      description={
        <>
          Un Get Booking que decide con <code>ticketStatusCode</code>, no con{" "}
          <code>isTicketed</code>. Con los boletos que Sabre alcanzó a devolver
          como <code>expectedTickets</code>, distingue <code>notCommitted</code>{" "}
          (existen) de <code>notFound</code>.
        </>
      }
      run={verify.run}
      pending={verify.pending}
      resultView={(result) => (
        <VerifyView result={result} statusText={statusText} />
      )}
      form={
        <div className="flex flex-col gap-4">
          <p className="text-sm">
            Incierto <code>{uncertain.reason}</code>
            {uncertain.operation !== undefined && (
              <>
                {" "}
                de <code>{uncertain.operation}</code>
              </>
            )}{" "}
            en <code className="font-mono">{confirmationId}</code>.
            {uncertain.tickets.length > 0 &&
              ` Se esperan ${uncertain.tickets.map((t) => t.number).join(", ")}.`}
          </p>
          <Button variant="outline" disabled={verify.pending} onClick={run}>
            Verificar
          </Button>
          {status !== undefined && (
            <FieldDescription>{statusText[status] ?? status}</FieldDescription>
          )}
        </div>
      }
    />
  )
}

function VerifyView({
  result,
  statusText,
}: {
  result: unknown
  statusText: Record<string, string>
}) {
  const status = statusOf(result)
  const missing = (result as { missing?: string[] } | undefined)?.missing
  return (
    <div className="flex flex-col gap-3">
      {status !== undefined && (
        <p className="text-sm">{statusText[status] ?? status}</p>
      )}
      {missing !== undefined && missing.length > 0 && (
        <p className="text-sm">
          Emitidos pero no en el PNR:{" "}
          <code className="font-mono">{missing.join(", ")}</code>
        </p>
      )}
      <TicketsTable status={status} tickets={ticketsOf(result)} />
    </div>
  )
}

export function TicketsTable({
  status,
  tickets,
}: {
  status?: string
  tickets: TicketRow[]
}) {
  return (
    <div className="flex flex-col gap-2">
      {status !== undefined && (
        <div>
          <Badge variant="outline" className="font-mono">
            {status}
          </Badge>
        </div>
      )}
      {tickets.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Boleto</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>En el PNR</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tickets.map((ticket) => (
              <TableRow key={ticket.number}>
                <TableCell className="font-mono">{ticket.number}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      ticket.ticketStatusCode === "TV" ? "secondary" : "default"
                    }
                  >
                    {ticket.ticketStatusCode ?? "?"}
                  </Badge>{" "}
                  {ticket.ticketStatusName}
                </TableCell>
                <TableCell className="font-mono">
                  {ticket.date ?? "—"}
                </TableCell>
                <TableCell>
                  {ticket.isCommitted === undefined
                    ? "—"
                    : ticket.isCommitted
                      ? "sí"
                      : "no"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
