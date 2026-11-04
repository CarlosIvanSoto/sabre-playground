"use client"

import { CircleAlert, CircleCheck, CircleDashed, CircleX } from "lucide-react"
import type { ReactNode } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  JOURNEY_STEPS,
  type Journey,
  type JourneyStep,
  type StepStatus,
  stepStatus,
} from "@/lib/air-booking-journey"
import { cn } from "@/lib/utils"

const LABELS: Record<JourneyStep, string> = {
  search: "Buscar",
  revalidate: "Revalidar",
  seats: "Asientos (opcional)",
  create: "Reservar",
  read: "Leer",
  cleanup: "Limpiar",
  verify: "Comprobar",
}

const ICONS: Record<StepStatus, ReactNode> = {
  pending: <CircleDashed className="text-muted-foreground size-4" />,
  done: <CircleCheck className="size-4" />,
  skipped: <CircleDashed className="size-4" />,
  failed: <CircleX className="text-destructive size-4" />,
}

const STATUS_TEXT: Record<StepStatus, string> = {
  pending: "pendiente",
  done: "listo",
  skipped: "saltado",
  failed: "falló",
}

/**
 * El indicador del recorrido (F3.5): qué pasos ya corrieron, cuáles faltan y por qué hay
 * pasos bloqueados. Cambiar un paso vacía los siguientes.
 */
export function JourneyProgress({
  journey,
  blocked,
  canReset,
  onReset,
}: {
  journey: Journey
  /** Por qué hay pasos deshabilitados, si los hay. */
  blocked?: { title: string; description: ReactNode }
  canReset: boolean
  onReset: () => void
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <ol className="flex flex-wrap gap-x-5 gap-y-2">
            {JOURNEY_STEPS.map((step, index) => {
              const { status, detail } = stepStatus(journey, step)
              return (
                <li
                  key={step}
                  data-step={step}
                  data-status={status}
                  className={cn(
                    "flex items-center gap-1.5 text-sm",
                    status === "pending" && "text-muted-foreground"
                  )}
                  title={STATUS_TEXT[status]}
                >
                  {ICONS[status]}
                  <span>
                    {index + 1}. {LABELS[step]}
                  </span>
                  {detail !== undefined && (
                    <code className="bg-muted rounded px-1 font-mono text-xs">
                      {detail}
                    </code>
                  )}
                  <span className="sr-only">: {STATUS_TEXT[status]}</span>
                </li>
              )
            })}
          </ol>
          <Button
            variant="outline"
            size="sm"
            onClick={onReset}
            disabled={!canReset}
          >
            Empezar de nuevo
          </Button>
        </div>
        {blocked !== undefined && (
          <Alert>
            <CircleAlert />
            <AlertTitle>{blocked.title}</AlertTitle>
            <AlertDescription>{blocked.description}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}
