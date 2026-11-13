"use client"

import { useEffect, useRef } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { StepRun } from "@/lib/step/types"

/**
 * La pantalla del host (F15.2): sin recortar y en monoespaciado, porque las pantallas de
 * Sabre van alineadas por columna y pueden empezar con un espacio. Los `warnings` van aparte.
 */

/** Un comando de la corrida. Vive en la memoria del navegador y se pierde al recargar. */
export interface CommandEntry {
  id: string
  command: string
  /** ISO 8601. */
  at: string
  run: StepRun
}

/** El texto de la pantalla, si el resultado lo trae (`SabreCommandResponse.text`). */
export function screenText(result: unknown): string | undefined {
  if (typeof result !== "object" || result === null) return undefined
  const text = (result as { text?: unknown }).text
  return typeof text === "string" ? text : undefined
}

/** La pantalla tal cual. `whitespace-pre`: ni recorte ni ajuste de línea. */
export function HostScreen({ text }: { text: string }) {
  return (
    <pre
      data-slot="host-screen"
      className="bg-muted overflow-x-auto rounded-md p-3 font-mono text-xs leading-snug whitespace-pre"
    >
      {text === "" ? " " : text}
    </pre>
  )
}

/** Los `stl:Warning` de la respuesta, fuera de la pantalla. */
function Warnings({ warnings }: { warnings?: unknown[] }) {
  if (warnings === undefined || warnings.length === 0) return null
  return (
    <Alert>
      <AlertTitle>warnings ({warnings.length})</AlertTitle>
      <AlertDescription>
        <ul className="list-inside list-disc font-mono text-xs">
          {warnings.map((warning, index) => (
            // Los warnings no traen id y no cambian de orden.
            // biome-ignore lint/suspicious/noArrayIndexKey: lista fija
            <li key={index}>
              {typeof warning === "string" ? warning : JSON.stringify(warning)}
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  )
}

/** Lo que dejó una corrida: la pantalla, el error del SDK o por qué no se mandó. */
export function CommandOutcome({ run }: { run: StepRun }) {
  if (!run.enabled) {
    return <p className="text-destructive text-xs">No se mandó: {run.reason}</p>
  }
  const { step } = run
  if (!step.ok) {
    return (
      <p className="text-destructive font-mono text-xs">
        {step.error?.class}: {step.error?.message}
      </p>
    )
  }
  return (
    <div className="flex flex-col gap-2">
      <HostScreen text={screenText(step.result) ?? ""} />
      <Warnings warnings={step.warnings} />
    </div>
  )
}

/** El resultado de la última llamada, sobre el JSON de la pestaña Resultado. */
export function ScreenResult({ result }: { result: unknown }) {
  const text = screenText(result)
  if (text === undefined) return null
  const warnings = (result as { warnings?: unknown[] }).warnings
  return (
    <div className="flex flex-col gap-2">
      <HostScreen text={text} />
      <Warnings warnings={warnings} />
    </div>
  )
}

/**
 * Los comandos de la corrida y sus pantallas, del más viejo al más nuevo, como una terminal.
 * Solo en memoria: no se guarda al recargar ni va en la URL (ADR-032).
 */
export function CommandTranscript({
  entries,
  onClear,
}: {
  entries: CommandEntry[]
  onClear: () => void
}) {
  const end = useRef<HTMLLIElement>(null)
  const last = entries.at(-1)?.id
  useEffect(() => {
    if (last !== undefined) end.current?.scrollIntoView({ block: "nearest" })
  }, [last])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Corrida</CardTitle>
        <CardDescription>
          Solo en la memoria del navegador: al recargar no queda nada.
        </CardDescription>
        {entries.length > 0 && (
          <CardAction>
            <Button variant="outline" size="sm" onClick={onClear}>
              Limpiar
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Todavía no se mandó ningún comando.
          </p>
        ) : (
          <ol className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto">
            {entries.map((entry) => (
              <li key={entry.id} className="flex flex-col gap-1.5">
                <div className="flex items-baseline gap-2 font-mono text-sm">
                  <span className="text-muted-foreground">&gt;</span>
                  <span className="break-all">{entry.command}</span>
                  <time
                    className="text-muted-foreground ms-auto text-xs"
                    dateTime={entry.at}
                  >
                    {new Date(entry.at).toLocaleTimeString()}
                  </time>
                </div>
                <CommandOutcome run={entry.run} />
              </li>
            ))}
            <li ref={end} aria-hidden className="h-0" />
          </ol>
        )}
      </CardContent>
    </Card>
  )
}
