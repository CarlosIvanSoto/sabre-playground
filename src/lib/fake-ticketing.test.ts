import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  DEFAULT_FAKE_TICKETING,
  FULFILL_OPTIONS,
  fakeTicketingSchema,
  toFakeTicketing,
  VOID_OPTIONS,
} from "./fake-ticketing.ts"

/** Los desenlaces forzados del fake (F16.6, #164). */

const parse = (input: object) =>
  fakeTicketingSchema.parse({ ...DEFAULT_FAKE_TICKETING, ...input })

describe("toFakeTicketing", () => {
  it("sin forzar no manda listas", () => {
    assert.deepEqual(toFakeTicketing(parse({})), {})
  })

  it("issued y voided van tal cual", () => {
    assert.deepEqual(
      toFakeTicketing(parse({ fulfill: "issued", void: "voided" })),
      { fulfill: ["issued"], void: ["voided"] }
    )
  })

  it("un incierto lleva si se hizo, solo si se eligió", () => {
    assert.deepEqual(
      toFakeTicketing(
        parse({ fulfill: "uncertain:NOT_COMMITTED", fulfillDone: "no" })
      ),
      { fulfill: [{ uncertain: "NOT_COMMITTED", issued: false }] }
    )
    assert.deepEqual(
      toFakeTicketing(parse({ void: "uncertain:END_TRANSACTION_PROBLEM" })),
      { void: [{ uncertain: "END_TRANSACTION_PROBLEM" }] }
    )
  })

  it("downline y errores del catálogo", () => {
    assert.deepEqual(
      toFakeTicketing(parse({ fulfill: "downline:COMMISSION_REQUIRED" })),
      { fulfill: [{ downline: "COMMISSION_REQUIRED" }] }
    )
    assert.deepEqual(
      toFakeTicketing(parse({ fulfill: "error:BOOKING_FULFILLED" })),
      { fulfill: [{ error: "BOOKING_FULFILLED" }] }
    )
  })

  it("cada opción del panel se convierte", () => {
    for (const option of FULFILL_OPTIONS) {
      toFakeTicketing(parse({ fulfill: option.value }))
    }
    for (const option of VOID_OPTIONS) {
      toFakeTicketing(parse({ void: option.value }))
    }
  })

  it("rechaza un desenlace que no está en el panel", () => {
    assert.equal(
      fakeTicketingSchema.safeParse({
        ...DEFAULT_FAKE_TICKETING,
        void: "uncertain:PAYMENT_CARD_ISSUE",
      }).success,
      false
    )
  })
})
