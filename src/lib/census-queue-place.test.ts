import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { parseQueuePlace, parseQueuePlaces } from "./census-queue-place.ts"

/**
 * Los remarks `QUEUE_PLACE` (F10.7, #107). Los textos tienen la forma real de producción
 * (Q-090), con PCC inventados (`ABC`, `Z9Z9`). `HDQ` es el PCC central de Sabre.
 */

describe("parseQueuePlace", () => {
  it("lee PCC, fecha, cola y PIC de la forma real", () => {
    assert.deepEqual(parseQueuePlace("ABC25SEP146/015", "ABC"), {
      pcc: "working",
      date: "25SEP",
      queue: 146,
      pic: 15,
    })
    assert.deepEqual(parseQueuePlace("ABC15AUG134/015", ""), {
      pcc: "other",
      date: "15AUG",
      queue: 134,
      pic: 15,
    })
    assert.deepEqual(parseQueuePlace("ABC17AUG146/015", "XYZ"), {
      pcc: "other",
      date: "17AUG",
      queue: 146,
      pic: 15,
    })
    assert.deepEqual(parseQueuePlace("HDQ05JUL313/036", "ABC"), {
      pcc: "HDQ",
      date: "05JUL",
      queue: 313,
      pic: 36,
    })
  })

  it("lee un PCC de cuatro caracteres, también si termina en dígito", () => {
    assert.deepEqual(parseQueuePlace("Z9Z925SEP7/011", "Z9Z9"), {
      pcc: "working",
      date: "25SEP",
      queue: 7,
      pic: 11,
    })
    assert.deepEqual(parseQueuePlace("AB1225SEP146/015", "")?.date, "25SEP")
  })

  it("rechaza lo que no tiene la forma o trae valores imposibles", () => {
    assert.equal(parseQueuePlace("7/11", "ABC"), undefined)
    assert.equal(parseQueuePlace("25SEP ABC 146/015", "ABC"), undefined)
    assert.equal(parseQueuePlace("ABC25XYZ146/015", "ABC"), undefined)
    assert.equal(parseQueuePlace("ABC32SEP146/015", "ABC"), undefined)
    assert.equal(parseQueuePlace("ABC25SEP600/015", "ABC"), undefined)
    assert.equal(parseQueuePlace("ABC25SEP146/195", "ABC"), undefined)
  })
})

describe("parseQueuePlaces", () => {
  it("devuelve todos, o null si alguno no se reconoce", () => {
    assert.equal(
      parseQueuePlaces(["HDQ05JUL313/036", "HDQ05JUL313/036"], "")?.length,
      2
    )
    assert.equal(parseQueuePlaces(["HDQ05JUL313/036", "TEXTO LIBRE"], ""), null)
    assert.deepEqual(parseQueuePlaces([], ""), [])
  })
})
