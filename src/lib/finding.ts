import type { ConsoleEnvironmentId } from "@/lib/environment"
import { formatXml } from "@/lib/format-xml"
import { createRedactor } from "@/lib/redact"
import type { StepRun } from "@/lib/step/types"

/**
 * "Copiar como hallazgo" (F6.1, #23): un paso de la consola como bloque Markdown, listo para
 * pegar en la página de la entidad en `sabre-wiki`, con fecha (regla de discrepancias del
 * `CLAUDE.md` de la wiki). Lleva fecha, entorno, método, request, respuesta cruda y error.
 *
 * El request es lo que la consola le pasó a la server action (la entrada del paso): el SDK no
 * expone el body que manda a Sabre.
 *
 * Todo pasa por `redact.ts` (F6.2, #24): sin token ni datos personales, con localizador,
 * segmentos, tarifas y códigos de error tal cual.
 *
 * Corre en el navegador, sobre lo que ya llegó al cliente.
 */

/** Lo que hace falta para armar el hallazgo: una entrada del historial, o un paso suelto. */
export interface FindingSource {
  method: string
  /** ISO 8601. Sin fecha, la de ahora. */
  at?: string
  input?: unknown
  run: StepRun
}

/** Más que esto, la respuesta cruda se recorta: un BFM pesa cientos de KB. */
export const RAW_LIMIT = 20_000

const ENVIRONMENT_LABEL: Record<ConsoleEnvironmentId, string> = {
  cert: "CERT",
  prod: "Producción",
  fake: "Fake (sabre-client/testing)",
}

/** Un bloque de código con una cerca más larga que cualquier secuencia de backticks adentro. */
function fence(language: string, text: string): string {
  const longest = Math.max(
    2,
    ...[...text.matchAll(/`+/g)].map((match) => match[0].length)
  )
  const marks = "`".repeat(longest + 1)
  return `${marks}${language}\n${text}\n${marks}`
}

const json = (value: unknown) => JSON.stringify(value, null, 2)

/** El body crudo legible: JSON indentado, XML indentado, o el texto tal cual. */
export function prettyBody(body: string): { language: string; text: string } {
  const trimmed = body.trim()
  if (trimmed.startsWith("<")) return { language: "xml", text: formatXml(body) }
  try {
    return { language: "json", text: json(JSON.parse(body)) }
  } catch {
    return { language: "text", text: body }
  }
}

function clip(text: string): { text: string; note?: string } {
  if (text.length <= RAW_LIMIT) return { text }
  return {
    text: `${text.slice(0, RAW_LIMIT)}\n…`,
    note: `recortada: ${RAW_LIMIT.toLocaleString("es-MX")} de ${text.length.toLocaleString("es-MX")} caracteres`,
  }
}

/** `2026-11-04 21:13 UTC`. */
function formatDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`
}

/** El hallazgo en Markdown. */
export function findingMarkdown(source: FindingSource): string {
  const { method, run } = source
  const redactor = createRedactor()
  // Pasada estructural de todas las partes antes de las de texto: un valor que aparece en la
  // respuesta cruda también se reemplaza en la entrada y en el error.
  const step = run.enabled ? run.step : undefined
  const body =
    step?.raw === undefined || step.raw.body === ""
      ? undefined
      : redactor.body(step.raw.body)
  const input = redactor.structure(source.input)
  const issues =
    step === undefined
      ? {}
      : (redactor.structure({
          ...(step.error === undefined ? {} : { error: step.error }),
          ...(step.warnings === undefined ? {} : { warnings: step.warnings }),
          ...(step.partialErrors === undefined
            ? {}
            : { errors: step.partialErrors }),
        }) as Record<string, unknown>)
  const at = source.at ?? new Date().toISOString()
  const day = at.slice(0, 10)
  const environment =
    run.environment === undefined ? "—" : ENVIRONMENT_LABEL[run.environment]
  const out: string[] = []

  out.push(`#### Hallazgo ${day}: \`${method}\``, "")
  out.push(`- **Fecha**: ${formatDate(at)}`)
  out.push(`- **Entorno**: ${environment}`)

  if (!run.enabled) {
    out.push(`- **Método**: \`${method}\``)
    out.push(`- **Resultado**: no se corrió (${run.reason})`)
  } else {
    const { step } = run
    const operation = step.raw?.operation
    const via =
      step.raw === undefined
        ? ""
        : ` · ${step.raw.protocol.toUpperCase()} · HTTP ${step.raw.status}`
    const attempts =
      step.attempts === undefined
        ? ""
        : ` · ${step.attempts} ${step.attempts === 1 ? "intento" : "intentos"}`
    out.push(
      `- **Método**: \`${method}\`${operation !== undefined && operation !== method ? ` (operación \`${operation}\`)` : ""}${via}${attempts} · ${step.durationMs} ms`
    )
    const outcome = step.ok
      ? "ok"
      : `\`${step.error?.class ?? "error"}\`${step.error?.code === undefined ? "" : ` \`${step.error.code}\``}`
    out.push(`- **Resultado**: ${outcome}`)
  }
  out.push(
    "- **Fuente**: sabre-playground (datos personales y token redactados)"
  )

  out.push("", "**Request** (entrada del paso)", "")
  out.push(
    input === undefined ||
      (typeof input === "object" &&
        input !== null &&
        Object.keys(input).length === 0)
      ? "_Sin entrada._"
      : fence("json", json(input))
  )

  if (run.enabled) {
    const { step } = run
    out.push("", "**Respuesta cruda**", "")
    if (step.raw === undefined) {
      out.push("_Sin respuesta HTTP: la llamada no llegó a Sabre._")
    } else if (body === undefined) {
      out.push(`_HTTP ${step.raw.status}, body vacío._`)
    } else {
      const pretty = prettyBody(body)
      const clipped = clip(redactor.text(pretty.text))
      if (clipped.note !== undefined) out.push(`_${clipped.note}_`, "")
      out.push(fence(pretty.language, clipped.text))
    }

    out.push("", "**Error**", "")
    out.push(
      Object.keys(issues).length === 0
        ? "_Sin error ni avisos._"
        : fence("json", json(redactor.value(issues)))
    )
  }

  return `${out.join("\n")}\n`
}
