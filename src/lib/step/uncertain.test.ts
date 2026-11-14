import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { StepResult, StepRun } from "./types.ts"
import { uncertainOf, uncertainOfError } from "./uncertain.ts"

/** El desenlace incierto de la 0.7.0 (ADR-031, F16.1). */

function failed(error: StepResult["error"]): StepRun {
  return {
    enabled: true,
    step: { ok: false, error, log: [], durationMs: 1 },
  }
}

describe("uncertainOf", () => {
  it("reconoce SabreUncertainOutcomeError con su reason y sus boletos", () => {
    const outcome = uncertainOf(
      failed({
        class: "SabreUncertainOutcomeError",
        message: "no se sabe si se anuló",
        reason: "END_TRANSACTION_PROBLEM",
        operation: "booking.cancel",
        confirmationId: "ABCDEF",
        tickets: [{ number: "0000000000001", ticketStatusCode: "TE" }],
      })
    )
    assert.equal(outcome?.reason, "END_TRANSACTION_PROBLEM")
    assert.equal(outcome?.operation, "booking.cancel")
    assert.equal(outcome?.tickets.length, 1)
  })

  it("sin tickets da una lista vacía", () => {
    const outcome = uncertainOfError({
      class: "SabreUncertainOutcomeError",
      message: "abortado",
      reason: "ABORTED",
    })
    assert.deepEqual(outcome?.tickets, [])
  })

  it("un error de negocio no es incierto", () => {
    assert.equal(
      uncertainOf(
        failed({
          class: "SabreBusinessError",
          message: "x",
          code: "NO_ITEMS_CANCELLED",
        })
      ),
      undefined
    )
  })

  it("una corrida ok, deshabilitada o sin correr no es incierta", () => {
    assert.equal(uncertainOf(undefined), undefined)
    assert.equal(uncertainOf({ enabled: false, reason: "x" }), undefined)
    assert.equal(
      uncertainOf({
        enabled: true,
        step: { ok: true, result: {}, log: [], durationMs: 1 },
      }),
      undefined
    )
  })
})
