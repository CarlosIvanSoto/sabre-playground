/**
 * Lo que muestra el flujo de autenticación. Datos planos, sin el valor del token: viajan al
 * cliente en el payload de las server actions.
 */

/** De dónde salió el token que usó la llamada. */
export type TokenSource =
  /** El SDK pidió uno a OAuth Token Create (`sabre.auth.token.refresh`). */
  | "nuevo"
  /** El SDK lo leyó de `.sabre-token.json`, sin pedir uno. */
  | "archivo"
  /** El SDK lo tenía en memoria: no pidió ni leyó el store. */
  | "memoria"

export interface TokenInfo {
  authVersion: "v3" | "v2"
  source: TokenSource
  /** `reason` de `sabre.auth.token.refresh`: `initial`, `proactive` o `reactive`. */
  refreshReason?: string
  /** `expiresIn` de `sabre.auth.token.refresh`, en segundos. */
  expiresIn?: number
  /** ISO 8601, del último token que pasó por el store. */
  obtainedAt?: string
  /** ISO 8601, del último token que pasó por el store. */
  expiresAt?: string
  /** Sabre rechazó el token con 401 y el SDK reintentó con uno nuevo. */
  retriedAfter401: boolean
  /** La llamada que se usó para que el SDK pida el token. */
  probe: { method: "booking.get"; confirmationId: string; outcome: string }
}

export interface InvalidateResult {
  /** Se descartó el cliente REST, con su token en memoria. */
  clientRecreated: true
  /**
   * Se dejó en `.sabre-token.json` un token que Sabre rechaza, para que la siguiente llamada
   * termine en 401 y en un refresco reactivo. `false` si la consola todavía no conoce la clave
   * del store: entonces la siguiente llamada busca el token en el archivo o pide uno nuevo.
   */
  invalidTokenPlanted: boolean
}

/** Localizador sintético que no existe en CERT: `booking.get` termina en `BOOKING_NOT_FOUND`. */
export const PROBE_LOCATOR = "AAAAAA"
