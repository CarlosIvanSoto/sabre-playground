"use client"

import { HistoryIcon, RotateCwIcon } from "lucide-react"
import Link from "next/link"
import { type ReactNode, useEffect, useReducer } from "react"
import {
  queueAccess,
  queueCount,
  queueExit,
  queueIgnore,
} from "@/app/(console)/queues/actions"
import { useEnvironment } from "@/components/environment/environment-provider"
import { useHistory } from "@/components/history/history-provider"
import { DeskQueues } from "@/components/queue-desk/desk-queues"
import { DeskScreenView } from "@/components/queue-desk/desk-screen"
import { DeskSessionBar } from "@/components/queue-desk/desk-session"
import { useSessionStatus } from "@/components/session/use-session-status"
import { useStep } from "@/components/step/use-step"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  initialQueueDesk,
  type QueueDesk as QueueDeskState,
  queueDeskReducer,
} from "@/lib/queue-desk"
import {
  disabledReason,
  type QueuePanel,
  type SessionPlace,
  stepsFor,
} from "@/lib/queue-journey"
import type { StepRun } from "@/lib/step/types"

/**
 * La mesa de colas (ADR-025): sesión, conteo, navegación y reserva en una sola pantalla de
 * alto fijo, sin scroll de página. Solo hacen scroll interno la lista de colas y el párrafo
 * del PNR. Compone los flujos 4, 5 y 6 con sus mismas server actions, sin agregar ninguna:
 * cada llamada pasa por `useStep` y queda en el historial.
 *
 * Al cambiar de entorno, la mesa se vuelve a montar: el conteo y el cursor de un entorno no
 * valen en otro. Mover y sacar llegan en F9.3, la hoja de reserva en F9.4, y los atajos y la
 * barra de actividad en F9.5.
 */
export function QueueDesk() {
  const { environment } = useEnvironment()
  return <Desk key={environment.id} />
}

function Desk() {
  const { status, error, refresh } = useSessionStatus()
  const [desk, dispatch] = useReducer(queueDeskReducer, undefined, () =>
    initialQueueDesk()
  )
  const open = status?.open === true
  const place: SessionPlace = status?.open ? status.queueState : "closed"
  const allowed = stepsFor(place)
  const reason = (panel: QueuePanel) =>
    allowed.has(panel) ? undefined : disabledReason(place, panel)

  const countStep = useStep("queue.count", queueCount)
  const accessStep = useStep("queue.access", queueAccess)
  const ignoreStep = useStep("queue.ignore", queueIgnore)
  const exitStep = useStep("queue.exit", queueExit)
  const moving = accessStep.pending || ignoreStep.pending || exitStep.pending

  // Una sesión cerrada o vencida no tiene cursor.
  useEffect(() => {
    if (status !== undefined && !status.open) {
      dispatch({ type: "sessionGone" })
    }
  }, [status])

  // Cerrar la pestaña no cierra la sesión: queda en el registro del servidor hasta que la
  // barre (35 min) y, mientras, cuenta para el límite de 50 por PCC.
  useEffect(() => {
    if (!open) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      // Chrome antes de la 119 y algunos WebView solo miran `returnValue`.
      event.returnValue = true
    }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [open])

  /** Después de un paso que mueve el cursor: al reducer y a pedir el estado de la sesión. */
  const moved = (panel: QueuePanel, method: string) => (run: StepRun) => {
    dispatch({ type: "moved", panel, method, run })
    void refresh()
  }

  const count = () =>
    countStep.execute({ pcc: "" }, (run) => {
      dispatch({ type: "counted", run })
      void refresh()
    })

  /** Un clic en una cola: `access`, con `exit` antes si el cursor está en otra o en unknown. */
  const enter = (queue: string) => {
    dispatch({ type: "select", queue })
    const access = () =>
      accessStep.execute({ queue, pcc: "" }, moved("access", "queue.access"))
    if (place === "inside" || place === "unknown") {
      exitStep.execute({}, (run) => {
        moved("exit", "queue.exit")(run)
        if (run.enabled && run.step.ok) access()
      })
    } else {
      access()
    }
  }

  const inside = place === "inside"
  const enterReason =
    place === "closed" ? disabledReason(place, "access") : undefined

  return (
    // El layout de la consola deja la cabecera de 3.5rem y un padding de 1rem (1.5rem desde
    // md). Los márgenes negativos lo anulan para que la mesa ocupe justo el resto del alto.
    <div
      data-slot="queue-desk"
      className="-m-4 flex h-[calc(100dvh-3.5rem)] min-h-0 flex-col overflow-hidden md:-m-6"
    >
      <DeskSessionBar
        status={status}
        error={error}
        onDone={() => void refresh()}
      />
      <div className="grid min-h-0 flex-1 grid-cols-[14rem_minmax(0,1fr)_16rem] divide-x">
        <DeskColumn
          title="Colas"
          scroll
          actions={
            <Button
              size="icon-xs"
              variant="ghost"
              aria-label="Volver a contar (queue.count)"
              title={reason("count") ?? "Volver a contar (queue.count)"}
              disabled={countStep.pending || reason("count") !== undefined}
              onClick={count}
            >
              <RotateCwIcon
                className={countStep.pending ? "animate-spin" : ""}
              />
            </Button>
          }
        >
          <DeskQueues
            count={desk.count}
            failure={desk.countFailure}
            active={inside ? desk.journey.queue : undefined}
            disabledReason={enterReason}
            pending={moving}
            onEnter={enter}
          />
        </DeskColumn>
        <DeskColumn title={<ScreenTitle desk={desk} inside={inside} />}>
          <DeskScreenView key={desk.screen?.seq ?? 0} screen={desk.screen} />
        </DeskColumn>
        <DeskColumn title="Acciones">
          <div className="flex flex-col gap-2 text-sm">
            <ActionButton
              label="Siguiente"
              method="queue.ignore"
              reason={reason("ignore")}
              pending={moving}
              onClick={() =>
                ignoreStep.execute({}, moved("ignore", "queue.ignore"))
              }
            />
            <ActionButton
              label="Salir de la cola"
              method="queue.exit"
              variant="outline"
              reason={reason("exit")}
              pending={moving}
              onClick={() => exitStep.execute({}, moved("exit", "queue.exit"))}
            />
            <p className="text-muted-foreground mt-2 border-t pt-3 text-xs">
              Mover y sacar llegan en F9.3, y la reserva en F9.4.
            </p>
          </div>
        </DeskColumn>
      </div>
      <ActivityBar />
    </div>
  )
}

/** `Cola 9 · PNR 3 de 6 · AAAAAA`, con lo que haya. */
function ScreenTitle({
  desk,
  inside,
}: {
  desk: QueueDeskState
  inside: boolean
}) {
  const { journey, total } = desk
  if (journey.queue === "") return "PNR en pantalla"
  return (
    <span className="flex items-center gap-2 normal-case">
      <span>Cola {journey.queue}</span>
      {journey.current !== undefined && (
        <>
          <span>·</span>
          <span title="Desde el último access, contra el conteo previo">
            PNR {journey.visited} de {total ?? "?"}
          </span>
          <span>·</span>
          <Badge className="font-mono normal-case">{journey.current}</Badge>
        </>
      )}
      {journey.ended !== undefined && !inside && (
        <Badge variant="secondary" className="normal-case">
          fin de cola
        </Badge>
      )}
    </span>
  )
}

function ActionButton({
  label,
  method,
  reason,
  pending,
  variant = "default",
  onClick,
}: {
  label: string
  method: string
  reason?: string
  pending: boolean
  variant?: "default" | "outline"
  onClick: () => void
}) {
  return (
    <div className="flex flex-col gap-1">
      <Button
        variant={variant}
        disabled={pending || reason !== undefined}
        onClick={onClick}
        className="justify-between"
      >
        {label}
        <code className="text-xs opacity-70">{method}</code>
      </Button>
      {reason !== undefined && (
        <span className="text-muted-foreground text-xs">{reason}</span>
      )}
    </div>
  )
}

/**
 * Una columna de la mesa: título fijo (con acciones a la derecha) y cuerpo que, si `scroll`,
 * hace scroll por dentro. Sin `scroll`, el cuerpo es una columna flex que reparte el alto.
 */
function DeskColumn({
  title,
  actions,
  scroll = false,
  children,
}: {
  title: ReactNode
  actions?: ReactNode
  scroll?: boolean
  children: ReactNode
}) {
  return (
    <section
      aria-label={typeof title === "string" ? title : undefined}
      className="flex min-h-0 min-w-0 flex-col"
    >
      <div className="flex h-9 shrink-0 items-center gap-2 border-b px-4">
        <h2 className="text-muted-foreground min-w-0 truncate text-xs font-medium tracking-wide uppercase">
          {title}
        </h2>
        {actions !== undefined && <div className="ms-auto">{actions}</div>}
      </div>
      <div
        className={
          scroll
            ? "min-h-0 flex-1 overflow-y-auto p-4"
            : "flex min-h-0 flex-1 flex-col overflow-hidden p-4"
        }
      >
        {children}
      </div>
    </section>
  )
}

/**
 * La barra de actividad. En F9.5 muestra las últimas llamadas de la mesa con su detalle; por
 * ahora, cuántas llamadas hay en el historial del navegador y el enlace para verlas.
 */
function ActivityBar() {
  const { entries } = useHistory()
  return (
    <footer className="text-muted-foreground flex h-10 shrink-0 items-center gap-2 border-t px-4 text-sm">
      <span className="font-medium">Actividad</span>
      <span>
        {entries.length === 0
          ? "sin llamadas todavía"
          : `${entries.length} ${entries.length === 1 ? "llamada" : "llamadas"} en el historial`}
      </span>
      <Link
        href="/history"
        className="hover:text-foreground ms-auto inline-flex items-center gap-1"
      >
        <HistoryIcon className="size-4" />
        Historial
      </Link>
    </footer>
  )
}
