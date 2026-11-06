import "server-only"

import type { StepResult, StepRun } from "@/lib/step/types"

/**
 * El `StepResult` de un paso del censo, sin lo que ADR-026 deja fuera: el censo no manda al
 * navegador nada que no sea un rasgo (F10.2, #96).
 *
 * - `result`: ya viene reducido a rasgos (la action lo mapea dentro de la llamada).
 * - `raw`: se conservan la operación, el status y los intentos; el body y los headers se
 *   descartan. El body es el PNR entero (SOAP) o la reserva entera (REST).
 * - `warnings` y `partialErrors`: solo el código.
 * - `error`: clase, código y status; el mensaje de Sabre puede traer texto del PNR, así que pasa a
 *   ser el código.
 * - `log`: evento y nivel, sin `context`.
 *
 * Así el historial y la barra de actividad siguen mostrando cada llamada del censo, con lo justo.
 */

export const DISCARDED_BODY =
  "[descartado por el censo: ADR-026 no deja salir del servidor la respuesta de Sabre]"

function codeOf(issue: unknown): string {
  if (typeof issue === "string") return issue
  if (issue !== null && typeof issue === "object") {
    const { code, type } = issue as { code?: unknown; type?: unknown }
    if (typeof code === "string") return code
    if (typeof type === "string") return type
  }
  return "UNKNOWN"
}

export function censusStepResult<T>(step: StepResult<T>): StepResult<T> {
  const { error } = step
  return {
    ok: step.ok,
    result: step.ok ? step.result : undefined,
    raw:
      step.raw === undefined
        ? undefined
        : {
            operation: step.raw.operation,
            protocol: step.raw.protocol,
            status: step.raw.status,
            attempts: step.raw.attempts,
            headers: {},
            body: DISCARDED_BODY,
          },
    warnings: step.warnings?.map(codeOf),
    partialErrors: step.partialErrors?.map(codeOf),
    error:
      error === undefined
        ? undefined
        : {
            class: error.class,
            code: error.code,
            status: error.status,
            retryable: error.retryable,
            protocol: error.protocol,
            service: error.service,
            kind: error.kind,
            message: error.code ?? error.class,
          },
    log: step.log.map(({ at, level, event }) => ({ at, level, event })),
    durationMs: step.durationMs,
    attempts: step.attempts,
  }
}

export function censusRun<T>(run: StepRun<T>): StepRun<T> {
  return run.enabled ? { ...run, step: censusStepResult(run.step) } : run
}
