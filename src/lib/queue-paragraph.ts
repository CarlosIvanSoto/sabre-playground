import { z } from "zod"

/**
 * Entradas del flujo 7 (párrafo de cola, F4.4). Las server actions las vuelven a validar.
 * Todo corre sin red: `parseQueueParagraph` y `resolveHostDate` son funciones puras del SDK.
 */

const isoDay = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD")

export const HOST_DATE_DIRECTIONS = ["past", "nearest"] as const

export const parseParagraphSchema = z.object({
  /** El párrafo tal cual, una línea por renglón (`QueueItem.paragraph`). */
  text: z.string().min(1, "falta el texto"),
  /** Contra qué día se resuelve el año de las fechas que no lo traen. */
  referenceDate: isoDay,
})

export type ParseParagraphInput = z.input<typeof parseParagraphSchema>

export const resolveHostDateSchema = z.object({
  /** `06SEP`, `06SEP26`, `12-21T07:00`, `2024-05-15T13:24`… */
  text: z.string().trim().min(1, "falta la fecha"),
  referenceDate: isoDay,
  direction: z.enum(HOST_DATE_DIRECTIONS),
})

export type ResolveHostDateInput = z.input<typeof resolveHostDateSchema>

/** Las líneas de un texto pegado, sin el fin de línea. Respeta la sangría. */
export function toLines(text: string): string[] {
  return text.replace(/\r\n?/g, "\n").replace(/\n$/, "").split("\n")
}

/** Hoy en el calendario del navegador, como `YYYY-MM-DD`. */
export function today(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/**
 * Un párrafo sintético, con el formato de host de un PNR: aviso PIC, nombre, un segmento aéreo,
 * uno no aéreo, ticketing y la firma. Pasajero `TEST/PASSENGER`, PCC y localizador inventados
 * (regla 5 de la consola).
 */
export const SAMPLE_PARAGRAPH = [
  "011  SEE REMARKS",
  " 1.1TEST/PASSENGER",
  " 1 DL2151E 20MAR 5 MIALGA HK1  0700  1003  /DCDL*HTDHAT /E",
  " 2  OTH ZZ 22APR Q GK1  MIA/RETENCION",
  "TKT/TIME LIMIT",
  "  1.T-13MAR-T3ST*AWS",
  "PHONES",
  "  1.MIA555-0100-A",
  "RECEIVED FROM - TEST",
  "T3ST.T3ST*AWS 1203/13FEB26 AAAAAA H",
].join("\n")
