"use client"

import { ExternalLink, Play, Square } from "lucide-react"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import {
  censusAccess,
  censusBooking,
  censusClock,
  censusCount,
  censusExit,
  censusIgnore,
} from "@/app/(console)/queue-census/actions"
import { sessionStatus } from "@/app/(console)/session/actions"
import { JsonTree } from "@/components/custom/json-tree"
import { useEnvironment } from "@/components/environment/environment-provider"
import { useHistory } from "@/components/history/history-provider"
import { CensusExport } from "@/components/queue-census/census-export"
import { useCensus } from "@/components/queue-census/census-provider"
import { CensusSummaryView } from "@/components/queue-census/census-summary"
import { ActivityBar } from "@/components/queue-desk/desk-activity"
import { DeskPcc } from "@/components/queue-desk/desk-queues"
import { DeskSessionBar } from "@/components/queue-desk/desk-session"
import { UnlockCard } from "@/components/queues/queues-flow"
import { useSessionStatus } from "@/components/session/use-session-status"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { buildCensusExport } from "@/lib/census-export"
import { summarizeCensus } from "@/lib/census-summary"
import type { ConsoleEnvironmentId } from "@/lib/environment"
import { FAKE_REST_REASON } from "@/lib/flows"
import {
  bookingOf,
  CENSUS_RANGE,
  type CensusEnded,
  type CensusItem,
  type CensusQueue,
  censusCountOf,
  censusReadOf,
  censusSummary,
  countChanges,
  DEFAULT_PER_QUEUE,
  inCensusRange,
  isRunning,
  MAX_PER_QUEUE,
  parsePerQueue,
  plannedOf,
  type QueueCensus as QueueCensusState,
} from "@/lib/queue-census"
import { bookingHref, failureOf, shownPcc } from "@/lib/queue-desk"
import type { StepRun } from "@/lib/step/types"

/**
 * El censo de colas (F10.1, #95; ADR-026): un recorrido automático de solo lectura por las
 * colas 0–49 con PNR del PCC de trabajo. `count`, y por cada cola `access`, hasta N `ignore` y
 * `exit`; al final, otro `count` para comparar. Usa solo las actions de
 * `queue-census/actions.ts`, que no tienen escrituras.
 *
 * - Cada llamada queda en el historial y en la barra de actividad, como en la mesa.
 * - Parar sale de la cola en curso con `exit` y deja lo leído con `ended: "limit"`. Las colas
 *   que faltaban quedan sin recorrer.
 * - Producción: el desbloqueo de la página y una confirmación con el resumen, después del
 *   primer `count` (que es lo que dice cuántas colas hay).
 * - Una sola sesión: la del navegador (F4.1). Con ella abierta, cerrar la pestaña avisa.
 *
 * Al cambiar de entorno, la página se vuelve a montar y un recorrido en curso para.
 */
export function QueueCensus({ initialPcc = "" }: { initialPcc?: string }) {
  const { environment } = useEnvironment()
  return <Census key={environment.id} initialPcc={initialPcc} />
}

type CensusAction = (
  environment: ConsoleEnvironmentId,
  input: unknown
) => Promise<StepRun>

/** Lo que falta para el recorrido de producción, mientras se espera la confirmación. */
interface PendingWalk {
  pcc: string
  perQueue: number
  queues: number[]
}

function Census({ initialPcc }: { initialPcc: string }) {
  const { environment } = useEnvironment()
  const { record } = useHistory()
  const { status, error, refresh } = useSessionStatus()
  // El censo vive en el layout (F10.5): la mesa le suma PNR con "Al censo".
  const { census, dispatch } = useCensus()
  const [perQueueText, setPerQueueText] = useState(String(census.perQueue))
  const [unlocked, setUnlocked] = useState(false)
  const [since] = useState(() => new Date().toISOString())
  /** Se apretó parar, o la página se desmontó: el recorrido lo mira entre llamada y llamada. */
  const stop = useRef(false)
  const pending = useRef<PendingWalk | undefined>(undefined)

  const open = status?.open === true
  const sessionPcc = status?.open ? status.pcc : ""
  const queueState = status?.open ? status.queueState : undefined
  const running = isRunning(census)
  const perQueue = parsePerQueue(perQueueText)
  const pcc = shownPcc(census.pcc, sessionPcc)
  /** El alias del PCC en la exportación. El resumen y la exportación salen del mismo JSON. */
  const [alias, setAlias] = useState("P1")
  const doc = buildCensusExport(census, alias.trim().toUpperCase())
  const read = census.queues.reduce((sum, queue) => sum + queue.items.length, 0)

  // `/queue-census/<PCC de la sesión>` es el PCC de la sesión: se normaliza a vacío.
  // Es el mismo PCC, así que no se borra nada.
  useEffect(() => {
    if (sessionPcc !== "" && census.pcc === sessionPcc && !running) {
      dispatch({ type: "samePcc" })
      window.history.replaceState(null, "", "/queue-census")
    }
  }, [sessionPcc, census.pcc, running, dispatch])

  // `/queue-census/<PCC>`: ese PCC de trabajo, salvo que ya haya un censo con datos (de la mesa
  // o de un recorrido anterior), que no se borra por abrir la página. Solo al montar.
  const initial = useRef(initialPcc)
  useEffect(() => {
    const pcc = initial.current
    initial.current = ""
    if (pcc !== "" && census.takenAt === undefined && pcc !== census.pcc) {
      dispatch({ type: "pcc", pcc })
    }
  }, [census.takenAt, census.pcc, dispatch])

  // Al desmontar (otro entorno, otra página), el recorrido en curso para en la siguiente llamada:
  // sale de la cola, cuenta de nuevo y queda como parado en el censo del layout.
  const stopOnLeave = useRef(dispatch)
  stopOnLeave.current = dispatch
  useEffect(() => {
    return () => {
      stop.current = true
      stopOnLeave.current({ type: "stop" })
    }
  }, [])

  // Con la sesión abierta o el censo en curso, cerrar la pestaña avisa: la sesión queda viva en
  // Sabre y cuenta para el límite de 50 por PCC.
  useEffect(() => {
    if (!open && !running) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = true
    }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [open, running])

  /** Una llamada del recorrido: al historial y a pedir el estado de la sesión. */
  const call = async (method: string, action: CensusAction, input: unknown) => {
    const at = new Date().toISOString()
    const run = await action(environment.id, input)
    record({ method, at, input, run })
    void refresh()
    return run
  }

  const now = () => new Date().toISOString()

  /** Después de un fallo dentro de una cola: dejar la sesión afuera, o cortar el censo. */
  const recover = async (queue: number, closed: boolean) => {
    if (closed) {
      dispatch({ type: "fail", failure: "La sesión se cerró.", at: now() })
      return false
    }
    const current = await sessionStatus(environment.id)
    if ("error" in current || !current.open) {
      dispatch({ type: "fail", failure: "La sesión se cerró.", at: now() })
      return false
    }
    if (current.queueState === "outside") return true
    const exit = await call("queue.exit", censusExit, {})
    const failure = failureOf(exit)
    if (failure === undefined) return true
    dispatch({
      type: "fail",
      failure: `queue.exit falló después de un error en la cola ${queue}: ${failure}`,
      at: now(),
    })
    return false
  }

  /**
   * Los rasgos de la reserva de un PNR ya leído (F10.2). No mueve el cursor de la cola, y un
   * fallo no corta el censo: el PNR queda con `booking: null` y el código del error. En fake no
   * hay REST, así que ni se llama.
   */
  const readBooking = async (
    queue: number,
    position: number,
    pnr: string,
    pcc: string
  ) => {
    if (environment.id === "fake") {
      dispatch({
        type: "booking",
        queue,
        position,
        booking: null,
        error: FAKE_REST_REASON,
      })
      return
    }
    const run = await call("booking.get", censusBooking, { pnr, pcc })
    const read = bookingOf(run)
    dispatch({
      type: "booking",
      queue,
      position,
      booking: read.booking,
      error: read.booking === null ? read.error : undefined,
    })
  }

  /** Una cola: `access`, hasta N PNR con `ignore` (y su reserva), y `exit` si no llegó al fin. */
  const walkQueue = async (queue: number, pcc: string, limit: number) => {
    dispatch({ type: "enter", queue })
    let run = await call("queue.access", censusAccess, {
      queue: String(queue),
      pcc,
    })
    let read = 0
    while (true) {
      const step = censusReadOf(run)
      if (step.kind === "failed") {
        dispatch({
          type: "ended",
          queue,
          ended: "error",
          failure: step.failure,
        })
        return recover(queue, step.closed)
      }
      if (step.kind === "end") {
        // Fin de cola: el SDK ya dejó la sesión afuera.
        dispatch({ type: "ended", queue, ended: step.reason })
        return true
      }
      dispatch({ type: "item", queue, item: step.item })
      read += 1
      await readBooking(queue, read, step.item.pnr, pcc)
      if (read >= limit || stop.current) {
        const exit = await call("queue.exit", censusExit, {})
        dispatch({ type: "ended", queue, ended: "limit" })
        const failure = failureOf(exit)
        if (failure === undefined) return true
        dispatch({
          type: "fail",
          failure: `queue.exit falló en la cola ${queue}: ${failure}`,
          at: now(),
        })
        return false
      }
      run = await call("queue.ignore", censusIgnore, { pcc })
    }
  }

  /** El recorrido y el `count` de después. */
  const walk = async ({ pcc, perQueue, queues }: PendingWalk) => {
    dispatch({ type: "walk" })
    for (const queue of queues) {
      if (stop.current) break
      if (!(await walkQueue(queue, pcc, perQueue))) return
    }
    dispatch({ type: "recount" })
    const after = await call("queue.count", censusCount, { pcc })
    const count = censusCountOf(after)
    if (count !== undefined) {
      dispatch({ type: "counted", when: "after", count })
    }
    dispatch({
      type: "finish",
      at: now(),
      recountFailure:
        count === undefined ? (failureOf(after) ?? "sin conteo") : undefined,
    })
  }

  const start = async () => {
    if (perQueue === undefined) return
    stop.current = false
    const pcc = census.pcc
    dispatch({
      type: "start",
      environment: environment.id,
      pcc,
      perQueue,
      at: now(),
    })
    dispatch({ type: "takenAt", at: await censusClock() })
    const before = await call("queue.count", censusCount, { pcc })
    const count = censusCountOf(before)
    if (count === undefined) {
      dispatch({
        type: "fail",
        failure: `queue.count falló: ${failureOf(before) ?? "sin conteo"}`,
        at: now(),
      })
      return
    }
    dispatch({ type: "counted", when: "before", count })
    const next: PendingWalk = {
      pcc,
      perQueue,
      queues: count.rows.filter(inCensusRange).map((row) => Number(row.queue)),
    }
    if (environment.readOnly && !stop.current) {
      pending.current = next
      dispatch({ type: "confirm" })
      return
    }
    await walk(next)
  }

  const confirm = () => {
    const next = pending.current
    pending.current = undefined
    if (next !== undefined) void walk(next)
  }

  const cancel = () => {
    pending.current = undefined
    dispatch({ type: "cancel" })
  }

  const halt = () => {
    if (census.phase === "confirming") {
      cancel()
      return
    }
    stop.current = true
    dispatch({ type: "stop" })
  }

  const changePcc = (next: string) => {
    dispatch({ type: "pcc", pcc: next })
    window.history.replaceState(
      null,
      "",
      next === "" ? "/queue-census" : `/queue-census/${next}`
    )
  }

  const startReason = !open
    ? "Abre una sesión primero."
    : queueState !== "outside"
      ? "La sesión está dentro de una cola o en unknown: primero queue.exit (desde la mesa o el flujo 6)."
      : perQueue === undefined
        ? `N tiene que ser de 1 a ${MAX_PER_QUEUE}.`
        : environment.readOnly && !unlocked
          ? "En producción, primero el desbloqueo de abajo."
          : undefined

  return (
    <div data-slot="queue-census" className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">Censo de colas</h1>
        <p className="text-muted-foreground text-sm">
          Recorre en solo lectura las colas {CENSUS_RANGE[0]}–{CENSUS_RANGE[1]}{" "}
          con PNR del PCC de trabajo: <code>count</code>, y por cada cola{" "}
          <code>access</code>, hasta N <code>ignore</code> y <code>exit</code>.
          Nunca <code>place</code>, <code>remove</code> ni <code>process</code>.
          ADR-026 (<code>censo-de-colas</code>).
        </p>
      </header>
      <div className="overflow-hidden rounded-lg border">
        <DeskSessionBar
          status={status}
          error={error}
          onDone={() => void refresh()}
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Recorrido</CardTitle>
            <CardDescription>
              Una sola sesión, la de arriba. Las colas cambian solas durante el
              día (Q-088): el censo es una foto.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <DeskPcc
              key={census.pcc}
              pcc={census.pcc}
              sessionPcc={sessionPcc}
              disabled={running}
              onChange={changePcc}
            />
            <Field>
              <FieldLabel htmlFor="census-per-queue">
                PNR por cola (N)
              </FieldLabel>
              <Input
                id="census-per-queue"
                inputMode="numeric"
                className="w-24 font-mono"
                disabled={running}
                aria-invalid={perQueue === undefined}
                value={perQueueText}
                onChange={(event) => setPerQueueText(event.target.value)}
              />
              <FieldDescription>
                {DEFAULT_PER_QUEUE} por defecto, {MAX_PER_QUEUE} como máximo.
                Las colas más largas se leen desde el principio (orden de
                llegada).
              </FieldDescription>
            </Field>
            {environment.readOnly && (
              <UnlockCard
                id="census-unlock"
                title="Censo en producción"
                label="Desbloquear el censo en esta página"
                unlocked={unlocked}
                onChange={setUnlocked}
              >
                Las colas de producción tienen PNR reales y los agentes de la
                agencia las trabajan al mismo tiempo: conviene correrlo en un
                horario de poco uso. El censo solo lee, y aun desbloqueado pide
                confirmación con el resumen antes de entrar a la primera cola.
                El desbloqueo se pierde al recargar.
              </UnlockCard>
            )}
            <div className="flex flex-wrap items-center gap-2">
              {running ? (
                <Button
                  variant="destructive"
                  disabled={census.stopped}
                  onClick={halt}
                >
                  <Square />
                  {census.stopped ? "Parando…" : "Parar"}
                </Button>
              ) : (
                <Button
                  disabled={startReason !== undefined}
                  onClick={() => void start()}
                >
                  <Play />
                  Iniciar censo
                </Button>
              )}
            </div>
            {!running && startReason !== undefined && (
              <p className="text-muted-foreground text-xs">{startReason}</p>
            )}
            {!running && read > 0 && (
              <p className="text-muted-foreground text-xs">
                Iniciar reemplaza el censo actual ({read} PNR
                {census.walked ? "" : ", agregados desde la mesa"}). Exporta
                antes si lo quieres conservar.
              </p>
            )}
          </CardContent>
        </Card>
        <Card className="min-w-0">
          <CardContent>
            <CensusProgress
              census={census}
              pcc={pcc}
              onFlag={(ref, flagged) =>
                dispatch({ type: "flag", ref, flagged })
              }
            />
          </CardContent>
        </Card>
      </div>
      {doc !== undefined && read > 0 && (
        <CensusSummaryView summary={summarizeCensus(doc)} pcc={census.pcc} />
      )}
      {doc !== undefined &&
        read > 0 &&
        (census.phase === "done" || census.phase === "failed") && (
          <CensusExport
            census={census}
            doc={doc}
            alias={alias}
            onAliasChange={setAlias}
            pccs={[sessionPcc, census.pcc]}
          />
        )}
      <div className="overflow-hidden rounded-lg border">
        <ActivityBar since={since} />
      </div>
      <AlertDialog
        open={census.phase === "confirming"}
        onOpenChange={(next) => {
          if (!next && census.phase === "confirming") cancel()
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Censo en producción</AlertDialogTitle>
            <AlertDialogDescription>
              {censusSummary(census, pcc)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={census.queues.length === 0}
              onClick={confirm}
            >
              Leer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

const PHASE_LABEL: Record<QueueCensusState["phase"], string> = {
  idle: "sin correr",
  counting: "contando",
  confirming: "esperando confirmación",
  walking: "recorriendo",
  recounting: "contando de nuevo",
  done: "terminado",
  failed: "cortado",
}

const ENDED_LABEL: Record<CensusEnded, string> = {
  "end-of-display": "fin de cola",
  empty: "vacía",
  limit: "límite",
  error: "error",
}

/** El avance del censo: por cola, lo leído contra lo previsto, y el conteo de antes y después. */
function CensusProgress({
  census,
  pcc,
  onFlag,
}: {
  census: QueueCensusState
  pcc: string
  /** Marcar un PNR para el anexo de la exportación (F10.3). */
  onFlag: (ref: string, flagged: boolean) => void
}) {
  const planned = census.queues.reduce(
    (sum, queue) => sum + plannedOf(queue, census.perQueue),
    0
  )
  const read = census.queues.reduce((sum, queue) => sum + queue.items.length, 0)
  const walked = census.queues.filter((queue) => queue.ended !== undefined)
  const finished = census.phase === "done" || census.phase === "failed"
  const [selected, setSelected] = useState<CensusItem>()
  // El PNR elegido, con lo último que se sabe (la reserva llega después del párrafo).
  const shown =
    selected === undefined
      ? undefined
      : census.queues
          .flatMap((queue) => queue.items)
          .find((item) => item.ref === selected.ref)

  if (census.phase === "idle" && census.before === undefined) {
    return (
      <p className="text-muted-foreground text-sm">
        {census.failure ??
          "Sin censo todavía. Con la sesión abierta y afuera de las colas, Iniciar censo corre queue.count y recorre las colas con PNR."}
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant={
            census.phase === "failed"
              ? "destructive"
              : finished
                ? "secondary"
                : "default"
          }
        >
          {PHASE_LABEL[census.phase]}
        </Badge>
        {census.stopped && <Badge variant="outline">parado</Badge>}
        <span className="font-mono">{pcc || "PCC de la sesión"}</span>
        <span className="text-muted-foreground">
          {walked.length} de {census.queues.length} colas · {read} de {planned}{" "}
          PNR · N = {census.perQueue}
        </span>
        {census.current !== undefined && (
          <Badge variant="outline">en la cola {census.current}</Badge>
        )}
      </div>
      <Progress
        value={planned === 0 ? (finished ? 100 : 0) : (read / planned) * 100}
        aria-label="PNR leídos del censo"
      />
      {census.failure !== undefined && (
        <p className="text-destructive break-words">{census.failure}</p>
      )}
      {census.queues.length === 0 && census.before !== undefined ? (
        <p className="text-muted-foreground">
          Ninguna cola del rango {CENSUS_RANGE[0]}–{CENSUS_RANGE[1]} con PNR.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14">Cola</TableHead>
              <TableHead className="w-20 text-end">Conteo</TableHead>
              <TableHead className="w-40">Leídos</TableHead>
              <TableHead className="w-28">Fin</TableHead>
              <TableHead>PNR (PIC)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {census.queues.map((queue) => (
              <QueueRow
                key={queue.queue}
                queue={queue}
                perQueue={census.perQueue}
                current={census.current === queue.queue}
                finished={finished}
                walked={census.walked}
                onSelect={setSelected}
              />
            ))}
          </TableBody>
        </Table>
      )}
      {census.named.length > 0 && (
        <p className="text-muted-foreground text-xs">
          Colas que no se recorren, la S (mensajes) y las con nombre (Q-086):{" "}
          {census.named.map((row) => `${row.queue} (${row.count})`).join(", ")}.
        </p>
      )}
      <CountComparison census={census} />
      <Sheet
        modal={false}
        open={shown !== undefined}
        onOpenChange={(open) => {
          if (!open) setSelected(undefined)
        }}
      >
        <SheetContent showOverlay={false} className="w-full gap-0 sm:max-w-xl">
          {shown !== undefined && (
            <>
              <SheetHeader className="border-b">
                <SheetTitle className="font-mono">
                  {shown.ref} · {shown.pnr}
                </SheetTitle>
                <SheetDescription>
                  Los rasgos que llegan al navegador (ADR-026). El párrafo y la
                  reserva se quedan en el servidor.
                </SheetDescription>
              </SheetHeader>
              <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
                <Link
                  href={bookingHref(shown.pnr, census.pcc)}
                  target="_blank"
                  rel="noopener"
                  className={buttonVariants({
                    variant: "outline",
                    size: "sm",
                    className: "self-start",
                  })}
                >
                  <ExternalLink />
                  Abrir la reserva en /booking
                </Link>
                <Field orientation="horizontal">
                  <Checkbox
                    id="census-flag"
                    checked={shown.flagged === true}
                    onCheckedChange={(checked) =>
                      onFlag(shown.ref, checked === true)
                    }
                  />
                  <FieldLabel htmlFor="census-flag" className="font-normal">
                    Marcar para el anexo: el párrafo enmascarado (regla de #96)
                    entra a la exportación
                  </FieldLabel>
                </Field>
                <JsonTree value={shown} filename={`censo-${shown.ref}.json`} />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

/** Un PNR leído: localizador, PIC y si ya tiene los rasgos de la reserva. */
function ItemBadge({
  item,
  onSelect,
}: {
  item: CensusItem
  onSelect: () => void
}) {
  const pics = item.pics.map((pic) => String(pic.code).padStart(3, "0"))
  const booking =
    item.booking === undefined
      ? "reserva pendiente"
      : item.booking === null
        ? `sin reserva: ${item.bookingError ?? "falló"}`
        : "con los rasgos de la reserva"
  const title = [
    item.ref,
    item.parseOk ? undefined : "el parser no leyó el párrafo",
    ...item.pics.map((pic) => `${pic.code} ${pic.text ?? "(texto no válido)"}`),
    booking,
  ]
    .filter(Boolean)
    .join(" · ")
  return (
    <button type="button" onClick={onSelect} title={title}>
      <Badge variant="outline" className="hover:bg-muted font-mono">
        {item.pnr}
        {pics.length > 0 && (
          <span className="text-muted-foreground">{pics.join(",")}</span>
        )}
        {!item.parseOk && <span className="text-destructive">!</span>}
        {item.booking === null && (
          <span className="text-muted-foreground">·R?</span>
        )}
        {item.booking !== undefined && item.booking !== null && (
          <span className="text-emerald-600">·R</span>
        )}
        {item.flagged === true && <span className="text-amber-600">·A</span>}
      </Badge>
    </button>
  )
}

function QueueRow({
  queue,
  perQueue,
  current,
  finished,
  walked,
  onSelect,
}: {
  queue: CensusQueue
  perQueue: number
  current: boolean
  finished: boolean
  /** Si hubo recorrido: sin él, las colas vienen de "Al censo" en la mesa. */
  walked: boolean
  onSelect: (item: CensusItem) => void
}) {
  const planned = plannedOf(queue, perQueue)
  return (
    <TableRow data-state={current ? "selected" : undefined}>
      <TableCell className="font-mono">{queue.queue}</TableCell>
      <TableCell className="text-end tabular-nums">{queue.count}</TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Progress
            className="w-16"
            value={planned === 0 ? 0 : (queue.items.length / planned) * 100}
            aria-label={`PNR leídos de la cola ${queue.queue}`}
          />
          <span className="tabular-nums">
            {queue.items.length}/{planned}
          </span>
        </div>
      </TableCell>
      <TableCell>
        {queue.ended !== undefined ? (
          <Badge
            variant={queue.ended === "error" ? "destructive" : "secondary"}
            title={queue.failure}
          >
            {ENDED_LABEL[queue.ended]}
          </Badge>
        ) : current ? (
          <Badge>leyendo</Badge>
        ) : (
          <span className="text-muted-foreground text-xs">
            {!finished
              ? "pendiente"
              : walked
                ? "sin recorrer"
                : "desde la mesa"}
          </span>
        )}
      </TableCell>
      <TableCell className="whitespace-normal">
        <div className="flex flex-wrap gap-1">
          {queue.items.map((item) => (
            <ItemBadge
              key={item.ref}
              item={item}
              onSelect={() => onSelect(item)}
            />
          ))}
        </div>
      </TableCell>
    </TableRow>
  )
}

/** El `count` de después contra el de antes: un censo de solo lectura no los cambia. */
function CountComparison({ census }: { census: QueueCensusState }) {
  const { before, after } = census
  if (census.recountFailure !== undefined) {
    return (
      <p className="text-destructive text-xs">
        El queue.count de después falló: {census.recountFailure}
      </p>
    )
  }
  if (before === undefined || after === undefined) return null
  const changes = countChanges(before, after)
  if (changes.length === 0) {
    return (
      <p className="text-muted-foreground text-xs">
        El conteo de después coincide con el de antes en todas las colas.
      </p>
    )
  }
  return (
    <div className="text-xs">
      <p className="font-medium">
        El conteo cambió durante el censo. El censo no escribe: lo más probable
        es que otro agente o una regla de la agencia movieran PNR (Q-088).
      </p>
      <ul className="text-muted-foreground font-mono">
        {changes.map((change) => (
          <li key={change.queue}>
            {change.queue}: {change.before} → {change.after}
          </li>
        ))}
      </ul>
    </div>
  )
}
