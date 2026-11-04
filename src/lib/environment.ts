/**
 * Los entornos que se eligen en la consola. CERT y producción vienen de `.env.local`; fake
 * corre sin red ni credenciales, con `createQueueFake` de `sabre-client/testing`.
 *
 * Este módulo lo usan el cliente y el servidor: no lleva credenciales ni valores.
 */

export const ENVIRONMENT_IDS = ["cert", "prod", "fake"] as const

export type ConsoleEnvironmentId = (typeof ENVIRONMENT_IDS)[number]

export const DEFAULT_CONSOLE_ENVIRONMENT: ConsoleEnvironmentId = "cert"

/** Lo que ve el cliente de cada entorno. */
export interface EnvironmentOption {
  id: ConsoleEnvironmentId
  label: string
  /** Producción: sin Create ni Cancel Booking, y colas con confirmación explícita. */
  readOnly: boolean
  enabled: boolean
  /** Por qué está deshabilitado. */
  reason?: string
}
