import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildFulfillRequest,
  buildVerifyRequest,
  fulfillGate,
  fulfillSchema,
  PROD_FULFILL_REASON,
  ticketsOf,
  verifySchema,
} from "./ticketing.ts"

/** La emisión de W4 (F16.2, #160). */

describe("fulfillGate", () => {
  it("en producción se rechaza siempre", () => {
    assert.deepEqual(fulfillGate("prod", true), {
      ok: false,
      reason: PROD_FULFILL_REASON,
    })
  })

  it("un entorno sin readOnly conocido cuenta como producción", () => {
    assert.equal(fulfillGate("cert", undefined).ok, false)
  })

  it("en CERT y en fake se emite", () => {
    assert.equal(fulfillGate("cert", false).ok, true)
    assert.equal(fulfillGate("fake", undefined).ok, true)
  })
})

describe("buildFulfillRequest", () => {
  it("arma la receta S8: CASH, perfil 1 solo y comisión 0 %", () => {
    const request = buildFulfillRequest(
      fulfillSchema.parse({ confirmationId: "abcdef", targetPcc: "x1yz" })
    )
    assert.deepEqual(request, {
      confirmationId: "ABCDEF",
      targetPcc: "X1YZ",
      fulfillments: [
        {
          payment: { primaryFormOfPayment: 1 },
          ticketingQualifiers: { commissionPercentage: "0.00" },
        },
      ],
      formsOfPayment: [{ type: "CASH" }],
      designatePrinters: [{ profileNumber: 1 }],
    })
  })

  it("no toca los defaults conservadores del SDK", () => {
    const request = buildFulfillRequest(
      fulfillSchema.parse({ confirmationId: "ABCDEF", targetPcc: "" })
    )
    assert.equal("acceptPriceChanges" in request, false)
    assert.equal("priceQuoteExpirationMethod" in request, false)
    assert.equal("targetPcc" in request, false)
  })
})

describe("buildVerifyRequest", () => {
  it("pasa los boletos del incierto como expectedTickets", () => {
    assert.deepEqual(
      buildVerifyRequest(
        verifySchema.parse({
          confirmationId: "ABCDEF",
          expectedTickets: ["0010000000001"],
        })
      ),
      { confirmationId: "ABCDEF", expectedTickets: ["0010000000001"] }
    )
  })

  it("sin boletos esperados no los manda", () => {
    assert.deepEqual(
      buildVerifyRequest(
        verifySchema.parse({ confirmationId: "ABCDEF", expectedTickets: [] })
      ),
      { confirmationId: "ABCDEF" }
    )
  })
})

describe("ticketsOf", () => {
  it("toma los boletos con número y descarta lo demás", () => {
    assert.deepEqual(
      ticketsOf({ tickets: [{ number: "1", ticketStatusCode: "TE" }, {}] }),
      [{ number: "1", ticketStatusCode: "TE" }]
    )
    assert.deepEqual(ticketsOf(undefined), [])
  })
})
