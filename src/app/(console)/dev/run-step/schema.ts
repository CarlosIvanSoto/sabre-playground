import { z } from "zod"

/** Localizador de 6 letras o dígitos, como los de Sabre. */
export const bookingGetSchema = z.object({
  confirmationId: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{6}$/, "seis letras o dígitos"),
})

export type BookingGetInput = z.input<typeof bookingGetSchema>

/** Localizador sintético que no existe en CERT: termina en `BOOKING_NOT_FOUND`. */
export const MISSING_LOCATOR = "AAAAAA"
