import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  commandToken,
  commandVerdict,
  gateCommand,
  ISSUE_BLOCKED_REASON,
  MAX_COMMAND_LENGTH,
  matchHostCommand,
  sabreCommandLength,
  templatePrefix,
  toHostSeparator,
} from "./host-command-policy.ts"

/** Las reglas por entorno de la consola de comandos (ADR-032, F15.1). */

const PROD = true
const CERT = false

describe("sabreCommandLength", () => {
  it("cuenta 2 los caracteres dobles de Sabre", () => {
    assert.equal(sabreCommandLength("*S*P"), 4)
    assert.equal(sabreCommandLength("W/PT¥*"), 7)
    assert.equal(sabreCommandLength("!%$&¥§"), 12)
  })
})

describe("toHostSeparator", () => {
  it("cambia ‡ por ¥", () => {
    assert.equal(toHostSeparator("W/PT‡*"), "W/PT¥*")
    assert.equal(toHostSeparator("DC‡USD1‡X"), "DC¥USD1¥X")
  })
})

describe("commandToken", () => {
  it("corta al primer separador y a 4 caracteres, como el log del SDK", () => {
    assert.equal(commandToken("W/PT¥ON"), "W/PT")
    assert.equal(commandToken("*ABC123"), "*ABC")
    assert.equal(commandToken("SI9"), "SI9")
    assert.equal(commandToken("DC‡USD1"), "DC")
  })
})

describe("templatePrefix", () => {
  it("corta al primer marcador o al …", () => {
    assert.equal(templatePrefix("PE*<PCC>"), "PE*")
    assert.equal(templatePrefix("W¥…"), "W¥")
    assert.equal(templatePrefix("*S*P"), "*S*P")
  })
})

describe("matchHostCommand", () => {
  it("gana el prefijo más largo", () => {
    assert.equal(matchHostCommand("W/PT¥ON")?.type, "escritura")
    assert.equal(matchHostCommand("w/pt‡*")?.type, "lectura")
    assert.equal(matchHostCommand("PE*TEST")?.template, "PE*<PCC>")
  })

  it("un comando con § no corresponde a ninguno", () => {
    assert.equal(matchHostCommand("*S*P§W/PT¥ON"), undefined)
  })
})

describe("commandVerdict en producción", () => {
  it("manda las lecturas del panel", () => {
    assert.equal(commandVerdict("*S*P", PROD).kind, "allowed")
    assert.equal(commandVerdict("W/PT¥*", PROD).kind, "allowed")
    assert.equal(commandVerdict("PE*TEST", PROD).kind, "allowed")
    assert.equal(commandVerdict("W/TA*TEST", PROD).kind, "allowed")
  })

  it("rechaza escrituras, lo que no está en el panel y lo compuesto", () => {
    assert.equal(commandVerdict("W/PT¥ON", PROD).kind, "blocked")
    assert.equal(commandVerdict("W/PT‡ON", PROD).kind, "blocked")
    assert.equal(commandVerdict("XYZ", PROD).kind, "blocked")
    assert.equal(commandVerdict("*S*P§W/PT¥ON", PROD).kind, "blocked")
  })
})

describe("commandVerdict en CERT", () => {
  it("manda las lecturas sin preguntar", () => {
    assert.equal(commandVerdict("*S*P", CERT).kind, "allowed")
    assert.equal(commandVerdict("W/PT¥*", CERT).kind, "allowed")
  })

  it("pide confirmación para escrituras y para lo que no está en el panel", () => {
    assert.equal(commandVerdict("W/PT¥ON", CERT).kind, "confirm")
    assert.equal(commandVerdict("XYZ", CERT).kind, "confirm")
    assert.equal(commandVerdict("*S*P§W/PT¥ON", CERT).kind, "confirm")
  })
})

describe("emisión por comando", () => {
  for (const [label, readOnly] of [
    ["CERT", CERT],
    ["producción", PROD],
  ] as const) {
    it(`se rechaza en ${label}, con ¥ o con ‡, y dentro de un compuesto`, () => {
      for (const command of ["W¥FCASH", "W‡FCASH", "w¥x", "*R§W¥FCASH"]) {
        const verdict = commandVerdict(command, readOnly)
        assert.equal(verdict.kind, "blocked", command)
        assert.equal(
          verdict.kind === "blocked" && verdict.reason,
          ISSUE_BLOCKED_REASON
        )
      }
    })
  }
})

describe("commandVerdict con el largo", () => {
  it("rechaza vacío y más largo que el máximo", () => {
    assert.equal(commandVerdict("   ", CERT).kind, "invalid")
    assert.equal(
      commandVerdict("¥".repeat(MAX_COMMAND_LENGTH / 2 + 1), CERT).kind,
      "invalid"
    )
    assert.equal(
      commandVerdict("A".repeat(MAX_COMMAND_LENGTH), CERT).kind,
      "confirm"
    )
  })
})

describe("marcadores sin llenar", () => {
  it("se rechazan en todos los entornos, aunque vengan confirmados", () => {
    for (const readOnly of [CERT, PROD]) {
      assert.equal(commandVerdict("PE*<PCC>", readOnly).kind, "invalid")
      assert.equal(gateCommand("W/TA*<PCC>", true, readOnly).ok, false)
    }
  })
})

describe("match exacto o con forma", () => {
  const commands = [
    {
      template: "I",
      description: "-",
      group: "pnr",
      type: "sesion",
      source: "-",
      match: "exact",
    },
    {
      template: "*<localizador>",
      description: "-",
      group: "pnr",
      type: "sesion",
      source: "-",
      match: /^\*[A-Z]{6}$/u,
    },
    {
      template: "*R",
      description: "-",
      group: "pnr",
      type: "lectura",
      source: "-",
    },
  ] as const

  it("exact pide el comando completo", () => {
    assert.equal(matchHostCommand("i", commands)?.template, "I")
    assert.equal(matchHostCommand("IXYZ", commands), undefined)
  })

  it("la forma le gana al prefijo", () => {
    assert.equal(matchHostCommand("*RABCDE", commands)?.type, "sesion")
    assert.equal(matchHostCommand("*R", commands)?.type, "lectura")
    assert.equal(matchHostCommand("*ABC", commands), undefined)
  })
})

describe("gateCommand (lo que decide la server action)", () => {
  it("en producción rechaza W/PT¥ON aunque venga confirmado", () => {
    assert.equal(gateCommand("W/PT¥ON", true, PROD).ok, false)
  })

  it("en CERT, W/PT¥ON solo con la confirmación", () => {
    assert.equal(gateCommand("W/PT¥ON", false, CERT).ok, false)
    assert.deepEqual(gateCommand(" W/PT‡ON ", true, CERT), {
      ok: true,
      command: "W/PT¥ON",
    })
  })

  it("la emisión no pasa ni confirmada", () => {
    assert.equal(gateCommand("W¥FCASH", true, CERT).ok, false)
  })

  it("una lectura pasa sin confirmación", () => {
    assert.deepEqual(gateCommand("*S*P", false, PROD), {
      ok: true,
      command: "*S*P",
    })
  })
})
