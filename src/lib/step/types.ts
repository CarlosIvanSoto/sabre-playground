import type { SabreLogLevel, SabreRawResponse } from "sabre-client"
import type { ConsoleEnvironmentId } from "@/lib/environment"

/**
 * Lo que devuelve `runStep()` y recibe el `StepPanel`. Son datos planos (JSON): viajan del
 * servidor al cliente en el payload de las server actions. Este módulo no es `server-only`
 * y solo importa tipos, así que el SDK no entra al bundle del cliente.
 */

/** Una línea del logger del SDK. `context` llega ya redactado por `sabre-client`. */
export interface LogLine {
  /** ISO 8601. */
  at: string
  level: SabreLogLevel
  event: string
  context?: Record<string, unknown>
}

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

export interface StepResult<T = unknown> {
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

/**
 * Lo que devuelve una server action de un paso: el `StepResult`, o la razón por la que el
 * paso no se pudo correr (entorno sin credenciales, config inválida). En el segundo caso
 * no hubo llamada al SDK. `environment` es el entorno contra el que corrió; falta si el que
 * pidió el cliente no era válido.
 */
export type StepRun<T = unknown> = (
  | { enabled: true; step: StepResult<T> }
  | { enabled: false; reason: string }
) & { environment?: ConsoleEnvironmentId }
