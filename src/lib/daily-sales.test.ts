import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { DailySalesTransaction } from "sabre-client"
import {
  dailySalesOf,
  dailySalesSchema,
  isVoided,
  salesCounts,
} from "./daily-sales.ts"

/** Las ventas del día (F16.5, #163, ADR-030). */

const sale = (documentStatusCode?: string): DailySalesTransaction => ({
  documentType: "TKT",
  transactionCode: "SALE",
  settlementType: "ARC",
  documentNumber: "0010000000001",
  airline: { code: "AA" },
  agentSine: "AAA",
  transactionDateTime: "2026-11-14T09:12:00.000",
  ...(documentStatusCode === undefined ? {} : { documentStatusCode }),
})

describe("salesCounts", () => {
  it("las anuladas (V) quedan fuera de las vigentes", () => {
    assert.deepEqual(salesCounts([sale(), sale("V"), sale("E")]), {
      total: 3,
      voided: 1,
      live: 2,
    })
    assert.equal(isVoided(sale("V")), true)
    assert.equal(isVoided(sale()), false)
  })
})

describe("dailySalesSchema", () => {
  it("vacíos son el día en curso y el home PCC", () => {
    assert.deepEqual(dailySalesSchema.parse({ pcc: "", date: "" }), {
      pcc: undefined,
      date: undefined,
    })
  })

  it("una fecha y un PCC", () => {
    assert.deepEqual(
      dailySalesSchema.parse({ pcc: "x1yz", date: "2026-11-13" }),
      { pcc: "X1YZ", date: "2026-11-13" }
    )
  })

  it("rechaza otra forma de fecha", () => {
    assert.equal(dailySalesSchema.safeParse({ date: "13NOV" }).success, false)
  })
})

describe("dailySalesOf", () => {
  it("reconoce el resultado y descarta lo demás", () => {
    assert.equal(
      dailySalesOf({ status: "deferred", transactions: [], totals: [] })
        ?.status,
      "deferred"
    )
    assert.equal(dailySalesOf({}), undefined)
  })
})
