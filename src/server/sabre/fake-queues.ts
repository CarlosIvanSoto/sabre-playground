import "server-only"

import {
  type QueueFakeOptions,
  type QueueFakePnr,
  queueFixtures,
  type RecordedFixture,
} from "sabre-client/testing"

/**
 * Las colas del modo fake (F5.1, #21), armadas con `queueFixtures` de `sabre-client/testing`:
 * las respuestas anonimizadas que el Tier 3 grabó en producción el 2026-11-02.
 *
 * - Cola `9`: los cuatro PNR de `walk`, con la fecha y la firma de su `Line` en `list`, y el
 *   párrafo que devolvieron `access` e `ignore`.
 * - Cola `50`: vacía, como `emptyQueue` (`QUEUE SELECTED WAS EMPTY`).
 * - Fuera de las colas: el PNR de `place`, para colocarlo con `place({ locators })`. En la
 *   grabación usa el mismo localizador anonimizado que el primero de `walk` (`AAAAAA`), así que
 *   acá pasa a ser `AAAAAE`.
 *
 * La línea de firma del párrafo (`… HHMM/DDMMMYY <localizador> H`) se quita y el fake agrega la
 * suya, que es la que usa `place` dentro de una cola: en `walk` viene anonimizada entera
 * (`… XXXXXX X`), y en `place` conserva el localizador de la grabación, que el fake rechaza si
 * no coincide con el del PNR. El pasajero principal de `list` es el
 * sintético de estrategia-de-testing: `TEST/PASSENGER`.
 *
 * Esto lee el XML de una fixture para sembrar el fake, no lo que manda Sabre: el parseo de las
 * respuestas reales es del SDK.
 */

export const FAKE_QUEUE = "9"
export const FAKE_EMPTY_QUEUE = "50"
const LOOSE_LOCATOR = "AAAAAE"
const PRIMARY_PASSENGER = "TEST/PASSENGER"

/** La firma, real o anonimizada: `9XXX.9XXX*XXX 9999/99XXX99 AAAAAA H`. */
const SIGNATURE = /^\S+\*\S+ \S{4}\/\S{7} [A-Z0-9]{6} [A-Z]$/

const bodyOf = (xml: string) => xml.split(/<soap-env:Body>/)[1] ?? ""

const decode = (text: string) =>
  text
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&")

function paragraphOf(body: string): string[] {
  const lines = [...body.matchAll(/<Text>([^<]*)<\/Text>/g)].map((match) =>
    decode(match[1] ?? "")
  )
  return lines.filter((line) => !SIGNATURE.test(line.trim()))
}

function locatorOf(body: string): string | undefined {
  return /<UniqueID ID="([A-Z0-9]{6})"/.exec(body)?.[1]
}

/** Las `Line` de una respuesta de `list`, por localizador. */
function linesOf(body: string): Map<string, Omit<QueueFakePnr, "locator">> {
  const lines = new Map<string, Omit<QueueFakePnr, "locator">>()
  for (const [line] of body.matchAll(/<Line\b[^>]*>[\s\S]*?<\/Line>/g)) {
    const locator = locatorOf(line)
    if (locator === undefined) continue
    const source = /<Source AgentSine="([^"]*)" PseudoCityCode="([^"]*)"/.exec(
      line
    )
    lines.set(locator, {
      placedAt: /<DateTime>([^<]*)<\/DateTime>/.exec(line)?.[1],
      placedBy:
        source === null
          ? undefined
          : { agentSine: source[1], pseudoCityCode: source[2] },
    })
  }
  return lines
}

/** Los PNR que `access` e `ignore` mostraron, en orden, con su párrafo. */
function visitedOf(fixture: RecordedFixture): QueueFakePnr[] {
  const pnrs: QueueFakePnr[] = []
  for (const response of fixture.responses) {
    if (!/^queue\.(access|ignore)$/.test(response.operation)) continue
    const body = bodyOf(response.body)
    const locator = locatorOf(body)
    if (locator === undefined) continue
    pnrs.push({ locator, paragraph: paragraphOf(body) })
  }
  return pnrs
}

function walkQueue(): QueueFakePnr[] {
  const fixture = queueFixtures.walk
  const list = fixture.responses.find((r) => r.operation === "queue.list")
  const lines = linesOf(bodyOf(list?.body ?? ""))
  return visitedOf(fixture).map((pnr) => ({
    ...lines.get(pnr.locator),
    ...pnr,
    primaryPassenger: PRIMARY_PASSENGER,
  }))
}

function loosePnr(): QueueFakePnr | undefined {
  const [pnr] = visitedOf(queueFixtures.place)
  if (pnr === undefined) return undefined
  return { ...pnr, locator: LOOSE_LOCATOR, primaryPassenger: PRIMARY_PASSENGER }
}

/** Las opciones de `createQueueFake`, nuevas en cada llamada: el fake muta sus colas. */
export function fakeQueueOptions(): QueueFakeOptions {
  const loose = loosePnr()
  return {
    queues: { [FAKE_QUEUE]: walkQueue(), [FAKE_EMPTY_QUEUE]: [] },
    pnrs: loose === undefined ? [] : [loose],
  }
}

/** De dónde salen las colas del fake, para mostrarlo en la UI. */
export const FAKE_QUEUES_RECORDED_AT = queueFixtures.walk.recordedAt
