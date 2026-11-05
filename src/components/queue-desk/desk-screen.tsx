"use client"

import {
  CircleAlert,
  CircleCheck,
  Flag,
  LogOut,
  TriangleAlert,
} from "lucide-react"
import { type ReactNode, useState } from "react"
import type { QueueParagraph, QueueStep } from "sabre-client"
import { parseParagraph } from "@/app/(console)/queue-paragraph/actions"
import { JsonTree } from "@/components/custom/json-tree"
import { RawBody } from "@/components/step/raw-body"
import { useStep } from "@/components/step/use-step"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { type DeskScreen, failureOf } from "@/lib/queue-desk"
import { today } from "@/lib/queue-paragraph"

type Tab = "paragraph" | "parsed" | "raw"

/**
 * El centro de la mesa: lo que dejó el último paso del cursor. Un PNR se ve con tres
 * pestañas: *Párrafo* (el texto del host), *Parseado* (`parseQueueParagraph`, que resuelve
 * las fechas con `resolveHostDate`) y *Crudo* (el sobre SOAP, con el token redactado). El fin
 * de cola es un resultado, no un error.
 *
 * Se vuelve a montar con cada paso (`key`), así que *Parseado* corre una vez por PNR, y solo
 * si se abre la pestaña.
 */
export function DeskScreenView({ screen }: { screen?: DeskScreen }) {
  if (screen === undefined) {
    return (
      <Hint>
        Elige una cola del conteo para entrar. El PNR en el que quede el cursor
        se ve aquí.
      </Hint>
    )
  }
  const failure = failureOf(screen.run)
  if (failure !== undefined || !screen.run.enabled) {
    return (
      <Alert variant="destructive">
        <CircleAlert />
        <AlertTitle>
          <code>{screen.method}</code> no salió
        </AlertTitle>
        <AlertDescription className="break-words">{failure}</AlertDescription>
      </Alert>
    )
  }
  const notes = (
    <WriteNotes note={screen.note} warnings={screen.run.step.warnings} />
  )
  const step = screen.run.step.result as QueueStep | undefined
  if (step === undefined || typeof step !== "object" || !("done" in step)) {
    return (
      <Alert>
        <LogOut />
        <AlertTitle>Fuera de la cola</AlertTitle>
        <AlertDescription>
          <code>{screen.method}</code> dejó la sesión fuera de la cola.
        </AlertDescription>
      </Alert>
    )
  }
  if (step.done) {
    return (
      <>
        {notes}
        <Alert>
          <Flag />
          <AlertTitle>
            Fin de cola: <code>{step.reason}</code>
          </AlertTitle>
          <AlertDescription>
            {step.message}. La sesión queda fuera de la cola.
          </AlertDescription>
        </Alert>
      </>
    )
  }
  return (
    <>
      {notes}
      <ItemTabs screen={screen} paragraph={step.item.paragraph} />
    </>
  )
}

function ItemTabs({
  screen,
  paragraph,
}: {
  screen: DeskScreen
  paragraph: readonly string[]
}) {
  const [tab, setTab] = useState<Tab>("paragraph")
  const parse = useStep("parseQueueParagraph", parseParagraph)
  const raw = screen.run.enabled ? screen.run.step.raw : undefined

  const choose = (value: Tab) => {
    setTab(value)
    if (value === "parsed" && parse.run === undefined && !parse.pending) {
      parse.execute({ text: paragraph.join("\n"), referenceDate: today() })
    }
  }

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => choose(value as Tab)}
      className="flex min-h-0 flex-1 flex-col"
    >
      <TabsList className="shrink-0">
        <TabsTrigger value="paragraph">Párrafo</TabsTrigger>
        <TabsTrigger value="parsed">Parseado</TabsTrigger>
        <TabsTrigger value="raw">Crudo</TabsTrigger>
      </TabsList>
      <TabsContent
        value="paragraph"
        className="bg-muted min-h-0 flex-1 overflow-auto rounded-md p-3"
      >
        <pre className="font-mono text-xs leading-relaxed">
          {paragraph.join("\n")}
        </pre>
      </TabsContent>
      <TabsContent value="parsed" className="min-h-0 flex-1 overflow-auto">
        {parse.pending || parse.run === undefined ? (
          <Spinner />
        ) : failureOf(parse.run) !== undefined || !parse.run.enabled ? (
          <p className="text-destructive">{failureOf(parse.run)}</p>
        ) : (
          <Parsed value={parse.run.step.result as QueueParagraph} />
        )}
      </TabsContent>
      <TabsContent value="raw" className="min-h-0 flex-1 overflow-auto">
        {raw === undefined ? (
          <Hint>Sin respuesta cruda.</Hint>
        ) : (
          <RawBody raw={raw} name={raw.operation} />
        )}
      </TabsContent>
    </Tabs>
  )
}

/** Un resumen de lo que reconoció el parser, y debajo el resultado completo. */
function Parsed({ value }: { value: QueueParagraph }) {
  const received = value.receivedFrom
  const rows: [string, ReactNode][] = [
    [
      "Avisos",
      value.messages.length === 0
        ? "—"
        : value.messages
            .map(
              (message) =>
                `PIC ${String(message.instructionCode).padStart(3, "0")} ${message.text}`
            )
            .join(" · "),
    ],
    ["Pasajeros", value.passengers.length],
    ["Segmentos", value.segments.length],
    [
      "Ticketing",
      value.ticketing === undefined
        ? "—"
        : `${value.ticketing.entries.length} entradas${value.ticketing.issued ? ", emitido" : ""}`,
    ],
    [
      "Firma",
      received === undefined
        ? "—"
        : [
            received.name && `recibido de ${received.name}`,
            received.pseudoCityCode &&
              `${received.pseudoCityCode}${received.agentSine ? `*${received.agentSine}` : ""}`,
            received.receivedAt,
            received.locator,
          ]
            .filter(Boolean)
            .join(" · "),
    ],
    ["Sin reconocer", `${value.unparsed.length} líneas`],
  ]
  return (
    <div className="flex flex-col gap-3 text-sm">
      <dl className="grid grid-cols-[8rem_minmax(0,1fr)] gap-x-3 gap-y-1">
        {rows.map(([label, content]) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-mono text-xs leading-5 break-words">
              {content}
            </dd>
          </div>
        ))}
      </dl>
      <JsonTree value={value} filename="queue-paragraph.json" />
    </div>
  )
}

/**
 * Lo que dejó la escritura que trajo este PNR (`place` o `remove`) y los `warnings` de la
 * respuesta, tal cual. El de `place` dentro de una cola es el que sigue pendiente de capturar
 * desde la Fase 4.
 */
function WriteNotes({
  note,
  warnings,
}: {
  note?: string
  warnings?: unknown[]
}) {
  if (note === undefined && (warnings === undefined || warnings.length === 0)) {
    return null
  }
  return (
    <div className="mb-3 flex shrink-0 flex-col gap-2">
      {note !== undefined && (
        <Alert>
          <CircleCheck />
          <AlertTitle>{note}</AlertTitle>
        </Alert>
      )}
      {warnings !== undefined && warnings.length > 0 && (
        <Alert>
          <TriangleAlert />
          <AlertTitle>
            {warnings.length === 1
              ? "1 warning"
              : `${warnings.length} warnings`}
          </AlertTitle>
          <AlertDescription>
            <ul className="font-mono text-xs break-words">
              {warnings.map((warning, index) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: la lista no cambia de orden
                <li key={index}>{warningText(warning)}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}

/** `CODE: mensaje` de un `SabreWarning` serializado, o el JSON si no tiene esa forma. */
function warningText(warning: unknown): string {
  if (typeof warning === "object" && warning !== null) {
    const { code, message } = warning as { code?: unknown; message?: unknown }
    if (typeof message === "string") {
      return typeof code === "string" && code !== ""
        ? `${code}: ${message}`
        : message
    }
  }
  return JSON.stringify(warning)
}

function Hint({ children }: { children: ReactNode }) {
  return <p className="text-muted-foreground text-sm">{children}</p>
}
