"use client"

import { CircleAlert, CircleCheck, HistoryIcon, Keyboard } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import {
  type HistoryEntry,
  useHistory,
} from "@/components/history/history-provider"
import { StepOutput } from "@/components/step/step-panel"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { failureOf } from "@/lib/queue-desk"
import { cn } from "@/lib/utils"

/** Cuántas llamadas caben en la barra. Las demás siguen en el historial. */
const VISIBLE = 8

/** Los atajos de la mesa, para la leyenda. */
export const DESK_SHORTCUTS: [string, string][] = [
  ["I", "Siguiente (queue.ignore)"],
  ["M", "Mover: foco en la cola destino"],
  ["R", "Sacar de la cola (pide confirmación)"],
  ["E", "Salir de la cola (queue.exit)"],
  ["B", "Ver la reserva"],
  ["Esc", "Cerrar la hoja o el popover"],
  ["?", "Esta leyenda"],
]

/**
 * La barra de actividad de la mesa (F9.5, ADR-025): las últimas llamadas desde que se abrió la
 * mesa, con método, resultado, duración y warnings. Un clic abre un panel lateral con las
 * cuatro pestañas de ADR-022 y "Copiar como hallazgo": la mesa no esconde lo que la consola
 * existe para mostrar. Todo sale del historial del navegador (`useStep` ya graba cada
 * llamada).
 *
 * El censo de colas (`/queue-census`) la usa igual, sin la leyenda de atajos.
 */
export function ActivityBar({
  since,
  legendOpen,
  onLegendOpenChange,
}: {
  /** ISO 8601: desde cuándo son de la mesa las llamadas del historial. */
  since: string
  /** Sin estos dos, no hay leyenda de atajos. */
  legendOpen?: boolean
  onLegendOpenChange?: (open: boolean) => void
}) {
  const { entries } = useHistory()
  const [selectedId, setSelectedId] = useState<string>()
  const desk = entries.filter((entry) => entry.at >= since)
  // La más nueva a la izquierda: si no caben todas, se cortan las más viejas.
  const visible = desk.slice(0, VISIBLE)
  const selected = entries.find((entry) => entry.id === selectedId)

  return (
    <footer className="flex h-10 shrink-0 items-center gap-2 border-t px-4 text-sm">
      <span className="text-muted-foreground shrink-0 font-medium">
        Actividad
      </span>
      <ol
        aria-label="Últimas llamadas"
        // `contain: inline-size`: el ancho de las llamadas no empuja el de la mesa; lo que no
        // cabe se corta.
        className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden [contain:inline-size]"
      >
        {visible.length === 0 && (
          <li className="text-muted-foreground">sin llamadas todavía</li>
        )}
        {visible.map((entry) => (
          <li key={entry.id} className="shrink-0">
            <ActivityItem
              entry={entry}
              selected={entry.id === selectedId}
              onSelect={() => setSelectedId(entry.id)}
            />
          </li>
        ))}
      </ol>
      {legendOpen !== undefined && onLegendOpenChange !== undefined && (
        <Legend open={legendOpen} onOpenChange={onLegendOpenChange} />
      )}
      <Link
        href="/history"
        className="text-muted-foreground hover:text-foreground inline-flex shrink-0 items-center gap-1"
      >
        <HistoryIcon className="size-4" />
        Historial
      </Link>
      <Sheet
        modal={false}
        open={selected !== undefined}
        onOpenChange={(open) => {
          if (!open) setSelectedId(undefined)
        }}
      >
        <SheetContent showOverlay={false} className="w-full gap-0 sm:max-w-xl">
          {selected !== undefined && (
            <>
              <SheetHeader className="border-b">
                <SheetTitle className="font-mono">{selected.method}</SheetTitle>
                <SheetDescription>
                  {new Date(selected.at).toLocaleString("es-MX", {
                    hour12: false,
                  })}
                </SheetDescription>
              </SheetHeader>
              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                <StepOutput
                  key={selected.id}
                  run={selected.run}
                  pending={false}
                  title={selected.method}
                />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </footer>
  )
}

function ActivityItem({
  entry,
  selected,
  onSelect,
}: {
  entry: HistoryEntry
  selected: boolean
  onSelect: () => void
}) {
  const { run } = entry
  const failure = failureOf(run)
  const warnings = run.enabled ? (run.step.warnings?.length ?? 0) : 0
  const time = new Date(entry.at).toLocaleTimeString("es-MX", {
    hour12: false,
  })
  return (
    <button
      type="button"
      onClick={onSelect}
      title={failure ?? `${entry.method} · ${time}`}
      className={cn(
        "hover:bg-muted inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-xs",
        selected && "bg-muted"
      )}
    >
      <span className="text-muted-foreground">{time}</span>
      <span>{entry.method}</span>
      {failure === undefined ? (
        <CircleCheck className="size-3.5 text-emerald-600" />
      ) : (
        <CircleAlert className="text-destructive size-3.5" />
      )}
      {run.enabled && (
        <span className="text-muted-foreground">
          {(run.step.durationMs / 1000).toFixed(1)}s
        </span>
      )}
      {warnings > 0 && <span className="text-amber-600">⚠{warnings}</span>}
    </button>
  )
}

/** La leyenda de atajos: con `?` o con el botón. */
function Legend({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Atajos de teclado (?)"
            title="Atajos de teclado (?)"
          />
        }
      >
        <Keyboard />
      </PopoverTrigger>
      <PopoverContent side="top" align="end">
        <PopoverHeader>
          <PopoverTitle>Atajos de la mesa</PopoverTitle>
        </PopoverHeader>
        <dl className="grid grid-cols-[3rem_minmax(0,1fr)] gap-x-3 gap-y-1">
          {DESK_SHORTCUTS.map(([key, label]) => (
            <div key={key} className="contents">
              <dt>
                <kbd className="bg-muted rounded border px-1.5 font-mono text-xs">
                  {key}
                </kbd>
              </dt>
              <dd className="text-muted-foreground">{label}</dd>
            </div>
          ))}
        </dl>
        <p className="text-muted-foreground text-xs">
          Solo con el foco fuera de los campos. Mover y sacar siguen pidiendo
          confirmación.
        </p>
      </PopoverContent>
    </Popover>
  )
}
