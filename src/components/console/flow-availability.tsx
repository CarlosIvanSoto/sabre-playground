"use client"

import { useEnvironment } from "@/components/environment/environment-provider"
import { type Flow, flowUnavailable } from "@/lib/flows"

/** En la portada: por qué el flujo no corre en el entorno elegido. Nada si corre. */
export function FlowAvailability({ flow }: { flow: Flow }) {
  const { environment } = useEnvironment()
  const reason = flowUnavailable(flow, environment)
  if (reason === undefined) return null
  return (
    <p className="text-destructive text-xs">
      No corre en {environment.label}: {reason}
    </p>
  )
}
