import type { SabreUncertainOutcomeReason } from "sabre-client"
import type {
  QueueFakeDownlineCause,
  QueueFakeFulfillOutcome,
  QueueFakeTicketing,
  QueueFakeVoidOutcome,
} from "sabre-client/testing"
import { z } from "zod"

/**
 * Los desenlaces que se pueden forzar en el fake para la emisión y el void (F16.6, #164), con
 * `ticketing` de `createQueueFake` (sabre-client 0.7.0). Lo usan el panel del fake, la server
 * action que lo rearma y los tests. Del SDK solo importa tipos.
 *
 * El fake copia la lista de desenlaces al crearse y no la deja cambiar después: elegir otro
 * desenlace es rearmar el fake (colas, reservas y ventas vuelven a como se sembraron).
 */

/** El PCC de las credenciales del fake: las ventas del día se siembran para él. */
export const FAKE_PCC = "TEST"

/** Reserva sembrada sin boletos, para emitir. */
export const FAKE_BOOKING_OPEN = "BBBBBA"

/** Reserva sembrada con un boleto `TE`, para anular sin emitir antes. */
export const FAKE_BOOKING_TICKETED = "BBBBBB"

/** El boleto de `FAKE_BOOKING_TICKETED`. Sintético. */
export const FAKE_TICKET = "0010000000001"

/** Los `reason` de `SabreUncertainOutcomeError` que el fake fuerza en la emisión. */
export const FULFILL_UNCERTAIN_REASONS = [
  "UNABLE_TO_RETRIEVE_TICKETS",
  "FULFILLMENT_NOT_CONFIRMED",
  "INTERNAL_SERVER_TIMEOUT",
  "DOWNLINE_SERVICE_ERROR",
  "PAYMENT_CARD_ISSUE",
  "NOT_COMMITTED",
  "TRANSPORT",
  "GATEWAY_5XX",
  "UNPARSEABLE",
  "ABORTED",
] as const satisfies readonly Exclude<
  SabreUncertainOutcomeReason,
  "END_TRANSACTION_PROBLEM"
>[]

/** Los `reason` que el fake fuerza en el void. */
export const VOID_UNCERTAIN_REASONS = [
  "END_TRANSACTION_PROBLEM",
  "TRANSPORT",
  "GATEWAY_5XX",
  "UNPARSEABLE",
  "ABORTED",
] as const satisfies readonly SabreUncertainOutcomeReason[]

/** Los `DOWNLINE_SERVICE_ERROR` de configuración vistos en CERT, con su texto real. */
export const DOWNLINE_CAUSES = [
  "INVALID_TICKET_STOCK",
  "COMMISSION_REQUIRED",
  "HARDCOPY_PRINTER",
  "SECURE_FLIGHT",
] as const satisfies readonly QueueFakeDownlineCause[]

/** Errores del catálogo de Fulfill que no emiten. */
export const FULFILL_ERRORS = ["BOOKING_FULFILLED", "PRICE_MISMATCH"] as const

export interface OutcomeOption {
  value: string
  label: string
  /** Si es un incierto: ahí aplica «¿se hizo de verdad?». */
  uncertain?: boolean
}

/** Sin forzar: lo que hace el fake solo (emitir, o `BOOKING_FULFILLED` si ya hay boleto). */
export const DEFAULT_OUTCOME = "default"

export const FULFILL_OPTIONS: readonly OutcomeOption[] = [
  { value: DEFAULT_OUTCOME, label: "Sin forzar (emite, o BOOKING_FULFILLED)" },
  { value: "issued", label: "issued: emite un boleto TE" },
  { value: "partial", label: "partial: emite con PARTIAL_FULFILLMENT" },
  ...FULFILL_UNCERTAIN_REASONS.map((reason) => ({
    value: `uncertain:${reason}`,
    label: `incierto: ${reason}`,
    uncertain: true,
  })),
  ...DOWNLINE_CAUSES.map((cause) => ({
    value: `downline:${cause}`,
    label: `DOWNLINE_SERVICE_ERROR: ${cause}`,
  })),
  ...FULFILL_ERRORS.map((code) => ({
    value: `error:${code}`,
    label: `error: ${code}`,
  })),
]

export const VOID_OPTIONS: readonly OutcomeOption[] = [
  { value: DEFAULT_OUTCOME, label: "Sin forzar (anula los boletos TE)" },
  { value: "voided", label: "voided: anula y cancela" },
  ...VOID_UNCERTAIN_REASONS.map((reason) => ({
    value: `uncertain:${reason}`,
    label: `incierto: ${reason}`,
    uncertain: true,
  })),
]

/** En un incierto, si la operación quedó hecha de verdad. `default` deja el del fake. */
export const DONE_OPTIONS = [
  { value: "default", label: "Lo que diga el fake" },
  { value: "yes", label: "Sí, quedó hecha" },
  { value: "no", label: "No, no se hizo" },
] as const

const values = (options: readonly OutcomeOption[]) =>
  options.map((option) => option.value) as [string, ...string[]]

const done = z.enum(["default", "yes", "no"])

export const fakeTicketingSchema = z.object({
  fulfill: z.enum(values(FULFILL_OPTIONS)),
  fulfillDone: done,
  void: z.enum(values(VOID_OPTIONS)),
  voidDone: done,
})

export type FakeTicketingInput = z.input<typeof fakeTicketingSchema>

export const DEFAULT_FAKE_TICKETING: FakeTicketingInput = {
  fulfill: DEFAULT_OUTCOME,
  fulfillDone: "default",
  void: DEFAULT_OUTCOME,
  voidDone: "default",
}

function doneFlag(value: z.infer<typeof done>): boolean | undefined {
  return value === "default" ? undefined : value === "yes"
}

function fulfillOutcome(
  value: string,
  isDone: boolean | undefined
): QueueFakeFulfillOutcome | undefined {
  if (value === DEFAULT_OUTCOME) return undefined
  if (value === "issued" || value === "partial") return value
  const [kind, detail] = value.split(":") as [string, string]
  switch (kind) {
    case "uncertain":
      return {
        uncertain: detail as (typeof FULFILL_UNCERTAIN_REASONS)[number],
        ...(isDone === undefined ? {} : { issued: isDone }),
      }
    case "downline":
      return { downline: detail as QueueFakeDownlineCause }
    case "error":
      return { error: detail }
  }
  throw new Error(`desenlace desconocido: ${value}`)
}

function voidOutcome(
  value: string,
  isDone: boolean | undefined
): QueueFakeVoidOutcome | undefined {
  if (value === DEFAULT_OUTCOME) return undefined
  if (value === "voided") return value
  const [kind, detail] = value.split(":") as [string, string]
  if (kind === "uncertain") {
    return {
      uncertain: detail as (typeof VOID_UNCERTAIN_REASONS)[number],
      ...(isDone === undefined ? {} : { voided: isDone }),
    }
  }
  throw new Error(`desenlace desconocido: ${value}`)
}

/**
 * Lo elegido, como `ticketing` de `createQueueFake`: el desenlace de la **siguiente** emisión y
 * del **siguiente** void. Después, el fake vuelve a lo que hace sin forzar.
 */
export function toFakeTicketing(
  input: z.infer<typeof fakeTicketingSchema>
): QueueFakeTicketing {
  const fulfill = fulfillOutcome(input.fulfill, doneFlag(input.fulfillDone))
  const voided = voidOutcome(input.void, doneFlag(input.voidDone))
  return {
    ...(fulfill === undefined ? {} : { fulfill: [fulfill] }),
    ...(voided === undefined ? {} : { void: [voided] }),
  }
}
