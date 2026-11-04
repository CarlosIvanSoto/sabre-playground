import "server-only"

import {
  SabreError,
  type SabreRawResponse,
  type SabreRawResponseCallback,
} from "sabre-client"
import { captureLog, type LogLine } from "@/server/sabre/log"

/** `SabreRawResponse` con los headers como objeto, para que viaje en el payload. */
export interface RawResponse extends Omit<SabreRawResponse, "headers"> {
  headers: Record<string, string>
}

/** Error serializado: clase y campos públicos. Nunca `raw`. */
export interface StepError {
  /** `SabreBusinessError`, `SabreGatewayError`, `TypeError`… */
  class: string
  message: string
  code?: string
  retryable?: boolean
  status?: number
  protocol?: string
  service?: string
  kind?: string
  warnings?: unknown[]
  errors?: unknown[]
}

export interface StepResult<T> {
  ok: boolean
  /** Lo que devolvió el SDK, si no lanzó. */
  result?: T
  /** Body del último intento HTTP, también cuando la llamada lanza. */
  raw?: RawResponse
  error?: StepError
  /** Lo que el SDK mandó al logger durante la llamada, ya redactado. */
  log: LogLine[]
  durationMs: number
  /** Intentos HTTP, contando los reintentos. Sin respuesta HTTP no se sabe. */
  attempts?: number
}

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
