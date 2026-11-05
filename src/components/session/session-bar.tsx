"use client"

import { EnvironmentBadge } from "@/components/environment/environment-badge"
import { SessionTimer } from "@/components/session/session-timer"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import type { SessionStatus } from "@/lib/session"

/**
 * El estado fijo de la sesión SOAP del entorno: abierta o no, el contador de inactividad,
 * `keepAlive` y `session.queue.state`. Lo comparten el flujo 5 y el de colas.
 */
export function SessionBar({
  status,
  error,
}: {
  status?: SessionStatus
  error?: string
}) {
  if (error !== undefined) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Sin estado de sesión</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }
  return (
    <div
      data-slot="session-bar"
      className="bg-card sticky top-2 z-10 flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-sm"
    >
      <span className="font-medium">Sesión SOAP</span>
      {status !== undefined && (
        <EnvironmentBadge environment={status.environment} />
      )}
      {status === undefined ? (
        <Badge variant="outline">…</Badge>
      ) : status.open ? (
        <>
          <Badge>abierta</Badge>
          <SessionTimer idleMs={status.idleMs} at={status.at} />
          {status.keepAlive && <Badge variant="secondary">keepAlive</Badge>}
          <span className="text-muted-foreground ms-auto">queue.state</span>
          <Badge
            variant={
              status.queueState === "unknown"
                ? "destructive"
                : status.queueState === "inside"
                  ? "default"
                  : "outline"
            }
            className="font-mono"
          >
            {status.queueState}
          </Badge>
        </>
      ) : (
        <Badge variant="outline">cerrada</Badge>
      )}
    </div>
  )
}
