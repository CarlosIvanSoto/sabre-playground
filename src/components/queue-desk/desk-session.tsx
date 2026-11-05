"use client"

import { useState } from "react"
import {
  closeSession,
  openSession,
  pingSession,
} from "@/app/(console)/session/actions"
import { EnvironmentBadge } from "@/components/environment/environment-badge"
import { useEnvironment } from "@/components/environment/environment-provider"
import { SessionTimer } from "@/components/session/session-timer"
import { useStep } from "@/components/step/use-step"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import type { SessionStatus } from "@/lib/session"
import type { StepRun } from "@/lib/step/types"

/**
 * La barra superior de la mesa: el panel de sesión del flujo 5 en una línea (estado, contador
 * de inactividad, `keepAlive`, abrir / ping / cerrar) y el indicador fijo de
 * `session.queue.state`. Usa las mismas server actions de `/session`, así que cada llamada
 * queda en el historial.
 */
export function DeskSessionBar({
  status,
  error,
  onDone,
}: {
  status?: SessionStatus
  error?: string
  /** Después de cada paso: la mesa vuelve a pedir el estado de la sesión. */
  onDone: () => void
}) {
  const { environment } = useEnvironment()
  const openStep = useStep("legacy.openSession", openSession)
  const pingStep = useStep("session.ping", pingSession)
  const closeStep = useStep("session.close", closeSession)
  const [keepAlive, setKeepAlive] = useState(false)
  /** Solo la última llamada de la barra: un fallo viejo no queda pegado. */
  const [lastFailure, setLastFailure] = useState<string>()
  const done = (run: StepRun) => {
    setLastFailure(failureOf(run))
    onDone()
  }

  const open = status?.open === true
  const pending = openStep.pending || pingStep.pending || closeStep.pending
  const failure = error ?? lastFailure

  return (
    <div
      data-slot="desk-session"
      className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-2 text-sm"
    >
      <EnvironmentBadge environment={environment.id} />
      <span className="font-medium">Sesión</span>
      {status === undefined ? (
        <Badge variant="outline">…</Badge>
      ) : status.open ? (
        <>
          <Badge>abierta</Badge>
          <span className="text-muted-foreground font-mono">
            PCC {status.pcc}
          </span>
          <SessionTimer idleMs={status.idleMs} at={status.at} />
        </>
      ) : (
        <Badge variant="outline">cerrada</Badge>
      )}
      <div className="flex items-center gap-2">
        <Checkbox
          id="desk-keepAlive"
          checked={open ? status.keepAlive : keepAlive}
          disabled={open || pending}
          onCheckedChange={(checked) => setKeepAlive(checked === true)}
        />
        <Label htmlFor="desk-keepAlive" className="font-normal">
          keepAlive
        </Label>
      </div>
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          disabled={pending || open || status === undefined}
          onClick={() => openStep.execute({ keepAlive }, done)}
        >
          Abrir
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={pending || !open}
          onClick={() => pingStep.execute({}, done)}
        >
          Ping
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={pending || !open}
          onClick={() => closeStep.execute({}, done)}
        >
          Cerrar
        </Button>
      </div>
      {failure !== undefined && (
        <Badge
          variant="destructive"
          className="max-w-80 truncate"
          title={failure}
        >
          {failure}
        </Badge>
      )}
      <div className="ms-auto flex items-center gap-2">
        <span className="text-muted-foreground">Estado de cola</span>
        <QueueStateBadge status={status} />
      </div>
    </div>
  )
}

/** `outside` / `inside` / `unknown`, o una raya sin sesión. */
function QueueStateBadge({ status }: { status?: SessionStatus }) {
  if (status?.open !== true) {
    return (
      <Badge variant="outline" className="font-mono">
        —
      </Badge>
    )
  }
  const variant =
    status.queueState === "unknown"
      ? "destructive"
      : status.queueState === "inside"
        ? "default"
        : "outline"
  return (
    <Badge variant={variant} className="font-mono" data-queue-state>
      {status.queueState}
    </Badge>
  )
}

/** El motivo de un paso que no corrió o que falló, para la barra. */
function failureOf(run: StepRun | undefined): string | undefined {
  if (run === undefined) return undefined
  if (!run.enabled) return run.reason
  if (run.step.ok) return undefined
  return run.step.error?.message ?? "la llamada falló"
}
