import type {
  DailySalesSummaryResult,
  DailySalesTransaction,
} from "sabre-client"
import { z } from "zod"
import { optionalPcc } from "./queues.ts"

/**
 * Las ventas del día (F16.5, #163): `session.reporting.dailySalesSummary` (ADR-030). Es una
 * lectura: corre en CERT y en producción. Puro y sin el SDK (solo tipos): lo usan la server
 * action, la vista y los tests.
 */

export const dailySalesSchema = z.object({
  /** PCC del reporte. Vacío: el home PCC del token. Otro PCC necesita Branch Access. */
  pcc: optionalPcc.optional(),
  /** `YYYY-MM-DD`. Vacía: el día en curso. Una sola fecha. */
  date: z
    .string()
    .trim()
    .refine((value) => value === "" || /^\d{4}-\d{2}-\d{2}$/.test(value), {
      message: "YYYY-MM-DD",
    })
    .transform((value) => (value === "" ? undefined : value))
    .optional(),
})

export type DailySalesInput = z.input<typeof dailySalesSchema>

/**
 * Una venta anulada: el void no agrega una transacción, deja el `SALE` con
 * `documentStatusCode: 'V'` (CERT, 2026-11-12/13). No aparece en `totals`.
 */
export function isVoided(transaction: DailySalesTransaction): boolean {
  return transaction.documentStatusCode === "V"
}

/** Cuántas transacciones hay, cuántas están anuladas y cuántas siguen vigentes. */
export function salesCounts(transactions: readonly DailySalesTransaction[]): {
  total: number
  voided: number
  live: number
} {
  const voided = transactions.filter(isVoided).length
  return {
    total: transactions.length,
    voided,
    live: transactions.length - voided,
  }
}

/**
 * Qué decir de cada `status`. Solo `complete` es el día entero: un `incomplete` o un `deferred`
 * no es un reporte vacío.
 */
export const SALES_STATUS_TEXT: Record<
  DailySalesSummaryResult["status"],
  string
> = {
  complete: "El reporte del día está entero.",
  incomplete:
    "Sabre no pudo leer algunos documentos (failedDocuments): faltan transacciones. No es el día entero.",
  deferred:
    "Sabre dejó el reporte en caché o todavía lo está armando: vuelve a pedirlo más tarde. No es un reporte vacío.",
}

/** El resultado, si tiene la forma de `DailySalesSummaryResult`. */
export function dailySalesOf(
  result: unknown
): DailySalesSummaryResult | undefined {
  const value = result as Partial<DailySalesSummaryResult> | undefined
  if (
    value === undefined ||
    typeof value.status !== "string" ||
    !Array.isArray(value.transactions)
  ) {
    return undefined
  }
  return value as DailySalesSummaryResult
}
