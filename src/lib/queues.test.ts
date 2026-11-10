import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { initialQueueJourney, queueJourneyReducer } from "./queue-journey.ts"
import { formatQueueRef, parseQueueRef, queueAccessSchema } from "./queues.ts"
import type { StepRun } from "./step/types.ts"

/** `QueueRef` alfabético y `QueueStep.kind` de `sabre-client@0.5.0` (ADR-028, F11.1). */

describe("parseQueueRef", () => {
  it("da número, cola alfabética o { name }", () => {
    assert.equal(parseQueueRef("9"), 9)
    assert.equal(parseQueueRef(" s "), "S")
    assert.equal(parseQueueRef("AB"), "AB")
    assert.deepEqual(parseQueueRef("hotels"), { name: "HOTELS" })
    assert.equal(parseQueueRef("512"), undefined)
    assert.equal(parseQueueRef("9A!"), undefined)
  })

  it("formatQueueRef es su inverso", () => {
    for (const text of ["9", "S", "HOTELS"]) {
      const ref = parseQueueRef(text)
      assert.ok(ref !== undefined)
      assert.equal(formatQueueRef(ref), text)
    }
  })
})

function run(result: unknown): StepRun {
  return { enabled: true, step: { ok: true, result } } as StepRun
}

describe("queueJourneyReducer con la cola S", () => {
  it("un mensaje avanza el cursor sin PNR en pantalla", () => {
    let state = queueJourneyReducer(initialQueueJourney(), {
      type: "select",
      pcc: "",
      queue: "S",
    })
    state = queueJourneyReducer(state, {
      type: "moved",
      panel: "access",
      run: run({
        done: false,
        kind: "message",
        message: { text: ["MENSAJE DE PRUEBA"] },
        warnings: [],
      }),
    })
    assert.equal(state.current, undefined)
    assert.equal(state.visited, 1)
    assert.equal(state.ended, undefined)
  })

  it("un PNR sigue dejando su localizador en el cursor", () => {
    const state = queueJourneyReducer(initialQueueJourney("", "9"), {
      type: "moved",
      panel: "access",
      run: run({
        done: false,
        kind: "pnr",
        item: { locator: "AAAAAA", paragraph: [] },
        warnings: [],
      }),
    })
    assert.equal(state.current, "AAAAAA")
    assert.equal(state.visited, 1)
  })
})

describe("queueAccessSchema.selection (F13.1)", () => {
  const parse = (selection?: { function: string; criteria: string }[]) =>
    queueAccessSchema.parse({ queue: "9", pcc: "", selection }).selection

  it("sin filas no manda selection", () => {
    assert.equal(parse(), undefined)
    assert.equal(parse([]), undefined)
    assert.equal(parse([{ function: " ", criteria: "" }]), undefined)
  })

  it("pasa a mayúsculas y quita espacios", () => {
    assert.deepEqual(parse([{ function: " qd", criteria: "05nov " }]), [
      { function: "QD", criteria: "05NOV" },
    ])
  })

  it("no valida códigos, valores ni cantidad: eso es del SDK", () => {
    const nine = Array.from({ length: 9 }, () => ({
      function: "ZZ",
      criteria: "",
    }))
    assert.equal(parse(nine)?.length, 9)
    assert.deepEqual(parse([{ function: "", criteria: "DL" }]), [
      { function: "", criteria: "DL" },
    ])
  })
})
