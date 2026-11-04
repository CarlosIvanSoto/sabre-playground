import "server-only"

import {
  SabreError,
  type SabreRawResponse,
  type SabreRawResponseCallback,
} from "sabre-client"
import type { LogLine, StepError, StepResult } from "@/lib/step/types"
import { captureLog } from "@/server/sabre/log"

export type {
  LogLine,
  RawResponse,
  StepError,
  StepResult,
  StepRun,
} from "@/lib/step/types"

export interface StepOptions {
  onRawResponse: SabreRawResponseCallback
}

/** A datos planos: lo que no sea JSON (instancias, `Headers`, `undefined`) no pasa al cliente. */
function toPlain<T>(value: T): T {
  return value === undefined ? value : JSON.parse(JSON.stringify(value))
}

function serializeError(error: unknown): StepError {
  if (error instanceof SabreError) {
    // `toJSON` deja fuera `raw`, que no es enumerable y puede traer PII o credenciales.
    const { name: _name, ...fields } = toPlain(error.toJSON())
    return { ...fields, class: error.name, message: error.message }
  }
  if (error instanceof Error) {
    return { class: error.name, message: error.message }
  }
  return { class: typeof error, message: String(error) }
}

/**
 * Corre una llamada del SDK y junta todo lo que hace falta para mostrarla: el resultado
 * tipado, la respuesta cruda, el error y el log. Nunca lanza.
 *
 * `call` recibe las opciones que tiene que pasarle al método del SDK:
 *
 * ```ts
 * runStep((options) => sabre.booking.get({ confirmationId }, options))
 * ```
 */
export async function runStep<T>(
  call: (options: StepOptions) => Promise<T>
): Promise<StepResult<T>> {
  const log: LogLine[] = []
  let raw: SabreRawResponse | undefined
  const onRawResponse: SabreRawResponseCallback = (response) => {
    raw = response
  }

  const startedAt = performance.now()
  let result: T | undefined
  let error: StepError | undefined
  try {
    result = await captureLog(log, () => call({ onRawResponse }))
  } catch (thrown) {
    error = serializeError(thrown)
  }
  const durationMs = Math.round(performance.now() - startedAt)

  const captured: SabreRawResponse | undefined = raw
  return {
    ok: error === undefined,
    result: toPlain(result),
    raw:
      captured === undefined
        ? undefined
        : {
            ...captured,
            headers: Object.fromEntries(captured.headers.entries()),
          },
    error,
    log: toPlain(log),
    durationMs,
    attempts: captured?.attempts,
  }
}
