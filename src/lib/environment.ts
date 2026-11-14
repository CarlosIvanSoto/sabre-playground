/**
 * Los entornos que se eligen en la consola. CERT y producción vienen de `.env`; fake
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
  /**
   * El PCC IATA en el que se reserva y se emite (`SABRE_CERT_TICKETING_PCC`, F16.2). Solo CERT:
   * la UI lo propone como `targetPcc`, y se puede cambiar. No es una credencial.
   */
  ticketingPcc?: string
}
