import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"
import { findingMarkdown } from "./finding.ts"
import { createRedactor, maskCardNumbers, redactForms } from "./redact.ts"
import type { StepRun } from "./step/types.ts"

/**
 * La redacción del hallazgo con texto libre (TravelItineraryHistoryLLSRS 2.4.0). La fixture es
 * sintética: la forma de una respuesta de producción del 2026-11-22 con valores falsos. El PAN es
 * el número de prueba público de AMEX.
 */
const HISTORY = readFileSync(
  new URL("./fixtures/reservation-history-synthetic.xml", import.meta.url),
  "utf8"
)
const PAN = "378282246310005"

function historyRun(body: string): StepRun {
  return {
    environment: "prod",
    enabled: true,
    step: {
      ok: true,
      log: [],
      durationMs: 1,
      raw: {
        protocol: "soap",
        status: 200,
        operation: "reservation.history",
        attempts: 1,
        headers: {},
        body,
      } as never,
      rawRequest: {
        method: "POST",
        url: "https://webservices.example.com/websvc",
        attempts: 1,
        headers: {},
        body: '<TravelItineraryHistoryRQ Version="2.4.0"><UniqueID ID="AAAAAA"/></TravelItineraryHistoryRQ>',
      } as never,
    },
  }
}

const finding = (body = HISTORY) =>
  findingMarkdown({
    method: "reservation.history",
    at: "2026-11-22T02:59:00Z",
    input: { locator: "AAAAAA" },
    run: historyRun(body),
  })

describe("hallazgo de reservation.history", () => {
  const markdown = finding()

  it("no deja el PAN, ni en atributo ni dentro de un Text", () => {
    assert.equal(markdown.includes(PAN), false)
    // Ni partido en grupos ni con otros separadores.
    assert.equal(markdown.replace(/\D/g, "").includes(PAN), false)
  })

  it("no deja un PAN dentro de un Text aunque el resto del XML cambie", () => {
    const body = `<Envelope><Body><TravelItineraryHistoryRS><HistoricalInfo RPH="1"><GeneralInfo Action="AT"><Text>WPQ1*AX${PAN}/0228</Text></GeneralInfo><Remark Action="A5H"><Text>CARD 3782 822463 10005</Text></Remark></HistoricalInfo></TravelItineraryHistoryRS></Body></Envelope>`
    const out = finding(body)
    assert.equal(out.includes(PAN), false)
    assert.equal(out.includes("822463"), false)
    assert.equal(out.includes("0228"), false)
  })

  it("tapa vencimiento, autorización, nombres, DOCS, boleto, PCC y ReceivedFrom", () => {
    for (const leak of [
      "/0228",
      "AUTH-APV/000000",
      "AX0005",
      "TESTER",
      "UNO",
      "SR PRUEBA",
      "01JAN1980",
      "1390000000001",
      'Number="0000000001"',
      "0000002",
      "ZZZZ",
      "YYYY",
      "BBBBBB",
      "CCCCCC",
      "NNHKAMAM0000000000",
      "MEXRMAM000000",
    ]) {
      assert.equal(markdown.includes(leak), false, `quedó «${leak}»`)
    }
  })

  it("tapa el sine y el PCC de 3 letras, que tienen forma de código", () => {
    const out = finding(
      '<Envelope><Source CreationAgent="A1B" PseudoCityCode="PLT" CreationAgentDutyCode="*"/></Envelope>'
    )
    assert.ok(out.includes('CreationAgent="X9X"'))
    assert.ok(out.includes('PseudoCityCode="XXX"'))
    assert.ok(out.includes('CreationAgentDutyCode="*"'))
  })

  it("conserva el localizador del paso, segmentos, estados y Action", () => {
    for (const kept of [
      'UniqueID ID="AAAAAA"',
      '"locator": "AAAAAA"',
      'Action="AT"',
      'Action="A5H"',
      'FlightNumber="0026"',
      'LocationCode="MEX"',
      'Status="HKNN"',
      'DepartureDateTime="09-19T22:00"',
      'CreateDateTime="2026-09-17T12:19"',
      'Amount="10000"',
      'PaymentCard Code="AX"',
      "<eb:Service>TravelItineraryHistoryLLSRQ</eb:Service>",
      "[REDACTED]",
    ]) {
      assert.ok(markdown.includes(kept), `se perdió «${kept}»`)
    }
  })
})

describe("redactForms", () => {
  it("tapa tarjetas y boletos con separadores, no fechas ni importes", () => {
    assert.equal(
      redactForms("4111 1111 1111 1111 exp"),
      "9999 9999 9999 9999 exp"
    )
    assert.equal(redactForms("TKT 139-0000000001"), "TKT 999-9999999999")
    assert.equal(
      redactForms("2026-11-22 02:59 1234.56"),
      "2026-11-22 02:59 1234.56"
    )
  })

  it("tapa lo que sigue a AUTH y a un SSR DOCS", () => {
    assert.equal(redactForms("H-AUTH-APV/123456"), "H-AUTH-XXX/999999")
    assert.equal(
      redactForms("SSR DOCS AM HK1/DB/01JAN1980/M/TESTER/UNO"),
      "SSR DOCS XX XX9/XX/99XXX9999/X/XXXXXX/XXX"
    )
  })
})

describe("redacción de JSON con texto libre", () => {
  it("enmascara remarks, SSR con datos y tarjetas en booking.get", () => {
    const redactor = createRedactor()
    const body = redactor.body(
      JSON.stringify({
        remarks: [{ type: "GENERAL", text: "PAGO CON TARJETA DE TESTER" }],
        specialServices: [
          { code: "DOCS", message: "P/MEX/X0000000/MEX/01JAN80/M" },
        ],
        payments: { formsOfPayment: [{ cardNumber: "4111111111111111" }] },
        flightTickets: [{ number: "1390000000001" }],
      })
    )
    const text = redactor.text(body)
    for (const leak of [
      "TESTER",
      "01JAN80",
      "4111111111111111",
      "1390000000001",
    ]) {
      assert.equal(text.includes(leak), false, `quedó «${leak}»`)
    }
    assert.ok(text.includes('"code":"DOCS"'))
  })

  it("aplica la red a la entrada del paso (un comando con la tarjeta)", () => {
    const out = findingMarkdown({
      method: "commands.run",
      input: { command: `WPQ*AX${PAN}/0228` },
      run: { enabled: false, reason: "prueba" },
    })
    assert.equal(out.includes(PAN), false)
    assert.equal(out.includes("0228"), false)
  })
})

describe("maskCardNumbers (pestaña Crudo)", () => {
  it("tapa el PAN y su vencimiento dentro de la respuesta del historial", () => {
    const out = maskCardNumbers(HISTORY)
    assert.equal(out.includes(PAN), false)
    assert.ok(out.includes("*AX999999999999999/9999"))
  })

  it("deja boletos, ids y fechas que no pasan Luhn", () => {
    const text = "1390000000001 2026-11-22T02:59 MXN11100"
    assert.equal(maskCardNumbers(text), text)
  })
})
