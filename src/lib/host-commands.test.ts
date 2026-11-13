import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { nextPlaceholder, placeholders } from "./command-line.ts"
import {
  commandVerdict,
  matchHostCommand,
  suggestHostCommands,
} from "./host-command-policy.ts"
import { HOST_COMMAND_GROUPS, HOST_COMMANDS } from "./host-commands.ts"

/** Los datos del panel de comandos conocidos (F15.3), copiados de comandos-de-host. */

const TYPES = new Set(["lectura", "sesion", "escritura", "emite"])
const GROUPS = new Set(HOST_COMMAND_GROUPS.map((group) => group.id))

describe("HOST_COMMANDS", () => {
  it("cada entrada tiene plantilla, qué hace, grupo, tipo y fuente", () => {
    for (const entry of HOST_COMMANDS) {
      assert.ok(entry.template.trim() !== "", "plantilla vacía")
      assert.ok(entry.description.trim() !== "", entry.template)
      assert.ok(GROUPS.has(entry.group), entry.template)
      assert.ok(TYPES.has(entry.type), entry.template)
      assert.ok(entry.source.trim() !== "", entry.template)
    }
  })

  it("no hay dos plantillas iguales", () => {
    const seen = new Set<string>()
    for (const { template } of HOST_COMMANDS) {
      assert.ok(!seen.has(template), `repetida: ${template}`)
      seen.add(template)
    }
  })

  it("usa ¥ y no ‡, como se manda por la API", () => {
    for (const { template } of HOST_COMMANDS) {
      assert.ok(!template.includes("‡"), template)
    }
  })

  it("tiene todos los grupos de la página del wiki, incluido Impresoras", () => {
    const used = new Set(HOST_COMMANDS.map((entry) => entry.group))
    for (const group of HOST_COMMAND_GROUPS) assert.ok(used.has(group.id))
  })

  it("PE*<PCC> y W/TA*<PCC> son lecturas (se mandan en producción, #153)", () => {
    assert.equal(matchHostCommand("PE*TEST")?.type, "lectura")
    assert.equal(matchHostCommand("PE*TEST/STAGE")?.type, "lectura")
    assert.equal(matchHostCommand("W/TA*TEST")?.type, "lectura")
  })

  it("SI9 es de sesión y PPS1 no se confunde con PP*", () => {
    assert.equal(matchHostCommand("SI9")?.type, "sesion")
    assert.equal(matchHostCommand("PPS1")?.template, "PPS<n>")
    assert.equal(matchHostCommand("PP*")?.type, "lectura")
  })
})

describe("plantillas que piden el comando completo (ADR-032, hallazgo 2)", () => {
  it("I, IR, E y ER solo coinciden enteros", () => {
    assert.equal(matchHostCommand("I")?.template, "I")
    assert.equal(matchHostCommand("ir")?.template, "IR")
    assert.equal(matchHostCommand("ER")?.template, "ER")
    assert.equal(matchHostCommand("IXYZ"), undefined)
    assert.equal(matchHostCommand("EXYZ"), undefined)
  })

  it("*<localizador> es * y 6 letras; lo demás con * queda fuera del panel", () => {
    assert.equal(matchHostCommand("*ABCDEF")?.template, "*<localizador>")
    assert.equal(matchHostCommand("*RABCDE")?.template, "*<localizador>")
    assert.equal(matchHostCommand("*ABC"), undefined)
    assert.equal(matchHostCommand("*ABC1234"), undefined)
    assert.equal(matchHostCommand("*R")?.type, "lectura")
  })

  it("AAA<PCC> es AAA y 3 o 4 alfanuméricos", () => {
    assert.equal(matchHostCommand("AAAH8GI")?.template, "AAA<PCC>")
    assert.equal(matchHostCommand("AAAX1Y")?.template, "AAA<PCC>")
    assert.equal(matchHostCommand("AAAH8GIX"), undefined)
  })

  it("fuera del panel: en CERT pide confirmación y en producción se rechaza", () => {
    assert.equal(commandVerdict("IXYZ", false).kind, "confirm")
    assert.equal(commandVerdict("*ABC", true).kind, "blocked")
  })

  it("cualquier conversión DC¥ con esa forma es lectura", () => {
    assert.equal(commandVerdict("DC¥EUR100/MXN/01JAN26", true).kind, "allowed")
  })
})

describe("suggestHostCommands", () => {
  it("PE sugiere PE*<PCC>, de lectura", () => {
    const [first] = suggestHostCommands("pe")
    assert.equal(first?.template, "PE*<PCC>")
    assert.equal(first?.type, "lectura")
  })
})

describe("marcadores", () => {
  const template = "W*<tipo><dirección>"

  it("encuentra los marcadores en orden", () => {
    assert.deepEqual(placeholders(template), [
      { start: 2, end: 8 },
      { start: 8, end: 19 },
    ])
  })

  it("Tab salta al siguiente y Shift+Tab al anterior", () => {
    assert.deepEqual(nextPlaceholder(template, 0, 0), { start: 2, end: 8 })
    assert.deepEqual(nextPlaceholder(template, 2, 8), { start: 8, end: 19 })
    assert.equal(nextPlaceholder(template, 8, 19), undefined)
    assert.deepEqual(nextPlaceholder(template, 8, 19, -1), {
      start: 2,
      end: 8,
    })
  })
})
