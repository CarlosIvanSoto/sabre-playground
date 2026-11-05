"use client"

import { Flag } from "lucide-react"
import type {
  QueueCountResponse,
  QueuePlaceResult,
  QueueStep,
} from "sabre-client"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatQueueRef } from "@/lib/queues"

/**
 * Vistas del resultado de las colas, sobre el JSON de la pestaña Resultado. Muestran los
 * campos tal cual llegan del SDK: `placedAt` de `list` y de `access` no significan lo mismo
 * (#96), así que no se resuelven ni se comparan.
 */

/**
 * `count`: cada cola numérica se puede elegir, y eso llena los pasos que siguen (el recorrido,
 * `queue-journey`). Las colas con nombre se ven, pero no se ofrecen (Q-086).
 */
export function QueueCountView({
  result,
  chosen,
  onChoose,
}: {
  result: unknown
  /** La cola elegida, como texto. */
  chosen: string
  onChoose: (queue: string) => void
}) {
  const count = result as QueueCountResponse
  if (!Array.isArray(count?.queues)) return null
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Cola</TableHead>
          <TableHead className="text-right">count</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {count.queues.map(({ queue, count: n }) => {
          const label = formatQueueRef(queue)
          return (
            <TableRow key={label}>
              <TableCell className="font-mono">{label}</TableCell>
              <TableCell className="text-right tabular-nums">{n}</TableCell>
              <TableCell className="text-right">
                {typeof queue !== "number" ? (
                  // Q-086: en CERT, `list` y `access` con el `{ name }` que trae `count` dan
                  // `INVALID QUEUE NAME FORMAT`. No se ofrece; a mano, el error sale tal cual.
                  <span
                    className="text-muted-foreground text-xs"
                    title="Q-086: list y access con este nombre dan INVALID QUEUE NAME FORMAT"
                  >
                    con nombre: sin acceso (Q-086)
                  </span>
                ) : label === chosen ? (
                  <Badge>Elegida</Badge>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onChoose(label)}
                  >
                    Elegir
                  </Button>
                )}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

/** Un `QueueStep`: el PNR en el que quedó la cola, o el fin de cola como resultado. */
export function QueueStepView({ result }: { result: unknown }) {
  const step = result as QueueStep | (QueuePlaceResult & { kind: "placed" })
  if (typeof step !== "object" || step === null) return null
  if (!("done" in step)) return null
  if (step.done) {
    return (
      <Alert>
        <Flag />
        <AlertTitle>
          Fin de cola: <code>{step.reason}</code>
        </AlertTitle>
        <AlertDescription>
          {step.message}. La sesión queda fuera de la cola.
        </AlertDescription>
      </Alert>
    )
  }
  const { item } = step
  return (
    <div className="flex flex-col gap-3">
      <Table>
        <TableBody>
          <Row label="locator" value={item.locator} />
          <Row label="placedAt" value={item.placedAt} />
          <Row
            label="placedBy"
            value={
              item.placedBy === undefined
                ? undefined
                : [item.placedBy.pseudoCityCode, item.placedBy.agentSine]
                    .filter(Boolean)
                    .join(" · ")
            }
          />
          <Row label="primaryPassenger" value={item.primaryPassenger} />
        </TableBody>
      </Table>
      <pre className="bg-muted overflow-x-auto rounded-md p-3 font-mono text-xs">
        {item.paragraph.join("\n")}
      </pre>
    </div>
  )
}

function Row({ label, value }: { label: string; value?: string }) {
  return (
    <TableRow>
      <TableCell className="text-muted-foreground font-mono">{label}</TableCell>
      <TableCell className="font-mono">{value ?? "—"}</TableCell>
    </TableRow>
  )
}
