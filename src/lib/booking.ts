import { z } from "zod"
import { optionalPcc } from "@/lib/queues"

/**
 * Entradas del flujo 4 (reserva suelta) y del paso de prueba de `runStep`. Las usan el
 * formulario y la server action: la action vuelve a validar, porque es un endpoint público.
 */

/** Localizador del PNR u Order ID, como lo pide Booking Management (`^[A-Z0-9]{6,}$`). */
const confirmationId = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{6,}$/, "seis o más letras o dígitos")

/** Apellido opcional: si no coincide con el PNR, Sabre responde `UNAUTHORIZED_ACCESS`. */
const surname = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z/ -]*$/, "solo letras")
  .optional()
  .transform((value) => (value === "" ? undefined : value))

/**
 * `targetPcc` opcional: el PCC en el que se lee o se cancela, si no es el de auth. Vacío es el
 * de auth. Lo usa la mesa de colas con su PCC de trabajo (F9.6, ADR-025).
 */
const targetPcc = optionalPcc.optional()

export const bookingGetSchema = z.object({
  confirmationId,
  surname,
  targetPcc,
})

export type BookingGetInput = z.input<typeof bookingGetSchema>

/**
 * Cancel siempre con `cancelAll: true` (ADR-014: alcance ATPCO, `cancelAll` o por vuelo).
 * `retrieveBooking` pide el estado posterior en la misma respuesta.
 */
export const bookingCancelSchema = z.object({
  confirmationId,
  targetPcc,
  retrieveBooking: z.boolean().default(false),
})

export type BookingCancelInput = z.input<typeof bookingCancelSchema>

/** Localizador sintético que no existe en CERT: termina en `BOOKING_NOT_FOUND`. */
export const MISSING_LOCATOR = "AAAAAA"
