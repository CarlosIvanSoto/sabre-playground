"use client"

import { CircleAlert, Play } from "lucide-react"
import { type ReactNode, useState } from "react"
import { JsonTree } from "@/components/custom/json-tree"
import { EnvironmentBadge } from "@/components/environment/environment-badge"
import { RawBody } from "@/components/step/raw-body"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Spinner } from "@/components/ui/spinner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { ConsoleEnvironmentId } from "@/lib/environment"
import { fileBase } from "@/lib/step/file-name"
import type {
  LogLine,
  RawResponse,
  StepError,
  StepResult,
  StepRun,
} from "@/lib/step/types"

type Tab = "result" | "raw" | "error" | "log"

export interface StepPanelProps {
  /** Método del SDK que corre el paso, p. ej. `booking.get`. */
  title: string
  description?: ReactNode
  /** El formulario del paso. Se muestra a la izquierda. */
  form: ReactNode
  /** Lo que devolvió la server action. `undefined` mientras no se haya corrido. */
  run?: StepRun
  /** La llamada está en vuelo. */
  pending?: boolean
}

/**
 * El layout único de cada paso (ADR-022): el formulario a la izquierda y, a la derecha, las
 * pestañas Resultado / Crudo / Error / Log con lo que devolvió `runStep()`.
 */
export function StepPanel({
  title,
  description,
  form,
  run,
  pending = false,
}: StepPanelProps) {
  return (
    <div
      data-slot="step-panel"
      className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]"
    >
      <Card>
        <CardHeader>
          <CardTitle className="font-mono">{title}</CardTitle>
          {description !== undefined && (
            <CardDescription>{description}</CardDescription>
          )}
        </CardHeader>
        <CardContent>{form}</CardContent>
      </Card>
      <Card className="min-w-0">
        <CardContent>
          <StepOutput run={run} pending={pending} title={title} />
        </CardContent>
      </Card>
    </div>
  )
}

function StepOutput({
  run,
  pending,
  title,
}: {
  run?: StepRun
  pending: boolean
  title: string
}) {
  if (pending) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Spinner />
          </EmptyMedia>
          <EmptyTitle>Llamando…</EmptyTitle>
          <EmptyDescription>Esperando la respuesta de Sabre.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }
  if (run === undefined) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Play />
          </EmptyMedia>
          <EmptyTitle>Sin llamadas todavía</EmptyTitle>
          <EmptyDescription>
            Corre el paso para ver el resultado, la respuesta cruda, el error y
            el log.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }
  if (!run.enabled) {
    return (
      <Alert variant="destructive">
        <CircleAlert />
        <AlertTitle>
          El paso no se corrió
          {run.environment !== undefined && (
            <EnvironmentBadge environment={run.environment} className="ms-2" />
          )}
        </AlertTitle>
        <AlertDescription>{run.reason}</AlertDescription>
      </Alert>
    )
  }
  // Base de los nombres de archivo: la operación del SDK, o el título del paso.
  const name = fileBase(run.step.raw?.operation ?? title)
  return <StepTabs step={run.step} name={name} environment={run.environment} />
}

function StepTabs({
  step,
  name,
  environment,
}: {
  step: StepResult
  name: string
  environment?: ConsoleEnvironmentId
}) {
  const initial: Tab = step.ok ? "result" : "error"
  const [tab, setTab] = useState<Tab>(initial)
  // Con un paso nuevo se vuelve a la pestaña que le corresponde.
  const [shown, setShown] = useState(step)
  if (shown !== step) {
    setShown(step)
    setTab(initial)
  }

  return (
    <div className="flex flex-col gap-3">
      <StepSummary step={step} environment={environment} />
      <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)}>
        <TabsList>
          <TabsTrigger value="result">Resultado</TabsTrigger>
          <TabsTrigger value="raw">Crudo</TabsTrigger>
          <TabsTrigger value="error">
            Error
            {step.error !== undefined && <Badge variant="destructive">1</Badge>}
          </TabsTrigger>
          <TabsTrigger value="log">
            Log
            {step.log.length > 0 && (
              <Badge variant="secondary">{step.log.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="result">
          {step.ok ? (
            <Json value={step.result} filename={`${name}.result.json`} />
          ) : (
            <Nothing>El SDK lanzó un error: no hay resultado.</Nothing>
          )}
        </TabsContent>
        <TabsContent value="raw">
          {step.raw === undefined ? (
            <Nothing>
              Sin respuesta HTTP: la llamada no llegó a Sabre, o fue solo de
              token.
            </Nothing>
          ) : (
            <RawView raw={step.raw} name={name} />
          )}
        </TabsContent>
        <TabsContent value="error">
          {step.error === undefined ? (
            <Nothing>Sin error.</Nothing>
          ) : (
            <ErrorView error={step.error} name={name} />
          )}
        </TabsContent>
        <TabsContent value="log">
          {step.log.length === 0 ? (
            <Nothing>El SDK no registró nada en esta llamada.</Nothing>
          ) : (
            <LogView log={step.log} name={name} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function StepSummary({
  step,
  environment,
}: {
  step: StepResult
  environment?: ConsoleEnvironmentId
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      {environment !== undefined && (
        <EnvironmentBadge environment={environment} />
      )}
      {step.ok ? (
        <Badge>ok</Badge>
      ) : (
        <Badge variant="destructive">{step.error?.class ?? "error"}</Badge>
      )}
      {step.error?.code !== undefined && (
        <Badge variant="outline" className="font-mono">
          {step.error.code}
        </Badge>
      )}
      <span className="text-muted-foreground">{step.durationMs} ms</span>
      {step.attempts !== undefined && (
        <span className="text-muted-foreground">
          {step.attempts} {step.attempts === 1 ? "intento" : "intentos"}
        </span>
      )}
    </div>
  )
}

function RawView({ raw, name }: { raw: RawResponse; name: string }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="font-mono">
          {raw.operation}
        </Badge>
        <Badge variant="outline" className="uppercase">
          {raw.protocol}
        </Badge>
        <Badge variant={raw.status < 400 ? "secondary" : "destructive"}>
          HTTP {raw.status}
        </Badge>
      </div>
      <Fields
        rows={Object.entries(raw.headers).map(([name, value]) => [name, value])}
      />
      {raw.body === "" ? (
        <Nothing>Body vacío.</Nothing>
      ) : (
        <RawBody raw={raw} name={name} />
      )}
    </div>
  )
}

function ErrorView({ error, name }: { error: StepError; name: string }) {
  const { warnings, errors, ...fields } = error
  return (
    <div className="flex flex-col gap-3">
      <Fields
        rows={Object.entries(fields).map(([name, value]) => [
          name,
          String(value),
        ])}
      />
      {warnings !== undefined && warnings.length > 0 && (
        <Section title="warnings">
          <Json value={warnings} filename={`${name}.error.warnings.json`} />
        </Section>
      )}
      {errors !== undefined && errors.length > 0 && (
        <Section title="errors">
          <Json value={errors} filename={`${name}.error.errors.json`} />
        </Section>
      )}
    </div>
  )
}

const LEVEL_VARIANT = {
  debug: "outline",
  info: "secondary",
  warn: "default",
  error: "destructive",
} as const

function LogView({ log, name }: { log: LogLine[]; name: string }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Hora</TableHead>
          <TableHead>Nivel</TableHead>
          <TableHead>Evento</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {log.map((line, index) => (
          // Las líneas no tienen id y la lista no cambia de orden.
          // biome-ignore lint/suspicious/noArrayIndexKey: ver arriba
          <TableRow key={index} className="align-top">
            <TableCell className="font-mono text-xs">
              {line.at.slice(11, 23)}
            </TableCell>
            <TableCell>
              <Badge variant={LEVEL_VARIANT[line.level]}>{line.level}</Badge>
            </TableCell>
            <TableCell className="whitespace-normal">
              <div className="font-mono text-xs">{line.event}</div>
              {line.context !== undefined && (
                <Json
                  value={line.context}
                  filename={`${name}.log-${index + 1}.json`}
                />
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function Fields({ rows }: { rows: [string, string][] }) {
  return (
    <Table>
      <TableBody>
        {rows.map(([name, value]) => (
          <TableRow key={name}>
            <TableCell className="text-muted-foreground w-0 font-mono text-xs">
              {name}
            </TableCell>
            <TableCell className="font-mono text-xs whitespace-normal break-all">
              {value}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="text-muted-foreground font-mono text-xs">{title}</div>
      {children}
    </div>
  )
}

/** Datos planos como árbol colapsable. `undefined` (sin resultado) se ve como `null`. */
function Json({ value, filename }: { value: unknown; filename: string }) {
  return <JsonTree value={value} filename={filename} />
}

function Nothing({ children }: { children: ReactNode }) {
  return <p className="text-muted-foreground py-6 text-center">{children}</p>
}
