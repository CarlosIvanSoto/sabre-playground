import type { BookingTraits, CensusPic } from "./census-traits.ts"
import { TRAIT_PATTERNS as P } from "./census-traits.ts"
import type { QueueCensus } from "./queue-census.ts"

/**
 * La exportación del censo (F10.3, #97; ADR-026, "Forma del censo" y "Validación que falla
 * cerrada"): el formato `queue-census/1` y su validador.
 *
 * El validador recorre el JSON entero contra un esquema cerrado: cada objeto con sus claves
 * exactas, cada valor con su tipo y su expresión. Además:
 * - ninguna cadena con forma de localizador fuera de `pnr`, ni un localizador leído dentro de otra;
 * - ningún PCC conocido en ningún valor ni clave;
 * - `pnr` coincide con un localizador que leyó la consola;
 * - los textos PIC no tienen forma de nombre, y las líneas del anexo están enmascaradas.
 * Si algo falla, el censo no se exporta y se dice qué campo de qué PNR.
 *
 * El JSON se descarga o se copia; nunca se escribe en el repo (`.gitignore` cubre
 * `censo-colas-*.json`). Este módulo no importa nada de la app con `@/`, para que sus tests corran
 * con `node --test`, sin bundler.
 */

export const CENSUS_SCHEMA = "queue-census/1"

/** De dónde sale `takenAt`: el reloj del servidor de la consola, en UTC (ADR-026). */
export const TAKEN_AT_SOURCE = "console-server-clock-utc"

/** El alias del PCC en el censo: nunca el PCC real. */
export const ALIAS_PATTERN = /^P[0-9]{1,2}$/

export interface CensusExportItem {
  ref: string
  pnr: string
  pics: CensusPic[]
  placedAgeHours: number | null
  placedBySameAsWorkingPcc: boolean | null
  parseOk: boolean
  unparsedLines: number | null
  booking: BookingTraits | null
  bookingError: string | null
  /** El usuario lo marcó: su párrafo enmascarado va en `annex`. */
  flagged: boolean
}

export interface CensusExportQueue {
  queue: number
  count: number
  sampled: number
  /** `null` si el censo paró antes de llegar a la cola. */
  ended: "end-of-display" | "empty" | "limit" | "error" | null
  items: CensusExportItem[]
}

export interface CensusAnnexParagraph {
  ref: string
  pnr: string
  /** El párrafo con la regla de #96: lista blanca tal cual, el resto con letras a X y dígitos a 9. */
  lines: string[]
}

export interface QueueCensusExport {
  schema: typeof CENSUS_SCHEMA
  takenAt: string
  takenAtSource: typeof TAKEN_AT_SOURCE
  env: "cert" | "prod" | "fake"
  /** Alias, nunca el PCC real: `P1`. */
  pcc: string
  sample: { perQueue: number; range: [number, number] }
  /** Si el censo terminó entero o se paró. */
  complete: boolean
  queues: CensusExportQueue[]
  annex: { paragraphs: CensusAnnexParagraph[] }
}

// --- Líneas seguras del párrafo (regla de #96, ADR-018) ----------------------------------

/**
 * Las líneas del párrafo que quedan tal cual: no traen datos del pasajero. Es la lista blanca de
 * la anonimización de #96 (ADR-018). `sabre-client` no la exporta, así que la consola la repite
 * como regla, no como código del SDK.
 */
export const SAFE_LINES: readonly RegExp[] = [
  /^\s*$/,
  // El aviso PIC, sin dígitos después del número: una línea de lista como
  // `100  ABC123  PLT …` trae un localizador y no pasa (misma regla que `sabre-client`).
  /^\s*\d{3}\s{2,}[A-Z][A-Z ,./-]*$/,
  /^\s*END OF DISPLAY FOR REQUESTED DATA\s*$/,
  /^\s*(TKT\/TIME LIMIT|PHONES|REMARKS|ADDRESS|INVOICED|GENERAL FACTS|[A-Z0-9]{2} FACTS|NO ITIN)\s*$/,
  /^\s*PASSENGER EMAIL DATA EXISTS\s+\*PE TO DISPLAY ALL\s*$/,
]

/** Una línea enmascarada: sin letras ni dígitos, salvo `X` y `9`. */
const MASKED_LINE = /^[^\p{L}\p{N}]*(?:[X9][^\p{L}\p{N}]*)*$/u

/**
 * El párrafo con la regla de #96 (ADR-018): las líneas de la lista blanca quedan tal cual; en las
 * demás, letras a `X` y dígitos a `9`. La línea de firma se tapa entera, localizador incluido.
 */
export function maskParagraph(lines: readonly string[]): string[] {
  return lines.map((line) =>
    SAFE_LINES.some((pattern) => pattern.test(line))
      ? line
      : line.replace(/\p{L}/gu, "X").replace(/\p{N}/gu, "9")
  )
}

export function isSafeLine(line: string): boolean {
  return (
    SAFE_LINES.some((pattern) => pattern.test(line)) || MASKED_LINE.test(line)
  )
}

/**
 * El censo en memoria como `queue-census/1`. Toma solo los rasgos, campo por campo: lo que no está
 * acá no sale, aunque el estado lo tenga. `undefined` si todavía no hay nada que exportar.
 */
export function buildCensusExport(
  census: QueueCensus,
  alias: string
): QueueCensusExport | undefined {
  if (census.takenAt === undefined || census.environment === undefined) {
    return undefined
  }
  const queues = census.queues.map(
    (queue): CensusExportQueue => ({
      queue: queue.queue,
      count: queue.count,
      sampled: queue.items.length,
      ended: queue.ended ?? null,
      items: queue.items.map(
        (item): CensusExportItem => ({
          ref: item.ref,
          pnr: item.pnr,
          pics: item.pics.map(({ code, text }) => ({ code, text })),
          placedAgeHours: item.placedAgeHours,
          placedBySameAsWorkingPcc: item.placedBySameAsWorkingPcc,
          parseOk: item.parseOk,
          unparsedLines: item.unparsedLines,
          booking: item.booking ?? null,
          bookingError: item.bookingError ?? null,
          flagged: item.flagged === true,
        })
      ),
    })
  )
  return {
    schema: CENSUS_SCHEMA,
    takenAt: census.takenAt,
    takenAtSource: TAKEN_AT_SOURCE,
    env: census.environment,
    pcc: alias,
    sample: { perQueue: census.perQueue, range: [0, 49] },
    complete: census.phase === "done" && !census.stopped,
    queues,
    annex: {
      paragraphs: census.queues.flatMap((queue) =>
        queue.items
          .filter((item) => item.flagged === true)
          .map((item) => ({
            ref: item.ref,
            pnr: item.pnr,
            lines: [...item.maskedParagraph],
          }))
      ),
    },
  }
}

/** El nombre del archivo: `censo-colas-p1-2026-11-06.json`. */
export function censusFileName(
  doc: Pick<QueueCensusExport, "pcc" | "takenAt">
) {
  return `censo-colas-${doc.pcc.toLowerCase()}-${doc.takenAt.slice(0, 10)}.json`
}

/** Los textos PIC distintos del censo, para revisarlos antes de exportar. */
export function distinctPicTexts(
  doc: QueueCensusExport
): { code: number; text: string | null; count: number }[] {
  const seen = new Map<
    string,
    { code: number; text: string | null; count: number }
  >()
  for (const queue of doc.queues) {
    for (const item of queue.items) {
      for (const pic of item.pics) {
        const key = `${pic.code}\u0000${pic.text ?? ""}`
        const entry = seen.get(key) ?? {
          code: pic.code,
          text: pic.text,
          count: 0,
        }
        entry.count += 1
        seen.set(key, entry)
      }
    }
  }
  return [...seen.values()].sort((a, b) => a.code - b.code)
}

// --- Validador ---------------------------------------------------------------------------

export interface CensusIssue {
  /** La ruta del campo: `queues[0].items[2].booking.flights[0].from`. */
  path: string
  /** La referencia del PNR (`Q07-01`), si el campo es de uno. */
  ref?: string
  message: string
}

export interface ValidationContext {
  /** Los localizadores que leyó la consola. */
  locators: ReadonlySet<string>
  /** Los PCC reales (de la sesión y de trabajo): no pueden aparecer en ningún valor. */
  pccs: readonly string[]
}

type Rule =
  | { kind: "int"; min?: number; max?: number; nullable?: boolean }
  | { kind: "bool"; nullable?: boolean }
  | {
      kind: "string"
      pattern: RegExp
      nullable?: boolean
      /**
       * Un código de proveedor que puede tener seis letras o dígitos (una marca de tarifa:
       * `BASICX`). Su expresión ya es cerrada, así que no se le aplica la regla de "forma de
       * localizador"; sí la de no contener un localizador leído ni un PCC.
       */
      code?: boolean
    }
  | {
      kind: "literal"
      values: readonly (string | number)[]
      nullable?: boolean
    }
  | { kind: "array"; of: Rule; max?: number; nullable?: boolean }
  | { kind: "object"; fields: Record<string, Rule>; nullable?: boolean }
  | { kind: "record"; key: RegExp; value: Rule }

const int = (min = -1_000_000, max = 1_000_000): Rule => ({
  kind: "int",
  min,
  max,
})
const intOrNull = (min = -1_000_000, max = 1_000_000): Rule => ({
  kind: "int",
  min,
  max,
  nullable: true,
})
const bool: Rule = { kind: "bool" }
const boolOrNull: Rule = { kind: "bool", nullable: true }
const text = (pattern: RegExp): Rule => ({ kind: "string", pattern })
const textOrNull = (pattern: RegExp): Rule => ({
  kind: "string",
  pattern,
  nullable: true,
})
const array = (of: Rule, max = 500): Rule => ({ kind: "array", of, max })
const object = (fields: Record<string, Rule>): Rule => ({
  kind: "object",
  fields,
})

const PIC_CODE: Rule = {
  kind: "int",
  min: 0,
  max: 254,
}

const SEGMENT_COUNT = object({ count: int(0), status: array(text(P.status)) })

const BOOKING: Rule = {
  kind: "object",
  nullable: true,
  fields: {
    isTicketed: boolOrNull,
    isCancelable: boolOrNull,
    daysToStart: intOrNull(),
    tripLengthDays: intOrNull(),
    ageDays: intOrNull(),
    hoursSinceUpdate: intOrNull(),
    numberOfUpdates: intOrNull(0),
    hoursToPurchaseDeadline: intOrNull(),
    createdInWorkingPcc: boolOrNull,
    primeHostId: textOrNull(P.primeHost),
    daysToRetention: intOrNull(),
    hasRetention: bool,
    hasAgencyCustomerNumber: bool,
    isGroup: bool,
    groupSize: intOrNull(0),
    hasCorporateProfile: bool,
    hasEmployer: bool,
    warnings: array(text(P.warning)),
    flights: array(
      object({
        source: textOrNull(P.enumValue),
        carrier: textOrNull(P.carrier),
        operatingCarrier: textOrNull(P.carrier),
        isCodeshare: boolOrNull,
        from: textOrNull(P.airport),
        to: textOrNull(P.airport),
        international: boolOrNull,
        status: textOrNull(P.status),
        statusName: textOrNull(P.enumName),
        scheduleChangeMinutes: intOrNull(),
        daysToDeparture: intOrNull(),
        isPast: boolOrNull,
        bookingClass: textOrNull(P.bookingClass),
        cabin: textOrNull(P.bookingClass),
        hiddenStops: int(0),
        seatsAssigned: int(0),
        seatStatus: array(text(P.status)),
      })
    ),
    journeys: int(0),
    tripType: {
      kind: "literal",
      values: ["OW", "RT", "MULTI"],
      nullable: true,
    },
    hotels: SEGMENT_COUNT,
    cars: SEGMENT_COUNT,
    trains: SEGMENT_COUNT,
    cruises: SEGMENT_COUNT,
    segmentTypes: array(text(P.enumValue)),
    fares: array(
      object({
        pricingType: {
          kind: "literal",
          values: ["S", "A", "M"],
          nullable: true,
        },
        pricingStatus: { kind: "literal", values: ["A", "H"], nullable: true },
        hasValidPricing: boolOrNull,
        isNegotiatedFare: boolOrNull,
        hasTourCode: bool,
        hasAccountCode: bool,
        brand: { kind: "string", pattern: P.brand, nullable: true, code: true },
        travelerTypeMismatch: boolOrNull,
      })
    ),
    currency: textOrNull(P.currency),
    rules: object({
      isRefundable: boolOrNull,
      isChangeable: boolOrNull,
      hasNoShowCost: boolOrNull,
      conditionsApply: boolOrNull,
    }),
    tickets: object({
      count: int(0),
      status: array(text(P.coupon)),
      daysSinceIssue: array(int()),
      couponStatus: array(text(P.coupon)),
      ticketedInWorkingPcc: boolOrNull,
      isBundledTicket: bool,
    }),
    ancillaries: array(
      object({
        rfic: textOrNull(P.rfic),
        subcode: textOrNull(P.subcode),
        status: textOrNull(P.status),
        source: textOrNull(P.enumValue),
        isRefundable: boolOrNull,
      })
    ),
    formsOfPayment: array(text(P.enumValue)),
    accountingItems: array(
      object({
        fareApplicationType: textOrNull(P.enumName),
        formOfPaymentType: textOrNull(P.enumName),
        creationType: textOrNull(P.enumName),
        tariffBasisType: textOrNull(P.enumName),
      })
    ),
    nonElectronicTickets: int(0),
    futureTicketing: {
      kind: "object",
      nullable: true,
      fields: {
        queueNumber: intOrNull(0, 511),
        daysToTicketing: intOrNull(),
        sameAsWorkingPcc: boolOrNull,
      },
    },
    ssr: array(object({ code: text(P.ssr), status: textOrNull(P.status) })),
    osi: object({ count: int(0), carriers: array(text(P.carrier)) }),
    remarks: { kind: "record", key: P.enumValue, value: int(0) },
    // `null` si algún remark `QUEUE_PLACE` no cumple la expresión cerrada: queda solo el conteo.
    queuePlaceRemarks: {
      kind: "array",
      nullable: true,
      of: object({ queue: int(0, 511), pic: PIC_CODE }),
      max: 100,
    },
    queuePlaceCount: int(0),
    flags: object({
      mentionsTicketingDeadline: bool,
      mentionsCancellation: bool,
      mentionsScheduleChange: bool,
    }),
    pax: int(0),
    paxTypes: array(text(P.paxType)),
    hasIdentityDocuments: bool,
    hasLoyalty: bool,
  },
}

const ITEM = object({
  ref: text(/^Q\d{2}-\d{2}$/),
  pnr: text(P.pnr),
  pics: array(object({ code: PIC_CODE, text: textOrNull(P.picText) }), 20),
  placedAgeHours: intOrNull(),
  placedBySameAsWorkingPcc: boolOrNull,
  parseOk: bool,
  unparsedLines: intOrNull(0),
  booking: BOOKING,
  bookingError: textOrNull(/^[A-Za-z][A-Za-z0-9_ :/.-]{0,99}$/),
  flagged: bool,
})

const CENSUS: Rule = object({
  schema: { kind: "literal", values: [CENSUS_SCHEMA] },
  takenAt: text(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/),
  takenAtSource: { kind: "literal", values: [TAKEN_AT_SOURCE] },
  env: { kind: "literal", values: ["cert", "prod", "fake"] },
  pcc: text(ALIAS_PATTERN),
  sample: object({
    perQueue: int(1, 25),
    range: { kind: "array", of: int(0, 49), max: 2 },
  }),
  complete: bool,
  queues: array(
    object({
      queue: int(0, 49),
      count: int(0),
      sampled: int(0, 25),
      ended: {
        kind: "literal",
        values: ["end-of-display", "empty", "limit", "error"],
        nullable: true,
      },
      items: array(ITEM, 25),
    }),
    50
  ),
  annex: object({
    paragraphs: array(
      object({
        ref: text(/^Q\d{2}-\d{2}$/),
        pnr: text(P.pnr),
        lines: array(text(/^[\s\S]{0,120}$/), 400),
      }),
      100
    ),
  }),
})

/**
 * Cadenas de seis letras o dígitos que son enums de la respuesta, no localizadores. Un enum nuevo
 * de seis caracteres hace fallar el validador hasta que se suma acá: falla cerrado.
 */
export const SIX_CHAR_ENUMS: ReadonlySet<string> = new Set([
  "FLIGHT",
  "HIDDEN",
  "DOCKET",
  "CRUISE",
  "ISSUED",
])

const LOCATOR_SHAPE = /^[A-Z0-9]{6}$/

/** Lo que parece un nombre de pasajero en un texto PIC: `1.1SMITH/JOHN`, `SMITH/JOHN MR`. */
const NAME_SHAPES: readonly RegExp[] = [
  /\b\d+\.\d+[A-Z]+\//,
  /\b[A-Z]{2,}\/[A-Z]{2,}(?: [A-Z]+)* (?:MR|MRS|MS|MSTR|MISS|DR)\b/,
  /\b(?:MR|MRS|MS|MSTR|MISS)\b/,
]

function describe(value: unknown): string {
  if (value === null) return "null"
  if (Array.isArray(value)) return "una lista"
  return typeof value === "string" ? `"${value.slice(0, 40)}"` : typeof value
}

/** Valida `doc` contra `queue-census/1`. Una lista vacía quiere decir que se puede exportar. */
export function validateCensusExport(
  doc: unknown,
  context: ValidationContext
): CensusIssue[] {
  const issues: CensusIssue[] = []
  const pccs = context.pccs
    .map((pcc) => pcc.trim().toUpperCase())
    .filter((pcc) => pcc !== "")
  const locators = [...context.locators]

  const report = (path: string, ref: string | undefined, message: string) =>
    issues.push({ path, ref, message })

  /** Las reglas de toda cadena, valor o clave, fuera de `pnr`. Un aviso por cadena. */
  const checkString = (
    value: string,
    path: string,
    ref: string | undefined,
    code = false
  ) => {
    const upper = value.toUpperCase()
    // Las líneas del anexo ya están enmascaradas (`XXXXXX` es un localizador tapado): se
    // revisan aparte, con `isSafeLine`. Un código de proveedor (`code`) tiene su expresión.
    const annexLine = path.includes(".lines[")
    if (
      !annexLine &&
      !code &&
      LOCATOR_SHAPE.test(value) &&
      !SIX_CHAR_ENUMS.has(value)
    ) {
      report(path, ref, `tiene forma de localizador: ${describe(value)}`)
      return
    }
    if (locators.some((locator) => upper.includes(locator))) {
      report(path, ref, "contiene un localizador fuera de pnr")
      return
    }
    if (
      pccs.some((pcc) =>
        new RegExp(`(?:^|[^A-Z0-9])${pcc}(?:$|[^A-Z0-9])`).test(upper)
      )
    ) {
      report(path, ref, "contiene un PCC")
    }
  }

  const walk = (
    value: unknown,
    rule: Rule,
    path: string,
    ref: string | undefined
  ): void => {
    if (value === null) {
      if (!("nullable" in rule && rule.nullable)) {
        report(path, ref, "no puede ser null")
      }
      return
    }
    switch (rule.kind) {
      case "int":
        if (
          typeof value !== "number" ||
          !Number.isInteger(value) ||
          value < (rule.min ?? -Infinity) ||
          value > (rule.max ?? Infinity)
        ) {
          report(
            path,
            ref,
            `tiene que ser un entero válido, no ${describe(value)}`
          )
        }
        return
      case "bool":
        if (typeof value !== "boolean") {
          report(path, ref, `tiene que ser un booleano, no ${describe(value)}`)
        }
        return
      case "string":
        if (typeof value !== "string" || !rule.pattern.test(value)) {
          report(path, ref, `no pasa ${rule.pattern}: ${describe(value)}`)
          return
        }
        if (!path.endsWith(".pnr")) checkString(value, path, ref, rule.code)
        return
      case "literal":
        if (!rule.values.includes(value as string | number)) {
          report(
            path,
            ref,
            `no es uno de ${rule.values.join(", ")}: ${describe(value)}`
          )
        }
        return
      case "array":
        if (!Array.isArray(value)) {
          report(path, ref, `tiene que ser una lista, no ${describe(value)}`)
          return
        }
        if (rule.max !== undefined && value.length > rule.max) {
          report(path, ref, `tiene más de ${rule.max} elementos`)
        }
        value.forEach((element, index) => {
          walk(element, rule.of, `${path}[${index}]`, ref)
        })
        return
      case "record": {
        if (typeof value !== "object" || Array.isArray(value)) {
          report(path, ref, `tiene que ser un objeto, no ${describe(value)}`)
          return
        }
        for (const [key, element] of Object.entries(value)) {
          if (!rule.key.test(key)) {
            report(`${path}.${key}`, ref, "clave inválida")
            continue
          }
          checkString(key, `${path}.${key}`, ref)
          walk(element, rule.value, `${path}.${key}`, ref)
        }
        return
      }
      case "object": {
        if (typeof value !== "object" || Array.isArray(value)) {
          report(path, ref, `tiene que ser un objeto, no ${describe(value)}`)
          return
        }
        const record = value as Record<string, unknown>
        // Dentro de un PNR, los campos llevan su referencia.
        const own =
          typeof record.ref === "string" && "pnr" in record ? record.ref : ref
        for (const key of Object.keys(record)) {
          if (!(key in rule.fields)) {
            report(
              path === "" ? key : `${path}.${key}`,
              own,
              "campo fuera del esquema"
            )
          }
        }
        for (const [key, field] of Object.entries(rule.fields)) {
          const child = path === "" ? key : `${path}.${key}`
          if (!(key in record)) {
            report(child, own, "falta el campo")
            continue
          }
          walk(record[key], field, child, own)
        }
        return
      }
    }
  }

  walk(doc, CENSUS, "", undefined)
  if (issues.length > 0 || doc === null || typeof doc !== "object") {
    return issues
  }

  // Reglas que cruzan campos, ya con la forma validada.
  const census = doc as QueueCensusExport
  const refs = new Map<string, string>()
  census.queues.forEach((queue, q) => {
    queue.items.forEach((item, i) => {
      const path = `queues[${q}].items[${i}]`
      refs.set(item.ref, item.pnr)
      if (!context.locators.has(item.pnr)) {
        report(
          `${path}.pnr`,
          item.ref,
          "no es un localizador que leyó la consola"
        )
      }
      item.pics.forEach((pic, p) => {
        const picPath = `${path}.pics[${p}].text`
        if (
          pic.text !== null &&
          NAME_SHAPES.some((shape) => shape.test(pic.text ?? ""))
        ) {
          report(picPath, item.ref, "el texto PIC parece un nombre")
        }
        if (
          !(
            (pic.code >= 0 && pic.code <= 191) ||
            (pic.code >= 200 && pic.code <= 254)
          )
        ) {
          report(
            `${path}.pics[${p}].code`,
            item.ref,
            "PIC fuera de 0–191 y 200–254"
          )
        }
      })
    })
  })
  census.annex.paragraphs.forEach((paragraph, a) => {
    const path = `annex.paragraphs[${a}]`
    if (refs.get(paragraph.ref) !== paragraph.pnr) {
      report(
        `${path}.pnr`,
        paragraph.ref,
        "no coincide con el PNR de esa referencia"
      )
    }
    paragraph.lines.forEach((line, l) => {
      if (!isSafeLine(line)) {
        report(`${path}.lines[${l}]`, paragraph.ref, "línea sin enmascarar")
      }
    })
  })
  return issues
}
