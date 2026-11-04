import "server-only"

import { AsyncLocalStorage } from "node:async_hooks"
import type { SabreLogger, SabreLogLevel } from "sabre-client"

/** Una línea del logger del SDK. `context` llega ya redactado por `sabre-client`. */
export interface LogLine {
  /** ISO 8601. */
  at: string
  level: SabreLogLevel
  event: string
  context?: Record<string, unknown>
}

/**
 * El logger se fija al crear el cliente, y los clientes se comparten por entorno. Para que
 * cada paso tenga su propio log, las líneas van al buffer del paso en curso, que viaja con
 * el contexto asíncrono de la llamada. Así dos pasos concurrentes no se mezclan.
 */
const current = new AsyncLocalStorage<LogLine[]>()

/** Corre `fn` juntando en `lines` lo que el SDK registre durante la llamada. */
export function captureLog<T>(
  lines: LogLine[],
  fn: () => Promise<T>
): Promise<T> {
  return current.run(lines, fn)
}

function write(level: SabreLogLevel): SabreLogger[SabreLogLevel] {
  return (event, context) => {
    const lines = current.getStore()
    if (lines !== undefined) {
      lines.push({ at: new Date().toISOString(), level, event, context })
      return
    }
    // Fuera de un paso (p. ej. el ping de keepAlive), a la consola del servidor.
    console[level](`[sabre-client] ${event}`, context ?? {})
  }
}

/** Logger compartido por todos los clientes. */
export const sabreLogger: SabreLogger = {
  debug: write("debug"),
  info: write("info"),
  warn: write("warn"),
  error: write("error"),
}
