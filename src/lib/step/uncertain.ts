import type { StepError, StepRun } from "@/lib/step/types"

/**
 * El desenlace incierto de una emisión o un void (ADR-031): el SDK lanza
 * `SabreUncertainOutcomeError` cuando no sabe si la operación se hizo. No es un error: puede
 * haberse hecho. **No se reintenta**, ni en automático ni con un botón: se verifica (Get
 * Booking o `tickets.verify`) y se decide con lo que diga la reserva.
 *
 * Puro y sin el SDK: lo usan el `StepPanel`, la hoja lateral y los tests.
 */

export const UNCERTAIN_CLASS = "SabreUncertainOutcomeError"

export interface UncertainOutcome {
  /** `SabreUncertainOutcomeReason`: `END_TRANSACTION_PROBLEM`, `TRANSPORT`, `ABORTED`… */
  reason: string
  operation?: string
  confirmationId?: string
  message: string
  tickets: NonNullable<StepError["tickets"]>
}

/** El error, si es un desenlace incierto. */
export function uncertainOfError(
  error: StepError | undefined
): UncertainOutcome | undefined {
  if (error?.class !== UNCERTAIN_CLASS) return undefined
  return {
    reason: error.reason ?? "desconocido",
    operation: error.operation,
    confirmationId: error.confirmationId,
    message: error.message,
    tickets: error.tickets ?? [],
  }
}

/** El desenlace incierto de una corrida, si lo hubo. */
export function uncertainOf(
  run: StepRun | undefined
): UncertainOutcome | undefined {
  if (run === undefined || !run.enabled || run.step.ok) return undefined
  return uncertainOfError(run.step.error)
}

/** Qué se hace con un incierto: lo mismo en toda la consola. */
export const UNCERTAIN_ADVICE =
  "No se sabe si se hizo: puede haberse hecho. No lo vuelvas a correr; verifica primero la reserva."
