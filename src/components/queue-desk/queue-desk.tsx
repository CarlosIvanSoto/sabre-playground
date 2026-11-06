"use client"

import { ExternalLink, RotateCwIcon } from "lucide-react"
import Link from "next/link"
import { type ReactNode, useEffect, useReducer, useState } from "react"
import type { QueueItem } from "sabre-client"
import { getBooking } from "@/app/(console)/booking/actions"
import {
  queueAccess,
  queueCount,
  queueExit,
  queueIgnore,
  queuePlace,
  queueRemove,
} from "@/app/(console)/queues/actions"
import { useEnvironment } from "@/components/environment/environment-provider"
import { ActivityBar } from "@/components/queue-desk/desk-activity"
import { BookingSheet } from "@/components/queue-desk/desk-booking"
import { DeskCensus } from "@/components/queue-desk/desk-census"
import { DeskPcc, DeskQueues } from "@/components/queue-desk/desk-queues"
import { DeskScreenView } from "@/components/queue-desk/desk-screen"
import { DeskSessionBar } from "@/components/queue-desk/desk-session"
import { MoveControl, RemoveControl } from "@/components/queue-desk/desk-write"
import { UnlockCard } from "@/components/queues/queues-flow"
import { useSessionStatus } from "@/components/session/use-session-status"
import { useStep } from "@/components/step/use-step"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { FAKE_REST_REASON } from "@/lib/flows"
import {
  bookingHref,
  type DeskDestination,
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
 * valen en otro.
 *
 * El PCC de trabajo (F9.6) va en cada operación: `pcc` en `count`, `access` y el destino de
 * `place`, y `targetPcc` en la hoja de reserva. La sesión SOAP es la misma. Al cambiarlo, la
 * mesa sale de la cola si está dentro, borra el conteo y vuelve a contar; la URL pasa a
 * `/queue-desk/<PCC>`.
 *
 * Atajos (F9.5): I siguiente, M mover (foco en la cola destino), R sacar, E salir, B reserva,
 * ? la leyenda. Solo con el foco fuera de los campos y sin una hoja o un popover abiertos;
 * cada atajo hace clic en su botón, así que respeta si está deshabilitado, y mover y sacar
 * siguen pidiendo confirmación.
 */
export function QueueDesk({ initialPcc = "" }: { initialPcc?: string }) {
  const { environment } = useEnvironment()
  return <Desk key={environment.id} initialPcc={initialPcc} />
}

function Desk({ initialPcc }: { initialPcc: string }) {
  const { environment } = useEnvironment()
  const { status, error, refresh } = useSessionStatus()
  // Producción: el desbloqueo de `remove` y `place`, como en el flujo 6. Se pierde al recargar
  // o al cambiar de entorno (la mesa se vuelve a montar).
  const [unlocked, setUnlocked] = useState(false)
  const [legendOpen, setLegendOpen] = useState(false)
  // Las llamadas del historial desde aquí son de la mesa: la barra de actividad solo muestra
  // esas.
  const [since] = useState(() => new Date().toISOString())
  const [desk, dispatch] = useReducer(queueDeskReducer, undefined, () =>
    initialQueueDesk(initialPcc)
  )
  const open = status?.open === true
  const sessionPcc = status?.open ? status.pcc : ""
  const place: SessionPlace = status?.open ? status.queueState : "closed"
  const allowed = stepsFor(place)
  const reason = (panel: QueuePanel) =>
    allowed.has(panel) ? undefined : disabledReason(place, panel)

  const countStep = useStep("queue.count", queueCount)
  const accessStep = useStep("queue.access", queueAccess)
  const ignoreStep = useStep("queue.ignore", queueIgnore)
  const exitStep = useStep("queue.exit", queueExit)
  const placeStep = useStep("queue.place", queuePlace)
  const removeStep = useStep("queue.remove", queueRemove)
  const bookingStep = useStep("booking.get", getBooking)
  const moving =
    accessStep.pending ||
    ignoreStep.pending ||
    exitStep.pending ||
    placeStep.pending ||
    removeStep.pending

  // `/queue-desk/<PCC de la sesión>` es el PCC de la sesión: se normaliza a vacío.
  useEffect(() => {
    dispatch({ type: "sessionPcc", pcc: sessionPcc })
  }, [sessionPcc])

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

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey) return
      if (event.altKey) return
      const target = event.target as HTMLElement | null
      if (target?.closest(EDITABLE)) return
      if (event.key === "?") {
        event.preventDefault()
        setLegendOpen((open) => !open)
        return
      }
      // Con una hoja o un popover abiertos, las teclas son de ellos (Esc los cierra).
      if (document.querySelector(OVERLAYS) !== null) return
      const key = event.key.toLowerCase()
      if (key === "m") {
        const input = document.getElementById("desk-move-queue")
        if (input !== null) {
          event.preventDefault()
          input.focus()
        }
        return
      }
      const button = document.querySelector<HTMLButtonElement>(
        `[data-desk-key="${key}"]`
      )
      if (button !== null && !button.disabled) {
        event.preventDefault()
        button.click()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  /** Después de un paso que mueve el cursor: al reducer y a pedir el estado de la sesión. */
  const moved =
    (panel: QueuePanel, method: string, to?: DeskDestination) =>
    (run: StepRun) => {
      dispatch({ type: "moved", panel, method, run, to })
      void refresh()
    }

  const countIn = (pcc: string) =>
    countStep.execute({ pcc }, (run) => {
      dispatch({ type: "counted", pcc, run })
      void refresh()
    })
  const count = () => countIn(desk.pcc)

  /** Cambiar el PCC de trabajo: `exit` antes si el cursor está en una cola, y contar de nuevo. */
  const changePcc = (pcc: string) => {
    const apply = () => {
      dispatch({ type: "pcc", pcc })
      window.history.replaceState(
        null,
        "",
        pcc === "" ? "/queue-desk" : `/queue-desk/${pcc}`
      )
      if (open) countIn(pcc)
    }
    if (place === "inside" || place === "unknown") {
      exitStep.execute({}, (run) => {
        moved("exit", "queue.exit")(run)
        // Si `exit` falla, el cursor sigue en la cola del PCC anterior: no se cambia.
        if (run.enabled && run.step.ok) apply()
      })
    } else {
      apply()
    }
  }

  /** Un clic en una cola: `access`, con `exit` antes si el cursor está en otra o en unknown. */
  const enter = (queue: string) => {
    dispatch({ type: "select", queue })
    const access = () =>
      accessStep.execute(
        { queue, pcc: desk.pcc },
        moved("access", "queue.access")
      )
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
  /** Mover y sacar: solo con un PNR en pantalla y, en producción, desbloqueados. */
  const writeReason = !inside
    ? reason("remove")
    : desk.journey.current === undefined
      ? "Sin PNR en pantalla."
      : environment.readOnly && !unlocked
        ? "En producción, primero el desbloqueo de abajo."
        : undefined
  const unlock = environment.readOnly && unlocked
  /** Ver la reserva: REST, así que no en fake; y solo con un PNR en pantalla. */
  const bookingReason =
    environment.id === "fake"
      ? `Ver reserva: ${FAKE_REST_REASON}.`
      : desk.journey.current === undefined
        ? "Sin PNR en pantalla."
        : undefined
  const openBooking = () => {
    const locator = desk.journey.current
    if (locator === undefined) return
    dispatch({ type: "booking", locator })
    bookingStep.execute({
      confirmationId: locator,
      surname: "",
      targetPcc: desk.pcc,
    })
  }
  const removeControl = (
    <RemoveControl
      locator={desk.journey.current}
      from={desk.journey.queue}
      reason={writeReason}
      pending={moving}
      onConfirm={() =>
        removeStep.execute(
          { from: "", unlock },
          moved("remove", "queue.remove")
        )
      }
    />
  )

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
          title={desk.pcc === "" ? "Colas" : `Colas · ${desk.pcc}`}
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
          <div className="flex flex-col gap-3">
            <DeskPcc
              key={desk.pcc}
              pcc={desk.pcc}
              sessionPcc={sessionPcc}
              disabled={moving || countStep.pending}
              onChange={changePcc}
            />
            <DeskQueues
              count={desk.count}
              failure={desk.countFailure}
              active={inside ? desk.journey.queue : undefined}
              disabledReason={enterReason}
              pending={moving}
              onEnter={enter}
            />
          </div>
        </DeskColumn>
        <DeskColumn title={<ScreenTitle desk={desk} inside={inside} />}>
          <DeskScreenView key={desk.screen?.seq ?? 0} screen={desk.screen} />
        </DeskColumn>
        <DeskColumn title="Acciones" scroll>
          <div className="flex flex-col gap-2 text-sm">
            <ActionButton
              label="Siguiente"
              method="queue.ignore"
              shortcut="i"
              reason={reason("ignore")}
              pending={moving}
              onClick={() =>
                ignoreStep.execute({}, moved("ignore", "queue.ignore"))
              }
            />
            <ActionButton
              label="Salir de la cola"
              method="queue.exit"
              shortcut="e"
              variant="outline"
              reason={reason("exit")}
              pending={moving}
              onClick={() => exitStep.execute({}, moved("exit", "queue.exit"))}
            />
            <div className="mt-1 flex flex-col gap-2 border-t pt-3">
              <MoveControl
                locator={desk.journey.current}
                from={desk.journey.queue}
                reason={writeReason}
                pending={moving}
                recent={desk.recent}
                pcc={desk.pcc}
                sessionPcc={sessionPcc}
                onConfirm={(to) =>
                  placeStep.execute(
                    {
                      queue: to.queue,
                      pcc: to.pcc,
                      instructionCode: to.instructionCode,
                      locators: "",
                      unlock,
                    },
                    moved("place", "queue.place", to)
                  )
                }
              />
              {removeControl}
            </div>
            {environment.readOnly && (
              <UnlockCard unlocked={unlocked} onChange={setUnlocked} />
            )}
            <div className="mt-1 flex flex-col gap-2 border-t pt-3">
              <ActionButton
                label="Ver reserva"
                method="booking.get"
                shortcut="b"
                variant="outline"
                reason={bookingReason}
                pending={bookingStep.pending}
                onClick={openBooking}
              />
              {bookingReason === undefined ? (
                <Link
                  href={bookingHref(desk.journey.current ?? "", desk.pcc)}
                  target="_blank"
                  rel="noopener"
                  className={buttonVariants({
                    variant: "ghost",
                    size: "sm",
                    className: "justify-start",
                  })}
                >
                  <ExternalLink />
                  En pestaña
                </Link>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="justify-start"
                  disabled
                >
                  <ExternalLink />
                  En pestaña
                </Button>
              )}
            </div>
            <div className="mt-1 flex flex-col gap-2 border-t pt-3">
              <DeskCensus
                item={screenItem(desk)}
                queue={desk.journey.queue}
                total={desk.total}
                pcc={desk.pcc}
                reason={inside ? undefined : "Solo dentro de una cola."}
              />
            </div>
          </div>
        </DeskColumn>
      </div>
      <ActivityBar
        since={since}
        legendOpen={legendOpen}
        onLegendOpenChange={setLegendOpen}
      />
      <BookingSheet
        locator={desk.booking}
        pcc={desk.pcc}
        run={bookingStep.run}
        pending={bookingStep.pending}
        onClose={() => dispatch({ type: "booking" })}
        removeFromQueue={
          inside && desk.booking === desk.journey.current
            ? removeControl
            : undefined
        }
      />
    </div>
  )
}

/** El `QueueItem` en pantalla, si el último paso trajo el PNR del cursor. */
function screenItem(desk: QueueDeskState): QueueItem | undefined {
  const run = desk.screen?.run
  if (run === undefined || !run.enabled || !run.step.ok) return undefined
  const result = run.step.result as
    | { done?: boolean; item?: QueueItem }
    | undefined
  if (result?.done !== false || result.item === undefined) return undefined
  return result.item.locator === desk.journey.current ? result.item : undefined
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
  shortcut,
  reason,
  pending,
  variant = "default",
  onClick,
}: {
  label: string
  method: string
  /** La tecla del atajo, en minúscula. */
  shortcut?: string
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
        data-desk-key={shortcut}
        title={
          shortcut === undefined
            ? undefined
            : `Atajo: ${shortcut.toUpperCase()}`
        }
      >
        <span>
          {shortcut !== undefined && (
            <kbd className="me-1.5 font-mono text-xs opacity-70">
              {shortcut.toUpperCase()}
            </kbd>
          )}
          {label}
        </span>
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

/** Dónde no cuentan los atajos: los campos de texto y los selectores. */
const EDITABLE =
  "input, textarea, select, [contenteditable='true'], [role='combobox']"

/** Las capas que se quedan con el teclado mientras están abiertas. */
const OVERLAYS = "[data-slot=popover-content], [data-slot=sheet-content]"
