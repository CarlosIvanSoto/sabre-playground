import type { QueueActivityCounters, QueueRef } from "sabre-client"
import { z } from "zod"

/**
 * Entradas del flujo 6 (colas, F4.3). Los formularios trabajan con texto; las server actions
 * vuelven a validar con estos mismos esquemas y reciben ya el `QueueRef` del SDK. Este módulo
 * lo usan el cliente y el servidor, y del SDK solo importa tipos.
 */

/** Una cola como texto: `9` (0–511), una alfabética (`S`) o un nombre (`HOTELS`). */
export const QUEUE_PATTERN = /^(\d{1,3}|[A-Z][A-Z0-9]{0,9})$/

/**
 * Cola alfabética: una o dos letras mayúsculas, como la valida el SDK (ADR-028). La de mensajes
 * es la `S`: el SDK exporta `MESSAGE_QUEUE` e `isMessageQueue` desde la 0.5.1. La consola no
 * los necesita: los pasos distinguen el mensaje por `step.kind`.
 */
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

export const queueActivitySchema = z.object({ pcc: optionalPcc })
export type QueueActivityInput = z.input<typeof queueActivitySchema>
export type QueueActivityOutput = z.output<typeof queueActivitySchema>

/**
 * Los ocho contadores de `queue.activity` (el `QA` del host), en el orden del SDK, con cómo se
 * nombran en la mesa (singular y plural). Nadie sabe desde cuándo cuentan (Q-097): la consola
 * los muestra sin interpretarlos.
 */
export const ACTIVITY_COUNTERS = [
  {
    key: "numMessages",
    words: ["en cola", "en cola"],
    label: "NumMessages: hoy en la cola",
  },
  {
    key: "ended",
    words: ["terminado", "terminados"],
    label: "Ended: terminados",
  },
  {
    key: "ignored",
    words: ["ignorado", "ignorados"],
    label: "Ignored: ignorados",
  },
  {
    key: "moved",
    words: ["movido", "movidos"],
    label: "Moved: movidos a otra cola",
  },
  {
    key: "removed",
    words: ["sacado", "sacados"],
    label: "Removed: sacados (QR)",
  },
  {
    key: "transferred",
    words: ["transferido", "transferidos"],
    label: "Transferred: transferidos",
  },
  {
    key: "leftMessageToContact",
    words: ["con mensaje", "con mensaje"],
    label: "LeftMessageToContact: con mensaje al contacto",
  },
  {
    key: "unableToReach",
    words: ["sin contactar", "sin contactar"],
    label: "UnableToReach: sin contactar",
  },
] as const satisfies readonly {
  key: keyof QueueActivityCounters
  words: readonly [string, string]
  label: string
}[]

/** Una fila del editor de `selection`, como texto: el código y su valor. */
export interface SelectionRow {
  function: string
  criteria: string
}

/**
 * `selection` de `access` y `list` (F13.1, F13.2): la lista de filas del editor. Solo pasa a
 * mayúsculas, quita los espacios y descarta las filas que quedaron vacías del todo. No valida
 * códigos, valores ni cantidad: eso lo hace el SDK, y su `TypeError` (más de 8 filtros, un
 * valor vacío o, en `list`, un código que no es `QD` ni `AK`) se ve como el error del paso.
 * Sin filas da `undefined`: la llamada queda como sin filtro.
 */
export const queueSelection = z
  .array(z.object({ function: z.string(), criteria: z.string() }))
  .optional()
  .transform((rows) => {
    const selection = (rows ?? [])
      .map((row) => ({
        function: row.function.trim().toUpperCase(),
        criteria: row.criteria.trim().toUpperCase(),
      }))
      .filter((row) => row.function !== "" || row.criteria !== "")
    return selection.length > 0 ? selection : undefined
  })

/**
 * La ayuda corta del editor: los códigos que más se usan al entrar a una cola, de la lista de
 * Sabre (`wiki/sources/funciones-de-seleccion-de-colas`). Hay muchos más.
 */
export const SELECTION_CODES = [
  { code: "QD", meaning: "fecha de colocación en la cola", example: "05NOV" },
  { code: "AL", meaning: "aerolínea", example: "DL" },
  { code: "AC", meaning: "código de acción o estado", example: "HL" },
  { code: "PI", meaning: "código PIC", example: "11" },
  {
    code: "AK",
    meaning: "agente que lo colocó (PCC + firma)",
    example: "PCC1AAT",
  },
] as const

export const queueListSchema = z.object({
  queue: queueRef,
  pcc: optionalPcc,
  primaryPassenger: z.boolean(),
  selection: queueSelection,
})
export type QueueListInput = z.input<typeof queueListSchema>
export type QueueListOutput = z.output<typeof queueListSchema>

export const queueAccessSchema = z.object({
  queue: queueRef,
  pcc: optionalPcc,
  selection: queueSelection,
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
