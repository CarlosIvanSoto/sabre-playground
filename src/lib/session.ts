import type { QueueState } from "sabre-client"
import type { ConsoleEnvironmentId } from "@/lib/environment"

/**
 * Lo que ve el cliente de la sesión SOAP de un entorno: nunca el token ni el
 * `ConversationId`. Este módulo no es `server-only` y solo importa tipos.
 */
export type SessionStatus =
  | { open: false; environment: ConsoleEnvironmentId }
  | {
      open: true
      environment: ConsoleEnvironmentId
      /** ISO 8601. */
      openedAt: string
      keepAlive: boolean
      /** PCC de la sesión, el default de las colas. */
      pcc: string
      /** `session.idleMs` al armar el estado: ms desde la última respuesta de Sabre. */
      idleMs: number
      /** Cuándo se tomó `idleMs` (ISO 8601), para que el contador siga en el navegador. */
      at: string
      queueState: QueueState
    }

/** Sabre cierra una sesión inactiva a los 15 minutos (en la práctica, entre 16 y 31). */
export const SESSION_IDLE_LIMIT_MS = 15 * 60 * 1000
