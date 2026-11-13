import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { insertAt, NO_RECALL, recall } from "./command-line.ts"
import { toHostSeparator } from "./host-command-policy.ts"

/** La línea de comando de la consola (F15.2). */

describe("insertAt", () => {
  it("pone el texto en el cursor o en lugar de la selección", () => {
    assert.deepEqual(insertAt("W/PT*", 4, 4, "¥"), {
      value: "W/PT¥*",
      caret: 5,
    })
    assert.deepEqual(insertAt("W/PT‡*", 4, 5, "¥"), {
      value: "W/PT¥*",
      caret: 5,
    })
  })
})

describe("pegar un formato de Sabre Red", () => {
  it("W/PT‡* queda W/PT¥*", () => {
    assert.equal(toHostSeparator("W/PT‡*"), "W/PT¥*")
  })
})

describe("recall", () => {
  const sent = ["*S*P", "PP*", "W/PT¥*"]

  it("↑ sube desde el más nuevo y guarda lo que se estaba escribiendo", () => {
    const first = recall(sent, NO_RECALL, "PE", -1)
    assert.equal(first?.value, "W/PT¥*")
    const second = first && recall(sent, first.state, first.value, -1)
    assert.equal(second?.value, "PP*")
    const third = second && recall(sent, second.state, second.value, -1)
    assert.equal(third?.value, "*S*P")
    assert.equal(third && recall(sent, third.state, third.value, -1), undefined)
  })

  it("↓ al final vuelve al borrador", () => {
    const up = recall(sent, NO_RECALL, "PE", -1)
    const down = up && recall(sent, up.state, up.value, 1)
    assert.equal(down?.value, "PE")
    assert.equal(down?.state.index, undefined)
  })

  it("sin comandos, o ↓ sin haber subido, no hace nada", () => {
    assert.equal(recall([], NO_RECALL, "", -1), undefined)
    assert.equal(recall(sent, NO_RECALL, "", 1), undefined)
  })
})
