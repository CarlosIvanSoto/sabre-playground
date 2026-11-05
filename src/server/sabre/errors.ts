import "server-only"

import { SabreBusinessError, SabreError, SabreSessionError } from "sabre-client"

/**
 * Guards de los errores del SDK que no dependen solo de `instanceof`. En `pnpm dev`, los
 * clientes guardados en `globalThis` sobreviven a la recarga en caliente con las clases de
 * una evaluación anterior de `sabre-client`, y ahí `instanceof` da `false` (Q-083 en el
 * wiki). Se cae a comparar `name`, que el SDK fija en cada clase.
 */

export function isSabreError(error: unknown): error is SabreError {
  if (error instanceof SabreError) return true
  return (
    error instanceof Error &&
    error.name.startsWith("Sabre") &&
    typeof (error as Partial<SabreError>).toJSON === "function"
  )
}

export function isSabreBusinessError(
  error: unknown
): error is SabreBusinessError {
  return (
    error instanceof SabreBusinessError ||
    (isSabreError(error) && error.name === "SabreBusinessError")
  )
}

export function isSabreSessionError(
  error: unknown
): error is SabreSessionError {
  return (
    error instanceof SabreSessionError ||
    (isSabreError(error) && error.name === "SabreSessionError")
  )
}
