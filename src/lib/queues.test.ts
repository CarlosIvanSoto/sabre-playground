import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { initialQueueJourney, queueJourneyReducer } from "./queue-journey.ts"
import {
  formatQueueRef,
  parseQueueRef,
  queueAccessSchema,
  queueActivitySchema,
  queueCountSchema,
  queueListSchema,
} from "./queues.ts"
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

describe("queueListSchema.selection (F13.2)", () => {
  it("deja pasar un código que list no acepta: lo rechaza el SDK", () => {
    const parsed = queueListSchema.parse({
      queue: "9",
      pcc: "",
      primaryPassenger: false,
      selection: [{ function: "pi", criteria: "11" }],
    })
    assert.deepEqual(parsed.selection, [{ function: "PI", criteria: "11" }])
  })
})

describe("queueCountSchema y queueActivitySchema (F14.1)", () => {
  it("solo con pcc, como lo usa el censo", () => {
    // Las claves que faltan no aparecen: la llamada del censo queda como antes.
    assert.deepEqual(queueCountSchema.parse({ pcc: "" }), { pcc: undefined })
  })

  it("cola, rango y filtros como texto", () => {
    const parsed = queueCountSchema.parse({
      pcc: "",
      queue: "20",
      range: { start: "", end: "" },
      selection: [{ function: "qd", criteria: "08nov" }],
    })
    assert.equal(parsed.queue, 20)
    assert.equal(parsed.range, undefined)
    assert.deepEqual(parsed.selection, [{ function: "QD", criteria: "08NOV" }])
  })

  it("no valida combinaciones ni extremos: eso es del SDK", () => {
    const parsed = queueCountSchema.parse({
      pcc: "",
      queue: "9",
      range: { start: "25", end: "" },
      selection: [{ function: "QD", criteria: "08NOV" }],
    })
    assert.equal(parsed.queue, 9)
    assert.equal(parsed.range?.start, 25)
    assert.ok(Number.isNaN(parsed.range?.end))
  })

  it("una cola que no es cola sí la marca el formulario", () => {
    assert.equal(
      queueActivitySchema.safeParse({ pcc: "", queue: "9A!" }).success,
      false
    )
    assert.deepEqual(
      queueActivitySchema.parse({ pcc: "", range: { start: "1", end: "25" } })
        .range,
      { start: 1, end: 25 }
    )
  })
})
