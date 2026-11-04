"use client"

import { HistoryIcon } from "lucide-react"
import { useRef, useState } from "react"
import { JsonTree } from "@/components/custom/json-tree"
import { EnvironmentBadge } from "@/components/environment/environment-badge"
import {
  HISTORY_LIMIT,
  useHistory,
} from "@/components/history/history-provider"
import { HistoryTable } from "@/components/history/history-table"
import { StepPanel } from "@/components/step/step-panel"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { fileBase } from "@/lib/step/file-name"

/**
 * El historial de la sesión: la tabla de llamadas y, al elegir una, su `StepPanel` con lo
 * que devolvió. A la izquierda del panel va lo que se mandó, en lugar del formulario.
 */
export function HistoryView() {
  const { entries, clear } = useHistory()
  const [selectedId, setSelectedId] = useState<string>()
  const panel = useRef<HTMLDivElement>(null)
  const selected = entries.find((entry) => entry.id === selectedId)

  if (entries.length === 0) {
    return (
      <Empty className="flex-none border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <HistoryIcon />
          </EmptyMedia>
          <EmptyTitle>Sin llamadas en esta sesión</EmptyTitle>
          <EmptyDescription>
            Cada paso que corras aparece acá. El historial vive en la memoria
            del navegador y se vacía al recargar.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <>
      <Card>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-muted-foreground text-sm">
              {entries.length} {entries.length === 1 ? "llamada" : "llamadas"} ·
              se guardan las últimas {HISTORY_LIMIT}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                clear()
                setSelectedId(undefined)
              }}
            >
              Vaciar
            </Button>
          </div>
          <HistoryTable
            entries={entries}
            selectedId={selectedId}
            onSelect={(id) => {
              setSelectedId(id)
              requestAnimationFrame(() =>
                panel.current?.scrollIntoView({ behavior: "smooth" })
              )
            }}
          />
        </CardContent>
      </Card>
      {selected !== undefined && (
        <div ref={panel} className="scroll-mt-16">
          <StepPanel
            key={selected.id}
            title={selected.method}
            description={new Date(selected.at).toLocaleString("es-MX", {
              hour12: false,
            })}
            run={selected.run}
            form={
              <div className="flex flex-col gap-3">
                {selected.run.environment !== undefined && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Entorno</span>
                    <EnvironmentBadge environment={selected.run.environment} />
                  </div>
                )}
                {selected.input === undefined ? (
                  <p className="text-muted-foreground text-sm">
                    El paso no recibe entrada.
                  </p>
                ) : (
                  <JsonTree
                    value={selected.input}
                    filename={`${fileBase(selected.method)}.input.json`}
                  />
                )}
              </div>
            }
          />
        </div>
      )}
    </>
  )
}
