import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  censusFileName,
  distinctPicTexts,
  isSafeLine,
  maskCensusParagraph,
  validateCensusExport,
} from "./census-export.ts"
import { census, context, PCC } from "./census-fixture.ts"

/**
 * El validador de `queue-census/2` (F10.3, #97): una prueba por regla, con datos sintéticos.
 * Los localizadores son de prueba (`TESTAA`…) y el PCC es inventado (`Z9Z9`).
 */

/** Una copia del censo con un cambio: el test escribe a mano lo que el esquema no deja. */
// biome-ignore lint/suspicious/noExplicitAny: el test rompe la forma a propósito.
type Loose = any

function mutate(change: (doc: Loose) => void): unknown {
  const doc: Loose = structuredClone(census())
  change(doc)
  return doc
}

const paths = (doc: unknown) =>
  validateCensusExport(doc, context).map((issue) => issue.path)

describe("validateCensusExport", () => {
  it("acepta un censo válido", () => {
    assert.deepEqual(validateCensusExport(census(), context), [])
  })

  it("rechaza un campo fuera del esquema, con la referencia del PNR", () => {
    const issues = validateCensusExport(
      mutate((doc) => {
        doc.queues[0].items[1].passenger = "TEST/PASSENGER"
      }),
      context
    )
    assert.equal(issues[0]?.path, "queues[0].items[1].passenger")
    assert.equal(issues[0]?.ref, "Q07-02")
  })

  it("rechaza un campo que falta", () => {
    const doc = mutate((doc) => {
      delete doc.queues[0].items[0].booking.pax
    })
    assert.ok(paths(doc).includes("queues[0].items[0].booking.pax"))
  })

  it("rechaza un nombre en un campo con expresión cerrada", () => {
    const doc = mutate((doc) => {
      doc.queues[0].items[0].booking.flights[0].from = "PASSENGER"
    })
    assert.deepEqual(paths(doc), ["queues[0].items[0].booking.flights[0].from"])
  })

  it("rechaza un texto PIC con forma de nombre", () => {
    const doc = mutate((doc) => {
      doc.queues[0].items[0].pics[0].text = "1.1TEST/PASSENGER"
    })
    assert.deepEqual(paths(doc), ["queues[0].items[0].pics[0].text"])
  })

  it("rechaza un texto PIC con un título de pasajero", () => {
    const doc = mutate((doc) => {
      doc.queues[0].items[0].pics[0].text = "CALL TEST PASSENGER MR"
    })
    assert.deepEqual(paths(doc), ["queues[0].items[0].pics[0].text"])
  })

  it("rechaza un PCC en cualquier valor", () => {
    const doc = mutate((doc) => {
      doc.queues[0].items[0].pics[0].text = `PLACED BY ${PCC}`
    })
    assert.deepEqual(paths(doc), ["queues[0].items[0].pics[0].text"])
  })

  it("rechaza el PCC real como alias", () => {
    const doc = mutate((doc) => {
      doc.pcc = PCC
    })
    assert.deepEqual(paths(doc), ["pcc"])
  })

  it("rechaza una cadena con forma de localizador fuera de pnr", () => {
    const doc = mutate((doc) => {
      doc.queues[0].items[0].booking.segmentTypes = ["ZXCVBN"]
    })
    assert.deepEqual(paths(doc), ["queues[0].items[0].booking.segmentTypes[0]"])
  })

  it("rechaza un localizador leído dentro de otro texto", () => {
    const doc = mutate((doc) => {
      doc.queues[0].items[0].booking.warnings = ["SEE_TESTAB"]
    })
    assert.deepEqual(paths(doc), ["queues[0].items[0].booking.warnings[0]"])
  })

  it("rechaza un localizador en una clave", () => {
    const doc = mutate((doc) => {
      doc.queues[0].items[0].booking.remarks = { TESTAB: 1 }
    })
    assert.deepEqual(paths(doc), ["queues[0].items[0].booking.remarks.TESTAB"])
  })

  it("acepta los enums de seis letras conocidos", () => {
    const doc = mutate((doc) => {
      doc.queues[0].items[0].booking.formsOfPayment = ["DOCKET"]
    })
    assert.deepEqual(paths(doc), [])
  })

  it("acepta una marca de tarifa de seis caracteres", () => {
    const doc = mutate((doc) => {
      doc.queues[0].items[0].booking.fares[0].brand = "BASICX"
    })
    assert.deepEqual(paths(doc), [])
  })

  it("rechaza una marca de tarifa que es un localizador leído", () => {
    const doc = mutate((doc) => {
      doc.queues[0].items[0].booking.fares[0].brand = "TESTAB"
    })
    assert.deepEqual(paths(doc), ["queues[0].items[0].booking.fares[0].brand"])
  })

  it("acepta queuePlaceRemarks en null (remark fuera de la expresión)", () => {
    const doc = mutate((doc) => {
      doc.queues[0].items[0].booking.queuePlaceRemarks = null
      doc.queues[0].items[0].booking.queuePlaceCount = 2
    })
    assert.deepEqual(paths(doc), [])
  })

  it("acepta remarks QUEUE_PLACE con PCC como enum", () => {
    const doc = mutate((doc) => {
      doc.queues[0].items[0].booking.queuePlaceRemarks = [
        { pcc: "working", date: "25SEP", queue: 146, pic: 15 },
        { pcc: "HDQ", date: "05JUL", queue: 313, pic: 36 },
      ]
      doc.queues[0].items[0].booking.queuePlaceCount = 2
    })
    assert.deepEqual(paths(doc), [])
  })

  it("rechaza el PCC real o una fecha inválida en un remark QUEUE_PLACE", () => {
    const doc = mutate((doc) => {
      doc.queues[0].items[0].booking.queuePlaceRemarks = [
        { pcc: PCC, date: "25SEP", queue: 146, pic: 15 },
        { pcc: "other", date: "32SEP", queue: 146, pic: 15 },
      ]
    })
    assert.deepEqual(paths(doc).sort(), [
      "queues[0].items[0].booking.queuePlaceRemarks[0].pcc",
      "queues[0].items[0].booking.queuePlaceRemarks[1].date",
    ])
  })

  it("rechaza el nombre de /1 para la demora", () => {
    const doc = mutate((doc) => {
      const flight = doc.queues[0].items[0].booking.flights[0]
      flight.scheduleChangeMinutes = flight.departureDelayMinutes
      delete flight.departureDelayMinutes
    })
    assert.deepEqual(paths(doc).sort(), [
      "queues[0].items[0].booking.flights[0].departureDelayMinutes",
      "queues[0].items[0].booking.flights[0].scheduleChangeMinutes",
    ])
  })

  it("rechaza un pnr que no leyó la consola", () => {
    const doc = mutate((doc) => {
      doc.queues[0].items[1].pnr = "ZZZZZZ"
      doc.annex.paragraphs = []
    })
    assert.deepEqual(paths(doc), ["queues[0].items[1].pnr"])
  })

  it("rechaza un pnr con otra forma", () => {
    const doc = mutate((doc) => {
      doc.queues[0].items[1].pnr = "testab"
    })
    assert.deepEqual(paths(doc), ["queues[0].items[1].pnr"])
  })

  it("rechaza un PIC fuera de rango", () => {
    const doc = mutate((doc) => {
      doc.queues[0].items[0].pics[0].code = 195
    })
    assert.deepEqual(paths(doc), ["queues[0].items[0].pics[0].code"])
  })

  it("rechaza tipos equivocados", () => {
    const doc = mutate((doc) => {
      doc.queues[0].items[0].booking.daysToStart = "12"
      doc.queues[0].items[0].parseOk = "true"
      doc.queues[0].count = 1.5
    })
    assert.deepEqual(paths(doc).sort(), [
      "queues[0].count",
      "queues[0].items[0].booking.daysToStart",
      "queues[0].items[0].parseOk",
    ])
  })

  it("rechaza null donde no se admite", () => {
    const doc = mutate((doc) => {
      doc.queues[0].items[0].booking.flags = null
    })
    assert.deepEqual(paths(doc), ["queues[0].items[0].booking.flags"])
  })

  it("rechaza un esquema o una fuente de takenAt distintos", () => {
    const doc = mutate((doc) => {
      doc.schema = "queue-census/1"
      doc.takenAtSource = "browser"
    })
    assert.deepEqual(paths(doc).sort(), ["schema", "takenAtSource"])
  })

  it("rechaza una línea sin enmascarar en el anexo", () => {
    const doc = mutate((doc) => {
      doc.annex.paragraphs[0].lines.push(" 1.1TEST/PASSENGER")
    })
    assert.deepEqual(paths(doc), ["annex.paragraphs[0].lines[6]"])
  })

  it("rechaza una línea de lista con localizador en el anexo", () => {
    const doc = mutate((doc) => {
      doc.annex.paragraphs[0].lines.push("100  ABC123  PLT  MAM  01JUN26  1948")
    })
    assert.deepEqual(paths(doc), ["annex.paragraphs[0].lines[6]"])
  })

  it("rechaza un anexo que no coincide con el PNR de su referencia", () => {
    const doc = mutate((doc) => {
      doc.annex.paragraphs[0].pnr = "TESTAB"
    })
    assert.deepEqual(paths(doc), ["annex.paragraphs[0].pnr"])
  })

  it("rechaza algo que no es un objeto", () => {
    assert.deepEqual(paths(null), [""])
    assert.ok(paths([]).length > 0)
  })
})

describe("isSafeLine", () => {
  it("deja pasar la lista blanca y las líneas enmascaradas", () => {
    assert.ok(isSafeLine("011  SEE REMARKS"))
    assert.ok(isSafeLine("END OF DISPLAY FOR REQUESTED DATA"))
    assert.ok(isSafeLine("XXXX@XXXX.XXX"))
    assert.ok(isSafeLine(""))
  })

  it("deja pasar la firma y RECEIVED FROM como las deja el SDK", () => {
    assert.ok(isSafeLine("9XXX.9XXX*XXX 9999/99XXX99 XXX999 H"))
    assert.ok(isSafeLine("RECEIVED FROM - XXX"))
  })

  it("no deja pasar una firma con el sine, el PCC, la hora o el localizador", () => {
    assert.ok(!isSafeLine("Z9Z9.Z9Z9*ABC 9999/99XXX99 XXXXXX H"))
    assert.ok(!isSafeLine("9XXX.9XXX*XXX 1948/01JUN26 XXXXXX H"))
    assert.ok(!isSafeLine("9XXX.9XXX*XXX 9999/99XXX99 TESTAA H"))
    assert.ok(!isSafeLine("9XXX.9XXX*XXX 9999/99XXX99 AAAAAA H"))
  })

  it("no deja pasar el aviso PIC con dígitos: una línea de lista trae el sine", () => {
    assert.ok(!isSafeLine("100  ABC123  PLT  MAM  01JUN26  1948"))
    assert.ok(!isSafeLine("011  SEE REMARKS 2"))
  })

  it("no deja pasar una línea con datos", () => {
    assert.ok(!isSafeLine(" 1.1TEST/PASSENGER"))
    assert.ok(!isSafeLine("RECEIVED FROM - TEST"))
    assert.ok(!isSafeLine("ñ"))
  })
})

describe("maskCensusParagraph", () => {
  // Un párrafo sintético: localizador de prueba, PCC inventado (`Z9Z9`) y sine `ABC`.
  const paragraph = [
    "011  SEE REMARKS",
    " 1.1TEST/PASSENGER",
    "100  ABC123  PLT  MAM  01JUN26  1948",
    "RECEIVED FROM - TEST",
    "Z9Z9.Z9Z9*ABC 1948/01JUN26 TESTAA H",
  ]

  it("enmascara con el SDK: la firma conserva su forma, sin localizador", () => {
    const masked = maskCensusParagraph(paragraph)
    assert.deepEqual(masked, [
      "011  SEE REMARKS",
      " 9.9XXXX/XXXXXXXXX",
      "999  XXX999  XXX  XXX  99XXX99  9999",
      "RECEIVED FROM - XXXX",
      "X9X9.X9X9*XXX 9999/99XXX99 XXXXXX H",
    ])
    assert.ok(masked.every(isSafeLine))
    const text = masked.join("\n")
    for (const leak of [PCC, "ABC", "TESTAA"]) assert.ok(!text.includes(leak))
  })

  it("no recuerda localizadores entre llamadas: tampoco da alias", () => {
    maskCensusParagraph(["Z9Z9.Z9Z9*ABC 1948/01JUN26 AAAAAB H"])
    assert.deepEqual(
      maskCensusParagraph(["Z9Z9.Z9Z9*ABC 1948/01JUN26 AAAAAB H"]),
      ["X9X9.X9X9*XXX 9999/99XXX99 XXXXXX H"]
    )
  })

  it("el anexo enmascarado pasa el validador", () => {
    const doc = census()
    doc.annex.paragraphs[0].lines = maskCensusParagraph(paragraph)
    assert.deepEqual(validateCensusExport(doc, context), [])
  })
})

describe("distinctPicTexts y censusFileName", () => {
  it("junta los textos PIC repetidos", () => {
    assert.deepEqual(distinctPicTexts(census()), [
      { code: 6, text: "ADVISE SCHEDULE CHANGE", count: 1 },
      { code: 11, text: "SEE REMARKS", count: 1 },
    ])
  })

  it("arma el nombre con el alias y el día", () => {
    assert.equal(censusFileName(census()), "censo-colas-p1-2026-11-06.json")
  })
})
