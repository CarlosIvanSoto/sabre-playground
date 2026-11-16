import type { FulfillTicketsRequest, VerifyTicketsRequest } from "sabre-client"
import { z } from "zod"
import type { ConsoleEnvironmentId } from "@/lib/environment"
import { optionalPcc } from "./queues.ts"

/**
 * La emisión de W4 (F16.2, #160): la receta probada en CERT (`emision-de-boletos`, S8) y la
 * regla por entorno. Puro y sin el SDK (solo tipos): lo usan la server action, la UI y los
 * tests.
 *
 * Solo `CASH`, ATPCO y una emisión por reserva. Fuera: tarjeta, EMD, NDC y LCC.
 */

/** Por qué no se emite en producción. Lo aplica el servidor, antes de llamar a Sabre. */
export const PROD_FULFILL_REASON =
  "Emitir no corre en producción: solo en CERT (o en fake). Cualquier Fulfill válido en producción emite de verdad."

/**
 * Si se puede emitir en el entorno: solo en CERT y en fake. `readOnly` es producción
 * (`EnvironmentOption.readOnly`); un entorno que no se conoce cuenta como producción.
 */
export function fulfillGate(
  id: ConsoleEnvironmentId,
  readOnly: boolean | undefined
): { ok: true } | { ok: false; reason: string } {
  if (id === "fake") return { ok: true }
  if (readOnly !== false) return { ok: false, reason: PROD_FULFILL_REASON }
  return { ok: true }
}

const confirmationId = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{6,}$/, "seis o más letras o dígitos")

const ticketNumber = z
  .string()
  .trim()
  .regex(/^[0-9]{13}$/)

export const fulfillSchema = z.object({
  confirmationId,
  /** El PCC IATA de emisión. Vacío: el de auth. */
  targetPcc: optionalPcc.optional(),
})

export type FulfillInput = z.input<typeof fulfillSchema>

/**
 * El request de S8, el mínimo que emitió en CERT: `CASH`, el perfil de impresora 1 solo (sin
 * `countryCode`) y comisión 0 %. `acceptPriceChanges` y `priceQuoteExpirationMethod` no se
 * mandan: quedan los defaults conservadores del SDK (`false` y `Quit`, ADR-019).
 */
export function buildFulfillRequest(
  input: z.infer<typeof fulfillSchema>
): FulfillTicketsRequest {
  return {
    confirmationId: input.confirmationId,
    ...(input.targetPcc === undefined ? {} : { targetPcc: input.targetPcc }),
    fulfillments: [
      {
        payment: { primaryFormOfPayment: 1 },
        ticketingQualifiers: { commissionPercentage: "0.00" },
      },
    ],
    formsOfPayment: [{ type: "CASH" }],
    designatePrinters: [{ profileNumber: 1 }],
  }
}

export const verifySchema = z.object({
  confirmationId,
  targetPcc: optionalPcc.optional(),
  /** Los `tickets` del `SabreUncertainOutcomeError`: si no están en el PNR, existen igual. */
  expectedTickets: z.array(ticketNumber).max(99).optional(),
})

export type VerifyInput = z.input<typeof verifySchema>

export function buildVerifyRequest(
  input: z.infer<typeof verifySchema>
): VerifyTicketsRequest {
  return {
    confirmationId: input.confirmationId,
    ...(input.targetPcc === undefined ? {} : { targetPcc: input.targetPcc }),
    ...(input.expectedTickets === undefined ||
    input.expectedTickets.length === 0
      ? {}
      : { expectedTickets: input.expectedTickets }),
  }
}

/** Un boleto del resultado de Fulfill o de Verify, en lo que la UI muestra. */
export interface TicketRow {
  number: string
  ticketStatusCode?: string
  ticketStatusName?: string
  isCommitted?: boolean
  date?: string
}

/** Los boletos de un resultado de `tickets.fulfill` o `tickets.verify`. */
export function ticketsOf(result: unknown): TicketRow[] {
  const tickets = (result as { tickets?: unknown } | undefined)?.tickets
  if (!Array.isArray(tickets)) return []
  return tickets.filter(
    (ticket): ticket is TicketRow =>
      typeof ticket === "object" &&
      ticket !== null &&
      typeof (ticket as TicketRow).number === "string"
  )
}

/** El `status` de un resultado de Fulfill (`issued`, `partial`) o de Verify. */
export function statusOf(result: unknown): string | undefined {
  const status = (result as { status?: unknown } | undefined)?.status
  return typeof status === "string" ? status : undefined
}

/**
 * Qué quiere decir cada `status` de `tickets.verify` (ADR-031). Se decide con la reserva, no con
 * `isTicketed`, que queda en `true` después del void.
 */
export const VERIFY_STATUS_TEXT: Record<string, string> = {
  issued:
    "La reserva tiene boletos vigentes (TE): la emisión se hizo. No se vuelve a emitir.",
  notCommitted:
    "Los boletos esperados no están en el PNR, pero existen (ghost ticket): no se vuelve a emitir.",
  notFound:
    "No hay boletos nuevos en la reserva: la emisión no se hizo. Volver a emitir es una decisión aparte, con su propia confirmación.",
}
