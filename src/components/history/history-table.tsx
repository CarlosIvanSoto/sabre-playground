"use client"

import { EnvironmentBadge } from "@/components/environment/environment-badge"
import type { HistoryEntry } from "@/components/history/history-provider"
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

/** Hora local `HH:MM:SS`. */
function time(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-MX", { hour12: false })
}

function Outcome({ entry }: { entry: HistoryEntry }) {
  const { run } = entry
  if (!run.enabled) return <Badge variant="outline">no corrió</Badge>
  if (run.step.ok) return <Badge>ok</Badge>
  return <Badge variant="destructive">{run.step.error?.code ?? "error"}</Badge>
}

/** Las llamadas de la sesión, de la más nueva a la más vieja. */
export function HistoryTable({
  entries,
  selectedId,
  onSelect,
}: {
  entries: HistoryEntry[]
  selectedId?: string
  onSelect: (id: string) => void
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Hora</TableHead>
          <TableHead>Método</TableHead>
          <TableHead>Entorno</TableHead>
          <TableHead className="text-end">Duración</TableHead>
          <TableHead>Resultado</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => (
          <TableRow
            key={entry.id}
            data-state={entry.id === selectedId ? "selected" : undefined}
          >
            <TableCell className="font-mono text-xs">
              {time(entry.at)}
            </TableCell>
            <TableCell>
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0 font-mono"
                aria-current={entry.id === selectedId ? "true" : undefined}
                onClick={() => onSelect(entry.id)}
              >
                {entry.method}
              </Button>
            </TableCell>
            <TableCell>
              {entry.run.environment !== undefined && (
                <EnvironmentBadge environment={entry.run.environment} />
              )}
            </TableCell>
            <TableCell className="text-muted-foreground text-end tabular-nums">
              {entry.run.enabled ? `${entry.run.step.durationMs} ms` : "—"}
            </TableCell>
            <TableCell>
              <Outcome entry={entry} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
