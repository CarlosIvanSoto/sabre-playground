"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { LockOpen } from "lucide-react"
import { type ReactNode, useEffect, useReducer, useState } from "react"
import {
  Controller,
  type UseFormRegisterReturn,
  useForm,
  useWatch,
} from "react-hook-form"
import {
  fakeQueues,
  queueAccess,
  queueActivity,
  queueCount,
  queueExit,
  queueIgnore,
  queueList,
  queuePlace,
  queueProcess,
  queueRemove,
  resetFakeQueues,
} from "@/app/(console)/queues/actions"
import { useEnvironment } from "@/components/environment/environment-provider"
import {
  QueueActivityView,
  QueueCountView,
  QueueStepView,
} from "@/components/queues/queue-views"
import { SelectionField } from "@/components/queues/selection-field"
import { SessionBar } from "@/components/session/session-bar"
import { CloseStep, OpenStep } from "@/components/session/session-flow"
import { useSessionStatus } from "@/components/session/use-session-status"
import { StepPanel } from "@/components/step/step-panel"
import { useStep } from "@/components/step/use-step"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
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
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  disabledReason,
  initialQueueJourney,
  type QueueJourney,
  type QueuePanel,
  queueJourneyReducer,
  type SessionPlace,
  stepsFor,
} from "@/lib/queue-journey"
import {
  DEFAULT_INSTRUCTION_CODE,
  PROCESS_ACTIONS,
  type QueueAccessInput,
  type QueueAccessOutput,
  type QueueActivityInput,
  type QueueActivityOutput,
  type QueueCountInput,
  type QueueCountOutput,
  type QueueListInput,
  type QueueListOutput,
  type QueuePlaceInput,
  type QueuePlaceOutput,
  type QueueProcessInput,
  type QueueProcessOutput,
  type QueueRemoveInput,
  type QueueRemoveOutput,
  queueAccessSchema,
  queueActivitySchema,
  queueCountSchema,
  queueListSchema,
  queuePlaceSchema,
  queueProcessSchema,
  queueRemoveSchema,
} from "@/lib/queues"
import type { StepRun } from "@/lib/step/types"

/**
 * Flujo 6: colas, dentro de la sesión registrada del navegador. count (y activity) → list → access →
 * ignore / remove / place → exit, y el recorrido con `process`.
 *
 * Como el flujo 2, lo que un paso le pasa al siguiente vive en un reducer en memoria del
 * navegador (`queue-journey`): la cola que se elige en `count` llena los pasos siguientes, y
 * cuando el cursor se mueve, los paneles que mostraban otro PNR se vacían. Qué paso se puede
 * correr sale de `session.queue.state`, que la barra muestra siempre.
 *
 * La ruta `/queues/<PCC>/<cola>` es el punto de entrada: al elegir una cola, la URL cambia con
 * `history.replaceState`, sin volver a montar la página.
 *
 * `remove`, `place` y `process` con esas acciones piden confirmación en cada corrida. En
 * producción, además, solo con el desbloqueo de la página, que se pierde al recargar; la
 * server action lo vuelve a comprobar.
 */
export function QueuesFlow({
  initialPcc = "",
  initialQueue = "",
}: {
  initialPcc?: string
  initialQueue?: string
}) {
  const { environment } = useEnvironment()
  const { status, error, refresh } = useSessionStatus()
  const [journey, dispatch] = useReducer(
    queueJourneyReducer,
    initialQueueJourney(initialPcc, initialQueue)
  )
  const [unlocked, setUnlocked] = useState(false)

  const open = status?.open === true
  const place: SessionPlace = status?.open ? status.queueState : "closed"
  const allowed = stepsFor(place)
  const sessionPcc = status?.open ? status.pcc : ""
  const writable = !environment.readOnly || unlocked

  // Una sesión cerrada o vencida no tiene cursor.
  useEffect(() => {
    if (status !== undefined && !status.open) dispatch({ type: "sessionGone" })
  }, [status])

  /** Elegir una cola: actualiza el recorrido y la URL, sin navegar. */
  const choose = (queue: string, pcc: string, from?: QueuePanel) => {
    dispatch({ type: "select", pcc, queue, from })
    const routePcc = pcc.trim().toUpperCase() || sessionPcc
    if (routePcc !== "" && queue.trim() !== "") {
      window.history.replaceState(
        null,
        "",
        `/queues/${routePcc}/${queue.trim().toUpperCase()}`
      )
    }
  }

  const props = (panel: QueuePanel): PanelProps => ({
    disabledReason: allowed.has(panel)
      ? undefined
      : disabledReason(place, panel),
    journey,
    onDone: (run: StepRun) => {
      dispatch({ type: "moved", panel, run })
      void refresh()
    },
    choose: (queue, pcc) => choose(queue, pcc, panel),
  })
  const write = { writable, unlock: unlocked }
  const g = journey.generation

  return (
    <>
      <SessionBar status={status} error={error}>
        {open && <QueueCursor journey={journey} />}
      </SessionBar>
      {environment.id === "fake" && <FakeQueuesStep open={open} />}
      <OpenStep open={open} onDone={() => void refresh()} />
      {environment.readOnly && (
        <UnlockCard unlocked={unlocked} onChange={setUnlocked} />
      )}
      <CountStep
        key={`count-${g.count}`}
        {...props("count")}
        onChoose={(queue) => choose(queue, journey.pcc)}
      />
      <ActivityStep key={`activity-${g.activity}`} {...props("activity")} />
      <ListStep key={`list-${g.list}`} {...props("list")} />
      <AccessStep key={`access-${g.access}`} {...props("access")} />
      <IgnoreStep key={`ignore-${g.ignore}`} {...props("ignore")} />
      <RemoveStep key={`remove-${g.remove}`} {...props("remove")} {...write} />
      <PlaceStep
        key={`place-${g.place}`}
        {...props("place")}
        {...write}
        inside={place === "inside"}
      />
      <ExitStep key={`exit-${g.exit}`} {...props("exit")} />
      <ProcessStep
        key={`process-${g.process}`}
        {...props("process")}
        {...write}
      />
      <CloseStep open={open} onDone={() => void refresh()} />
    </>
  )
}

/**
 * Solo en fake: qué hay en las colas de `createQueueFake` y volver a armarlas desde
 * `queueFixtures` después de un `remove` o un `place`.
 */
function FakeQueuesStep({ open }: { open: boolean }) {
  const view = useStep("fake.locators", fakeQueues)
  const reset = useStep("fake.reset", resetFakeQueues)
  const latest = reset.run ?? view.run
  return (
    <StepPanel
      title="Colas del fake"
      description={
        <>
          Sin red ni credenciales: <code>createQueueFake</code> de{" "}
          <code>sabre-client/testing</code>, sembrado con{" "}
          <code>queueFixtures</code> (respuestas anonimizadas de producción). La
          cola 9 tiene los 4 PNR de <code>walk</code>, la 50 está vacía y{" "}
          <code>AAAAAE</code> y <code>AAAAAF</code> quedan fuera de las colas,
          para <code>place</code>. En <code>queue.activity</code>, la 9 trae 27
          ignorados sembrados; las acciones del fake no cambian los contadores.
        </>
      }
      run={latest}
      pending={view.pending || reset.pending}
      form={
        <div className="flex flex-col gap-2">
          <Button
            variant="outline"
            disabled={view.pending}
            onClick={() => view.execute({})}
          >
            Ver colas del fake
          </Button>
          <Button
            variant="outline"
            disabled={reset.pending || open}
            onClick={() => reset.execute({})}
          >
            Reiniciar el fake
          </Button>
          {open && (
            <FieldDescription>
              Para reiniciar, primero cierra la sesión.
            </FieldDescription>
          )}
        </div>
      }
    />
  )
}

interface PanelProps {
  /** Por qué el paso no se puede correr ahora; `undefined` si se puede. */
  disabledReason?: string
  journey: QueueJourney
  onDone: (run: StepRun) => void
  /** El formulario se corrió con otra cola: pasa a ser la elegida. */
  choose: (queue: string, pcc: string) => void
}

interface WriteProps {
  /** CERT o fake, o producción desbloqueada. */
  writable: boolean
  /** Lo que se manda a la action: solo cuenta en producción. */
  unlock: boolean
}

/** La cola elegida y el PNR en el que está el cursor, en la barra de sesión. */
function QueueCursor({ journey }: { journey: QueueJourney }) {
  return (
    <div className="flex w-full flex-wrap items-center gap-2 border-t pt-2">
      <span className="text-muted-foreground">Cola</span>
      <Badge variant="outline" className="font-mono">
        {journey.queue || "—"}
        {journey.pcc && ` · ${journey.pcc}`}
      </Badge>
      <span className="text-muted-foreground">PNR actual</span>
      <Badge
        variant={journey.current ? "default" : "outline"}
        className="font-mono"
      >
        {journey.current ?? "—"}
      </Badge>
      <span className="text-muted-foreground">vistos</span>
      <Badge variant="outline" className="tabular-nums">
        {journey.visited}
      </Badge>
      {journey.ended !== undefined && (
        <Badge variant="secondary">
          fin de cola: <code>{journey.ended.reason}</code>
        </Badge>
      )}
    </div>
  )
}

/** El motivo de un paso deshabilitado, o el bloqueo de producción para una escritura. */
function Blocked({ reason, locked }: { reason?: string; locked?: boolean }) {
  if (reason !== undefined) return <FieldDescription>{reason}</FieldDescription>
  if (locked) {
    return (
      <FieldDescription>
        En producción, primero el desbloqueo de arriba.
      </FieldDescription>
    )
  }
  return null
}

/**
 * Producción: `remove` y `place` necesitan este desbloqueo explícito. El censo de colas
 * (`/queue-census`) usa el mismo, con su propio texto, aunque solo lea (ADR-026).
 */
export function UnlockCard({
  unlocked,
  onChange,
  id = "queues-unlock",
  title = "Escrituras en producción",
  label = "Desbloquear remove y place en esta página",
  children,
}: {
  unlocked: boolean
  onChange: (value: boolean) => void
  id?: string
  title?: string
  label?: string
  /** El texto del aviso. Por defecto, el de las escrituras del flujo 6. */
  children?: ReactNode
}) {
  return (
    <Alert variant={unlocked ? "destructive" : "default"}>
      <LockOpen />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="flex flex-col gap-3">
        <span>
          {children ?? (
            <>
              Las colas de producción tienen PNR reales. <code>remove</code> y{" "}
              <code>place</code> se prueban solo con un PNR designado y una cola
              vacía (plan-tier-3), y aun desbloqueados piden confirmación en
              cada corrida. El desbloqueo se pierde al recargar.
            </>
          )}
        </span>
        <Field orientation="horizontal">
          <Checkbox
            id={id}
            checked={unlocked}
            onCheckedChange={(checked) => onChange(checked === true)}
          />
          <FieldLabel htmlFor={id}>{label}</FieldLabel>
        </Field>
      </AlertDescription>
    </Alert>
  )
}

/** El campo de PCC opcional, común a varios pasos. */
function PccField({
  id,
  error,
  registration,
}: {
  id: string
  error?: { message?: string }
  registration: UseFormRegisterReturn
}) {
  return (
    <Field data-invalid={error !== undefined}>
      <FieldLabel htmlFor={id}>PCC (opcional)</FieldLabel>
      <Input
        id={id}
        className="font-mono uppercase"
        aria-invalid={error !== undefined}
        {...registration}
      />
      <FieldDescription>Vacío: el de la sesión.</FieldDescription>
      <FieldError errors={[error]} />
    </Field>
  )
}

function QueueField({
  id,
  label = "Cola",
  error,
  registration,
  description,
}: {
  id: string
  label?: string
  error?: { message?: string }
  registration: UseFormRegisterReturn
  description?: ReactNode
}) {
  return (
    <Field data-invalid={error !== undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        className="font-mono uppercase"
        aria-invalid={error !== undefined}
        {...registration}
      />
      <FieldDescription>
        {description ?? (
          <>
            Número de 0 a 511, o el nombre de una cola alfabética (
            <code>S</code>). Por defecto, la elegida en <code>count</code>.
          </>
        )}
      </FieldDescription>
      <FieldError errors={[error]} />
    </Field>
  )
}

/**
 * `range` de `count` y `activity` (F14.1): desde y hasta, como texto. La consola no los valida:
 * un extremo vacío, `start >= end` o una cola junto con el rango los rechaza el SDK.
 */
function RangeFields({
  id,
  start,
  end,
}: {
  id: string
  start: UseFormRegisterReturn
  end: UseFormRegisterReturn
}) {
  return (
    <Field>
      <FieldLabel htmlFor={`${id}-start`}>Rango (opcional)</FieldLabel>
      <div className="flex items-center gap-2">
        <Input
          id={`${id}-start`}
          aria-label="Desde"
          placeholder="1"
          inputMode="numeric"
          className="w-20 font-mono"
          {...start}
        />
        <span className="text-muted-foreground">–</span>
        <Input
          id={`${id}-end`}
          aria-label="Hasta"
          placeholder="25"
          inputMode="numeric"
          className="w-20 font-mono"
          {...end}
        />
      </div>
      <FieldDescription>
        Colas numéricas, vacías incluidas. El SDK valida los extremos.
      </FieldDescription>
    </Field>
  )
}

function CountStep({
  disabledReason,
  journey,
  onDone,
  onChoose,
}: PanelProps & { onChoose: (queue: string) => void }) {
  const { run, pending, execute } = useStep("queue.count", queueCount)
  const form = useForm<QueueCountInput, unknown, QueueCountOutput>({
    resolver: zodResolver(queueCountSchema),
    defaultValues: {
      pcc: journey.pcc,
      queue: "",
      range: { start: "", end: "" },
      selection: [],
    },
  })
  const errors = form.formState.errors
  return (
    <StepPanel
      title="queue.count"
      description={
        <>
          <code>QueueCountLLSRQ</code>: las colas con algo, más los totales. No
          cambia <code>state</code>. Dentro de una cola no cuenta el PNR
          abierto. <code>countedAt</code> va sin año y en hora del host. Elegir
          una cola llena los pasos siguientes. Con <code>queue</code>, solo esa;
          con <code>range</code>, cada cola del rango, también las vacías.
          <code>selection</code> necesita <code>queue</code>, y entonces{" "}
          <code>totals.unfiltered</code> trae el total sin filtrar.
        </>
      }
      run={run}
      pending={pending}
      resultView={(result) => (
        <QueueCountView
          result={result}
          chosen={journey.queue}
          onChoose={onChoose}
        />
      )}
      form={
        <form
          onSubmit={form.handleSubmit(() => execute(form.getValues(), onDone))}
          className="flex flex-col gap-4"
        >
          <PccField
            id="count-pcc"
            error={errors.pcc}
            registration={form.register("pcc")}
          />
          <QueueField
            id="count-queue"
            label="Cola (opcional)"
            error={errors.queue}
            registration={form.register("queue")}
            description="Vacía: todas las del PCC. No se combina con el rango."
          />
          <RangeFields
            id="count-range"
            start={form.register("range.start")}
            end={form.register("range.end")}
          />
          <Controller
            control={form.control}
            name="selection"
            render={({ field }) => (
              <SelectionField
                id="count-selection"
                value={field.value ?? []}
                onChange={field.onChange}
                note={
                  <>
                    Necesita una cola: sin ella, o con rango, el SDK lanza{" "}
                    <code>TypeError</code> sin request.
                  </>
                }
              />
            )}
          />
          <Blocked reason={disabledReason} />
          <Button
            type="submit"
            disabled={pending || disabledReason !== undefined}
          >
            Contar
          </Button>
        </form>
      }
    />
  )
}

/** `QueueAnalysisLLSRQ` (F12.2): solo lectura, no mueve el cursor ni cambia `state`. */
function ActivityStep({ disabledReason, journey }: PanelProps) {
  const { run, pending, execute } = useStep("queue.activity", queueActivity)
  const form = useForm<QueueActivityInput, unknown, QueueActivityOutput>({
    resolver: zodResolver(queueActivitySchema),
    defaultValues: {
      pcc: journey.pcc,
      queue: "",
      range: { start: "", end: "" },
    },
  })
  const errors = form.formState.errors
  return (
    <StepPanel
      title="queue.activity"
      description={
        <>
          <code>QueueAnalysisLLSRQ</code> (el <code>QA</code> del host): los
          ocho contadores de actividad de cada cola, más los totales. Lista
          también las colas vacías con algún contador. <code>numMessages</code>{" "}
          es el mismo número que el <code>count</code> de la cola. No cambia{" "}
          <code>state</code>, y no se sabe desde cuándo cuentan (Q-097). Con{" "}
          <code>queue</code> o <code>range</code>, Sabre no lista lo de fuera, y
          con <code>queue</code> no manda <code>totals</code>.
        </>
      }
      run={run}
      pending={pending}
      resultView={(result) => <QueueActivityView result={result} />}
      form={
        <form
          onSubmit={form.handleSubmit(() => execute(form.getValues()))}
          className="flex flex-col gap-4"
        >
          <PccField
            id="activity-pcc"
            error={errors.pcc}
            registration={form.register("pcc")}
          />
          <QueueField
            id="activity-queue"
            label="Cola (opcional)"
            error={errors.queue}
            registration={form.register("queue")}
            description="Vacía: todas las del PCC. No se combina con el rango."
          />
          <RangeFields
            id="activity-range"
            start={form.register("range.start")}
            end={form.register("range.end")}
          />
          <Blocked reason={disabledReason} />
          <Button
            type="submit"
            disabled={pending || disabledReason !== undefined}
          >
            Ver actividad
          </Button>
        </form>
      }
    />
  )
}

function ListStep({ disabledReason, journey, onDone, choose }: PanelProps) {
  const { run, pending, execute } = useStep("queue.list", queueList)
  const form = useForm<QueueListInput, unknown, QueueListOutput>({
    resolver: zodResolver(queueListSchema),
    defaultValues: {
      queue: journey.queue,
      pcc: journey.pcc,
      primaryPassenger: false,
      selection: [],
    },
  })
  const errors = form.formState.errors
  return (
    <StepPanel
      title="queue.list"
      description={
        <>
          Los localizadores de una cola, sin entrar. No cambia{" "}
          <code>state</code>. Su <code>placedAt</code> es la colocación en la
          cola, la fecha por la que filtra <code>QD</code>; no es el de{" "}
          <code>access</code>.
        </>
      }
      run={run}
      pending={pending}
      form={
        <form
          onSubmit={form.handleSubmit(() => {
            const input = form.getValues()
            choose(input.queue, input.pcc)
            execute(input, onDone)
          })}
          className="flex flex-col gap-4"
        >
          <QueueField
            id="list-queue"
            error={errors.queue}
            registration={form.register("queue")}
          />
          <PccField
            id="list-pcc"
            error={errors.pcc}
            registration={form.register("pcc")}
          />
          <Controller
            control={form.control}
            name="primaryPassenger"
            render={({ field }) => (
              <Field orientation="horizontal">
                <Checkbox
                  id="list-primaryPassenger"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
                <FieldLabel htmlFor="list-primaryPassenger">
                  primaryPassenger
                </FieldLabel>
              </Field>
            )}
          />
          <Controller
            control={form.control}
            name="selection"
            render={({ field }) => (
              <SelectionField
                id="list-selection"
                value={field.value ?? []}
                onChange={field.onChange}
                codes={["QD", "AK"]}
                note={
                  <>
                    En <code>list</code>, Sabre solo acepta <code>QD</code> o{" "}
                    <code>AK</code>. El campo acepta cualquier código: con otro,
                    el SDK lanza <code>TypeError</code> sin request.
                  </>
                }
              />
            )}
          />
          <Blocked reason={disabledReason} />
          <Button
            type="submit"
            disabled={pending || disabledReason !== undefined}
          >
            Listar
          </Button>
        </form>
      }
    />
  )
}

function AccessStep({ disabledReason, journey, onDone, choose }: PanelProps) {
  const { run, pending, execute } = useStep("queue.access", queueAccess)
  const form = useForm<QueueAccessInput, unknown, QueueAccessOutput>({
    resolver: zodResolver(queueAccessSchema),
    defaultValues: { queue: journey.queue, pcc: journey.pcc, selection: [] },
  })
  const errors = form.formState.errors
  return (
    <StepPanel
      title="queue.access"
      description={
        <>
          Entra a la cola y trae el primer PNR (<code>inside</code>). Una cola
          vacía da <code>{"{ done: true, reason: 'empty' }"}</code> y la sesión
          sigue afuera. Con <code>selection</code>, solo los PNR que cumplen los
          filtros; sin ninguno que cumpla, también <code>done</code>.
        </>
      }
      run={run}
      pending={pending}
      resultView={(result) => <QueueStepView result={result} />}
      form={
        <form
          onSubmit={form.handleSubmit(() => {
            const input = form.getValues()
            choose(input.queue, input.pcc)
            execute(input, onDone)
          })}
          className="flex flex-col gap-4"
        >
          <QueueField
            id="access-queue"
            error={errors.queue}
            registration={form.register("queue")}
          />
          <PccField
            id="access-pcc"
            error={errors.pcc}
            registration={form.register("pcc")}
          />
          <Controller
            control={form.control}
            name="selection"
            render={({ field }) => (
              <SelectionField
                id="access-selection"
                value={field.value ?? []}
                onChange={field.onChange}
              />
            )}
          />
          <Blocked reason={disabledReason} />
          <Button
            type="submit"
            disabled={pending || disabledReason !== undefined}
          >
            Entrar
          </Button>
        </form>
      }
    />
  )
}

function IgnoreStep({ disabledReason, onDone }: PanelProps) {
  const { run, pending, execute } = useStep("queue.ignore", queueIgnore)
  return (
    <StepPanel
      title="queue.ignore"
      description={
        <>
          <code>I</code>: deja el PNR en la cola y pasa al siguiente. El último
          da el fin de cola (<code>end-of-display</code>).
        </>
      }
      run={run}
      pending={pending}
      resultView={(result) => <QueueStepView result={result} />}
      form={
        <div className="flex flex-col gap-4">
          <Blocked reason={disabledReason} />
          <Button
            className="w-full"
            disabled={pending || disabledReason !== undefined}
            onClick={() => execute({}, onDone)}
          >
            Siguiente (ignore)
          </Button>
        </div>
      }
    />
  )
}

function ExitStep({ disabledReason, onDone }: PanelProps) {
  const { run, pending, execute } = useStep("queue.exit", queueExit)
  return (
    <StepPanel
      title="queue.exit"
      description={
        <>
          <code>QXI</code>: sale de la cola sin cerrar la transacción. En{" "}
          <code>unknown</code> tolera <code>CANNOT DO THIS IF OFF QUEUE</code>.
        </>
      }
      run={run}
      pending={pending}
      form={
        <div className="flex flex-col gap-4">
          <Blocked reason={disabledReason} />
          <Button
            variant="outline"
            className="w-full"
            disabled={pending || disabledReason !== undefined}
            onClick={() => execute({}, onDone)}
          >
            Salir de la cola
          </Button>
        </div>
      }
    />
  )
}

/** La confirmación de cada corrida de una escritura. */
function ConfirmWrite({
  open,
  title,
  children,
  action,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  children: ReactNode
  action: string
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel()
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{children}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Volver</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            {action}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function useConfirmed<I>(execute: (input: I) => void) {
  const [pendingInput, setPendingInput] = useState<I>()
  return {
    pendingInput,
    ask: (input: I) => setPendingInput(input),
    confirm: () => {
      if (pendingInput !== undefined) execute(pendingInput)
      setPendingInput(undefined)
    },
    cancel: () => setPendingInput(undefined),
  }
}

function RemoveStep({
  disabledReason,
  journey,
  onDone,
  writable,
  unlock,
}: PanelProps & WriteProps) {
  const { environment } = useEnvironment()
  const { run, pending, execute } = useStep("queue.remove", queueRemove)
  const form = useForm<QueueRemoveInput, unknown, QueueRemoveOutput>({
    resolver: zodResolver(queueRemoveSchema),
    defaultValues: { from: "", unlock: false },
  })
  const confirmed = useConfirmed((input: QueueRemoveInput) =>
    execute({ ...input, unlock }, onDone)
  )
  const errors = form.formState.errors
  const from = confirmed.pendingInput?.from.trim().toUpperCase()
  return (
    <StepPanel
      title="queue.remove"
      description={
        <>
          <code>QR</code>: saca el PNR actual de la cola y pasa al siguiente.
          Con <code>from</code>, de 1 a 3 colas a la vez.
        </>
      }
      run={run}
      pending={pending}
      resultView={(result) => <QueueStepView result={result} />}
      form={
        <form
          onSubmit={form.handleSubmit(() => confirmed.ask(form.getValues()))}
          className="flex flex-col gap-4"
        >
          <QueueField
            id="remove-from"
            label="from (opcional)"
            error={errors.from}
            registration={form.register("from")}
            description="Hasta 3 colas separadas por coma. Vacío: la cola en curso."
          />
          <Blocked reason={disabledReason} locked={!writable} />
          <Button
            type="submit"
            variant="destructive"
            disabled={pending || disabledReason !== undefined || !writable}
          >
            Sacar de la cola (remove)
          </Button>
          <ConfirmWrite
            open={confirmed.pendingInput !== undefined}
            title="¿Sacar el PNR de la cola?"
            action="Sacar"
            onConfirm={confirmed.confirm}
            onCancel={confirmed.cancel}
          >
            <code className="font-mono">
              {journey.current ?? "El PNR actual"}
            </code>{" "}
            sale de {from ? `las colas ${from}` : `la cola ${journey.queue}`} en{" "}
            {environment.label}. Usa solo un PNR designado.
          </ConfirmWrite>
        </form>
      }
    />
  )
}

function PlaceStep({
  disabledReason,
  journey,
  onDone,
  writable,
  unlock,
  inside,
}: PanelProps & WriteProps & { inside: boolean }) {
  const { environment } = useEnvironment()
  const { run, pending, execute } = useStep("queue.place", queuePlace)
  const form = useForm<QueuePlaceInput, unknown, QueuePlaceOutput>({
    resolver: zodResolver(queuePlaceSchema),
    defaultValues: {
      // El destino no es la cola elegida: es otra, vacía.
      queue: "",
      pcc: journey.pcc,
      instructionCode: DEFAULT_INSTRUCTION_CODE,
      locators: "",
      unlock: false,
    },
  })
  const confirmed = useConfirmed((input: QueuePlaceInput) =>
    // Dentro de una cola, `place` coloca el PNR actual: con `locators` el SDK lanza.
    execute(
      { ...input, locators: inside ? "" : input.locators, unlock },
      onDone
    )
  )
  const errors = form.formState.errors
  const pendingInput = confirmed.pendingInput
  const what = inside
    ? `Se mueve ${journey.current ?? "el PNR actual"} de la cola ${journey.queue}`
    : pendingInput?.locators.trim()
      ? `Se colocan ${pendingInput.locators.toUpperCase()}`
      : "Se coloca el PNR del AAA"
  const destinationPcc = pendingInput?.pcc?.trim()
    ? ` de ${pendingInput.pcc.toUpperCase()}`
    : ""
  return (
    <StepPanel
      title="queue.place"
      description={
        <>
          <code>QueuePlaceLLSRQ</code>. Dentro de una cola mueve el PNR actual y
          devuelve el siguiente; fuera, coloca los <code>locators</code> (hasta
          6). El PIC es obligatorio (producción lo exige).
        </>
      }
      run={run}
      pending={pending}
      resultView={(result) => <QueueStepView result={result} />}
      form={
        <form
          onSubmit={form.handleSubmit(() => confirmed.ask(form.getValues()))}
          className="flex flex-col gap-4"
        >
          <QueueField
            id="place-queue"
            label="Cola de destino"
            error={errors.queue}
            registration={form.register("queue")}
            description="Una cola vacía, para poder limpiarla después."
          />
          <PccField
            id="place-pcc"
            error={errors.pcc}
            registration={form.register("pcc")}
          />
          <Field data-invalid={errors.instructionCode !== undefined}>
            <FieldLabel htmlFor="place-pic">instructionCode (PIC)</FieldLabel>
            <Input
              id="place-pic"
              inputMode="numeric"
              className="font-mono"
              aria-invalid={errors.instructionCode !== undefined}
              {...form.register("instructionCode")}
            />
            <FieldDescription>
              0–191 o 200–254. <code>11</code> es SEE REMARKS.
            </FieldDescription>
            <FieldError errors={[errors.instructionCode]} />
          </Field>
          <Field data-invalid={errors.locators !== undefined}>
            <FieldLabel htmlFor="place-locators">locators</FieldLabel>
            <Input
              id="place-locators"
              className="font-mono uppercase"
              aria-invalid={errors.locators !== undefined}
              disabled={inside}
              {...form.register("locators")}
            />
            <FieldDescription>
              {inside ? (
                <>
                  Dentro de una cola se coloca el PNR actual (
                  <code>{journey.current ?? "—"}</code>), que sale de la cola en
                  curso.
                </>
              ) : (
                "Fuera de una cola: el PNR designado. Vacío: el del AAA."
              )}
            </FieldDescription>
            <FieldError errors={[errors.locators]} />
          </Field>
          <Blocked reason={disabledReason} locked={!writable} />
          <Button
            type="submit"
            variant="destructive"
            disabled={pending || disabledReason !== undefined || !writable}
          >
            Colocar (place)
          </Button>
          <ConfirmWrite
            open={pendingInput !== undefined}
            title="¿Colocar en la cola?"
            action="Colocar"
            onConfirm={confirmed.confirm}
            onCancel={confirmed.cancel}
          >
            {what} a la cola {pendingInput?.queue.toUpperCase()}
            {destinationPcc} con el PIC{" "}
            {String(pendingInput?.instructionCode ?? "")}, en{" "}
            {environment.label}.
          </ConfirmWrite>
        </form>
      }
    />
  )
}

const ACTION_ITEMS = PROCESS_ACTIONS.map((value) => ({ value, label: value }))

function ProcessStep({
  disabledReason,
  journey,
  onDone,
  choose,
  writable,
  unlock,
}: PanelProps & WriteProps) {
  const { environment } = useEnvironment()
  const { run, pending, execute } = useStep("queue.process", queueProcess)
  const form = useForm<QueueProcessInput, unknown, QueueProcessOutput>({
    resolver: zodResolver(queueProcessSchema),
    defaultValues: {
      queue: journey.queue,
      pcc: journey.pcc,
      limit: 10,
      action: "ignore",
      toQueue: "",
      toInstructionCode: String(DEFAULT_INSTRUCTION_CODE),
      unlock: false,
    },
  })
  const action = useWatch({ control: form.control, name: "action" })
  const start = (input: QueueProcessInput) => {
    choose(input.queue, input.pcc)
    execute({ ...input, unlock }, onDone)
  }
  const confirmed = useConfirmed(start)
  const errors = form.formState.errors
  const writes = action !== "ignore"
  const pendingInput = confirmed.pendingInput
  return (
    <StepPanel
      title="queue.process"
      description={
        <>
          Entra, aplica la misma acción a cada PNR y termina en el fin de cola o
          en <code>limit</code> (sale con <code>QXI</code>). Ante un error
          también sale con <code>QXI</code>.
        </>
      }
      run={run}
      pending={pending}
      form={
        <form
          onSubmit={form.handleSubmit(() => {
            const input = form.getValues()
            if (input.action === "ignore") start(input)
            else confirmed.ask(input)
          })}
          className="flex flex-col gap-4"
        >
          <QueueField
            id="process-queue"
            error={errors.queue}
            registration={form.register("queue")}
          />
          <PccField
            id="process-pcc"
            error={errors.pcc}
            registration={form.register("pcc")}
          />
          <Field data-invalid={errors.limit !== undefined}>
            <FieldLabel htmlFor="process-limit">limit</FieldLabel>
            <Input
              id="process-limit"
              inputMode="numeric"
              className="font-mono"
              aria-invalid={errors.limit !== undefined}
              {...form.register("limit")}
            />
            <FieldDescription>
              De 1 a 50. El SDK no tiene tope; la consola siempre pone uno.
            </FieldDescription>
            <FieldError errors={[errors.limit]} />
          </Field>
          <Controller
            control={form.control}
            name="action"
            render={({ field }) => (
              <Field>
                <FieldLabel htmlFor="process-action">Acción por PNR</FieldLabel>
                <Select
                  items={ACTION_ITEMS}
                  value={field.value}
                  onValueChange={(value) => {
                    if (value !== null) field.onChange(value)
                  }}
                >
                  <SelectTrigger id="process-action" className="font-mono">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTION_ITEMS.map((item) => (
                      <SelectItem
                        key={item.value}
                        value={item.value}
                        className="font-mono"
                      >
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
          />
          {action === "place" && (
            <>
              <QueueField
                id="process-toQueue"
                label="Cola de destino"
                error={errors.toQueue}
                registration={form.register("toQueue")}
                description="Una cola vacía."
              />
              <Field data-invalid={errors.toInstructionCode !== undefined}>
                <FieldLabel htmlFor="process-pic">
                  instructionCode (PIC)
                </FieldLabel>
                <Input
                  id="process-pic"
                  inputMode="numeric"
                  className="font-mono"
                  aria-invalid={errors.toInstructionCode !== undefined}
                  {...form.register("toInstructionCode")}
                />
                <FieldError errors={[errors.toInstructionCode]} />
              </Field>
            </>
          )}
          <Blocked reason={disabledReason} locked={writes && !writable} />
          <Button
            type="submit"
            variant={writes ? "destructive" : "default"}
            disabled={
              pending || disabledReason !== undefined || (writes && !writable)
            }
          >
            Recorrer
          </Button>
          <ConfirmWrite
            open={pendingInput !== undefined}
            title={`¿Recorrer con ${pendingInput?.action}?`}
            action="Recorrer"
            onConfirm={confirmed.confirm}
            onCancel={confirmed.cancel}
          >
            Hasta {String(pendingInput?.limit ?? "")} PNR de la cola{" "}
            {pendingInput?.queue.toUpperCase()} en {environment.label} reciben{" "}
            <code>{pendingInput?.action}</code>
            {pendingInput?.action === "place"
              ? ` hacia la cola ${pendingInput.toQueue.toUpperCase()}`
              : ""}
            . Usa solo una cola con PNR designados.
          </ConfirmWrite>
        </form>
      }
    />
  )
}
