import type { QueueRef } from "sabre-client"
import { z } from "zod"

/**
 * Entradas del flujo 6 (colas, F4.3). Los formularios trabajan con texto; las server actions
 * vuelven a validar con estos mismos esquemas y reciben ya el `QueueRef` del SDK. Este módulo
 * lo usan el cliente y el servidor, y del SDK solo importa tipos.
 */

/** Una cola como texto: `9` (0–511), una alfabética (`S`) o un nombre (`HOTELS`). */
export const QUEUE_PATTERN = /^(\d{1,3}|[A-Z][A-Z0-9]{0,9})$/

/**
 * La cola de mensajes del PCC (ADR-028): trae mensajes, no PNR, y Sabre no la lista. El SDK
 * no exporta su constante, así que la consola la nombra acá.
 */
export const MESSAGE_QUEUE = "S"

/** Cola alfabética: una o dos letras mayúsculas, como la valida el SDK (ADR-028). */
const ALPHA_QUEUE = /^[A-Z]{1,2}$/

/**
 * `"9"` → `9`, `"s"` → `"S"`, `"hotels"` → `{ name: "HOTELS" }`. `undefined` si no es una
 * cola válida.
 */
export function parseQueueRef(text: string): QueueRef | undefined {
  const value = text.trim().toUpperCase()
  if (!QUEUE_PATTERN.test(value)) return undefined
  if (/^\d+$/.test(value)) {
    const number = Number(value)
    return number <= 511 ? number : undefined
  }
  return ALPHA_QUEUE.test(value) ? value : { name: value }
}

/** Lo contrario de `parseQueueRef`: para mostrar y para la ruta. */
export function formatQueueRef(queue: QueueRef): string {
  if (typeof queue === "number") return String(queue)
  return typeof queue === "string" ? queue : queue.name
}

export const queueRef = z.string().transform((text, context) => {
  const ref = parseQueueRef(text)
  if (ref === undefined) {
    context.addIssue({ code: "custom", message: "0–511 o un nombre (S)" })
    return z.NEVER
  }
  return ref
})

/** PCC opcional: vacío es el de la sesión. */
export const optionalPcc = z
  .string()
  .trim()
  .toUpperCase()
  .refine((value) => value === "" || /^[A-Z0-9]{3,4}$/.test(value), {
    message: "3 o 4 caracteres alfanuméricos",
  })
  .transform((value) => (value === "" ? undefined : value))

export const PCC_PATTERN = /^[A-Z0-9]{3,4}$/

/** PIC (`PrefatoryInstructionCode`): 0–191 o 200–254. Obligatorio en `place`. */
export const instructionCode = z.coerce
  .number({ error: "un número" })
  .int("un entero")
  .refine((n) => (n >= 0 && n <= 191) || (n >= 200 && n <= 254), {
    message: "0–191 o 200–254",
  })

/** PIC por defecto en los formularios: 11, "SEE REMARKS". */
export const DEFAULT_INSTRUCTION_CODE = 11

/** Hasta 6 localizadores separados por coma o espacio. Vacío: ninguno. */
export const locatorList = z
  .string()
  .transform((text) =>
    text
      .toUpperCase()
      .split(/[\s,]+/)
      .filter((value) => value !== "")
  )
  .pipe(
    z
      .array(z.string().regex(/^[A-Z0-9]{6}$/, "seis caracteres"))
      .max(6, "hasta 6")
  )

/**
 * El desbloqueo de `remove` y `place` (y `process` con esas acciones). Solo cuenta en
 * producción: ahí la server action rechaza la escritura si no llega en `true`.
 */
const unlock = z.boolean().default(false)

export const queueCountSchema = z.object({ pcc: optionalPcc })
export type QueueCountInput = z.input<typeof queueCountSchema>
export type QueueCountOutput = z.output<typeof queueCountSchema>

export const queueListSchema = z.object({
  queue: queueRef,
  pcc: optionalPcc,
  primaryPassenger: z.boolean(),
})
export type QueueListInput = z.input<typeof queueListSchema>
export type QueueListOutput = z.output<typeof queueListSchema>

export const queueAccessSchema = z.object({
  queue: queueRef,
  pcc: optionalPcc,
})
export type QueueAccessInput = z.input<typeof queueAccessSchema>
export type QueueAccessOutput = z.output<typeof queueAccessSchema>

/** `remove`: sin colas sale de la cola en curso; con 1 a 3, de esas a la vez. */
export const queueRemoveSchema = z.object({
  from: z
    .string()
    .transform((text, context) => {
      const parts = text
        .split(/[\s,]+/)
        .filter((value) => value !== "")
        .map(parseQueueRef)
      if (parts.some((part) => part === undefined)) {
        context.addIssue({ code: "custom", message: "0–511 o un nombre (S)" })
        return z.NEVER
      }
      return parts as QueueRef[]
    })
    .pipe(z.array(z.custom<QueueRef>()).max(3, "hasta 3 colas")),
  unlock,
})
export type QueueRemoveInput = z.input<typeof queueRemoveSchema>
export type QueueRemoveOutput = z.output<typeof queueRemoveSchema>

export const queuePlaceSchema = z.object({
  queue: queueRef,
  pcc: optionalPcc,
  instructionCode,
  /** Fuera de una cola: los PNR a colocar. Dentro, va vacío (se coloca el PNR actual). */
  locators: locatorList,
  unlock,
})
export type QueuePlaceInput = z.input<typeof queuePlaceSchema>
export type QueuePlaceOutput = z.output<typeof queuePlaceSchema>

export const PROCESS_ACTIONS = ["ignore", "remove", "place"] as const

export const queueProcessSchema = z
  .object({
    queue: queueRef,
    pcc: optionalPcc,
    /** Tope de PNR. `process` no tiene tope por defecto; la consola siempre pone uno. */
    limit: z.coerce.number().int().min(1).max(50),
    action: z.enum(PROCESS_ACTIONS),
    /** Solo con `place`: la cola de destino y su PIC. */
    toQueue: z.string(),
    toInstructionCode: z.string(),
    unlock,
  })
  .superRefine((value, context) => {
    if (value.action !== "place") return
    if (parseQueueRef(value.toQueue) === undefined) {
      context.addIssue({
        code: "custom",
        path: ["toQueue"],
        message: "0–511 o un nombre (S)",
      })
    }
    if (!instructionCode.safeParse(value.toInstructionCode).success) {
      context.addIssue({
        code: "custom",
        path: ["toInstructionCode"],
        message: "0–191 o 200–254",
      })
    }
  })
export type QueueProcessInput = z.input<typeof queueProcessSchema>
export type QueueProcessOutput = z.output<typeof queueProcessSchema>

/** Lo que el recorrido de `process` hizo con cada PNR, para el resultado. */
export interface ProcessVisit {
  locator: string
  action: (typeof PROCESS_ACTIONS)[number]
}
