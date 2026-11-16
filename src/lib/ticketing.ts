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

/** Por qué no se anula en producción. */
export const PROD_VOID_REASON =
  "Anular boletos no corre en producción: solo en CERT (o en fake)."

type Gate = { ok: true } | { ok: false; reason: string }

/** Solo en CERT y en fake; un entorno que no se conoce cuenta como producción. */
function ticketingGate(
  id: ConsoleEnvironmentId,
  readOnly: boolean | undefined,
  reason: string
): Gate {
  if (id === "fake") return { ok: true }
  if (readOnly !== false) return { ok: false, reason }
  return { ok: true }
}

/**
 * Si se puede emitir en el entorno. `readOnly` es producción (`EnvironmentOption.readOnly`). Lo
 * aplica la server action antes de llamar a Sabre.
 */
export function fulfillGate(
  id: ConsoleEnvironmentId,
  readOnly: boolean | undefined
): Gate {
  return ticketingGate(id, readOnly, PROD_FULFILL_REASON)
}

/** Si se puede anular (`booking.cancel` con `VOID`) en el entorno. Igual que emitir. */
export function voidGate(
  id: ConsoleEnvironmentId,
  readOnly: boolean | undefined
): Gate {
  return ticketingGate(id, readOnly, PROD_VOID_REASON)
}

/**
 * Los boletos vigentes de una reserva (Get Booking): los `flightTickets` en `TE`. Se mira el
 * `ticketStatusCode`, no `isTicketed`, que queda en `true` después del void (S8). El void solo se
 * ofrece si hay alguno.
 */
export function liveTicketsOf(booking: unknown): string[] {
  const tickets = (booking as { flightTickets?: unknown } | undefined)
    ?.flightTickets
  if (!Array.isArray(tickets)) return []
  return tickets
    .filter(
      (ticket): ticket is { number: string; ticketStatusCode: string } =>
        typeof ticket === "object" &&
        ticket !== null &&
        typeof (ticket as { number?: unknown }).number === "string" &&
        (ticket as { ticketStatusCode?: unknown }).ticketStatusCode === "TE"
    )
    .map((ticket) => ticket.number)
}

/**
 * De los boletos que se anularon, los que la reserva (Get Booking) **no** muestra en `TV`: siguen
 * en `TE`, o ya no aparecen. Vacío quiere decir que el void quedó en el PNR (S8: se mira el
 * `ticketStatusCode`, no `isTicketed`).
 */
export function notVoidedOf(
  booking: unknown,
  expected: readonly string[]
): string[] {
  const tickets = (booking as { flightTickets?: unknown } | undefined)
    ?.flightTickets
  const status = new Map<string, unknown>()
  if (Array.isArray(tickets)) {
    for (const ticket of tickets) {
      if (typeof ticket === "object" && ticket !== null) {
        const { number, ticketStatusCode } = ticket as {
          number?: unknown
          ticketStatusCode?: unknown
        }
        if (typeof number === "string") status.set(number, ticketStatusCode)
      }
    }
  }
  return expected.filter((number) => status.get(number) !== "TV")
}

/** Los `flightTickets` de una reserva (Get Booking), en lo que la UI muestra. */
export function bookingTicketsOf(booking: unknown): TicketRow[] {
  const tickets = (booking as { flightTickets?: unknown } | undefined)
    ?.flightTickets
  return ticketsOf({ tickets })
}

/** Los números de `voidedTickets` de un resultado de Cancel Booking. */
export function voidedTicketsOf(result: unknown): string[] {
  const voided = (result as { voidedTickets?: unknown } | undefined)
    ?.voidedTickets
  return Array.isArray(voided)
    ? voided.filter((n): n is string => typeof n === "string")
    : []
}

/**
 * Qué quiere decir `tickets.verify` después de un void incierto: con boletos `TE` el void no se
 * hizo; sin ellos, sí (quedaron en `TV`).
 */
export const VOID_VERIFY_STATUS_TEXT: Record<string, string> = {
  issued:
    "La reserva sigue con boletos vigentes (TE): el void no se hizo. Volver a anular es una decisión aparte, con su confirmación.",
  notCommitted:
    "Hay boletos que existen y no están en el PNR: revisa la reserva antes de hacer nada.",
  notFound:
    "La reserva ya no tiene boletos vigentes: el void se hizo (quedaron en TV). No se vuelve a anular.",
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
