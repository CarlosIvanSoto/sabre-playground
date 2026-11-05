"use client"

import { useState, useTransition } from "react"
import { useEnvironment } from "@/components/environment/environment-provider"
import { useHistory } from "@/components/history/history-provider"
import type { ConsoleEnvironmentId } from "@/lib/environment"
import type { StepRun } from "@/lib/step/types"

/**
 * Corre la server action de un paso en el entorno elegido y deja la llamada en el
 * historial. Devuelve lo que necesita el `StepPanel`.
 *
 * ```tsx
 * const step = useStep("booking.get", getBooking)
 * <StepPanel run={step.run} pending={step.pending} form={…step.execute(input)…} />
 * ```
 */
export function useStep<I>(
  method: string,
  action: (environment: ConsoleEnvironmentId, input: I) => Promise<StepRun>
) {
  const { environment } = useEnvironment()
  const { record } = useHistory()
  const [run, setRun] = useState<StepRun>()
  const [pending, startTransition] = useTransition()

  /** `onDone` recibe lo que devolvió la action: así un paso le pasa su resultado al siguiente. */
  const execute = (input: I, onDone?: (run: StepRun) => void) =>
    startTransition(async () => {
      const at = new Date().toISOString()
      const result = await action(environment.id, input)
      setRun(result)
      record({ method, at, input, run: result })
      onDone?.(result)
    })

  /** Vuelve al estado inicial, sin llamada. Lo usa el recorrido al invalidar un paso. */
  const reset = () => setRun(undefined)

  return { run, pending, execute, reset }
}
