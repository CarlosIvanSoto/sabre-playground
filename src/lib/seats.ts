import { z } from "zod"

/** Entrada del flujo 3 (asientos de un PNR). La server action la vuelve a validar. */
export const seatsByPnrSchema = z.object({
  /** `SeatAvailabilityByPnrLocatorRq.pnrLocator`: seis letras (`^[A-Z]{6}$`). */
  pnrLocator: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{6}$/, "seis letras"),
})

export type SeatsByPnrInput = z.input<typeof seatsByPnrSchema>
