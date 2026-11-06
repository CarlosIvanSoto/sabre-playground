import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  CENSUS_SCHEMA,
  censusFileName,
  distinctPicTexts,
  isSafeLine,
  type QueueCensusExport,
  TAKEN_AT_SOURCE,
  validateCensusExport,
} from "./census-export.ts"
import type { BookingTraits } from "./census-traits.ts"

/**
 * El validador de `queue-census/1` (F10.3, #97): una prueba por regla, con datos sintéticos.
 * Los localizadores son de prueba (`TESTAA`…) y el PCC es inventado (`Z9Z9`).
 */

const PCC = "Z9Z9"
const context = { locators: new Set(["TESTAA", "TESTAB"]), pccs: [PCC] }

function booking(): BookingTraits {
  const none = { count: 0, status: [] }
  return {
    isTicketed: false,
    isCancelable: true,
    daysToStart: 12,
    tripLengthDays: 0,
    ageDays: 3,
    hoursSinceUpdate: 30,
    numberOfUpdates: 2,
    hoursToPurchaseDeadline: -3,
    createdInWorkingPcc: true,
    primeHostId: "1S",
    daysToRetention: null,
    hasRetention: false,
    hasAgencyCustomerNumber: false,
    isGroup: false,
    groupSize: null,
    hasCorporateProfile: false,
    hasEmployer: false,
    warnings: ["RESOURCE_UNAVAILABLE"],
    flights: [
      {
        source: "ATPCO",
        carrier: "AM",
        operatingCarrier: "AM",
        isCodeshare: false,
        from: "MEX",
        to: "MAD",
        international: null,
        status: "HK",
        statusName: "Confirmed",
        scheduleChangeMinutes: null,
        daysToDeparture: 12,
        isPast: false,
        bookingClass: "Y",
        cabin: "Y",
        hiddenStops: 0,
        seatsAssigned: 0,
        seatStatus: [],
      },
    ],
    journeys: 1,
    tripType: "OW",
    hotels: none,
    cars: none,
    trains: none,
    cruises: none,
    segmentTypes: ["FLIGHT"],
    fares: [
      {
        pricingType: "S",
        pricingStatus: "A",
        hasValidPricing: true,
        isNegotiatedFare: false,
        hasTourCode: false,
        hasAccountCode: false,
        brand: "MAIN",
        travelerTypeMismatch: false,
      },
    ],
    currency: "MXN",
    rules: {
      isRefundable: null,
      isChangeable: true,
      hasNoShowCost: true,
      conditionsApply: true,
    },
    tickets: {
      count: 0,
      status: [],
      daysSinceIssue: [],
      couponStatus: [],
      ticketedInWorkingPcc: null,
      isBundledTicket: false,
    },
    ancillaries: [],
    formsOfPayment: ["CASH"],
    accountingItems: [],
    nonElectronicTickets: 0,
    futureTicketing: null,
    ssr: [{ code: "ADTK", status: "KK" }],
    osi: { count: 0, carriers: [] },
    remarks: { GENERAL: 2, HIDDEN: 1 },
    queuePlaceRemarks: [],
    queuePlaceCount: 0,
    flags: {
      mentionsTicketingDeadline: true,
      mentionsCancellation: false,
      mentionsScheduleChange: false,
    },
    pax: 1,
    paxTypes: ["ADT"],
    hasIdentityDocuments: false,
    hasLoyalty: false,
  }
}

function census(): QueueCensusExport {
  return {
    schema: CENSUS_SCHEMA,
    takenAt: "2026-11-06T09:12:00.000Z",
    takenAtSource: TAKEN_AT_SOURCE,
    env: "cert",
    pcc: "P1",
    sample: { perQueue: 10, range: [0, 49] },
    complete: true,
    queues: [
      {
        queue: 7,
        count: 2,
        sampled: 2,
        ended: "end-of-display",
        items: [
          {
            ref: "Q07-01",
            pnr: "TESTAA",
            pics: [{ code: 6, text: "ADVISE SCHEDULE CHANGE" }],
            placedAgeHours: 31,
            placedBySameAsWorkingPcc: true,
            parseOk: true,
            unparsedLines: 3,
            booking: booking(),
            bookingError: null,
            flagged: true,
          },
          {
            ref: "Q07-02",
            pnr: "TESTAB",
            pics: [{ code: 11, text: "SEE REMARKS" }],
            placedAgeHours: null,
            placedBySameAsWorkingPcc: null,
            parseOk: false,
            unparsedLines: null,
            booking: null,
            bookingError: "BOOKING_NOT_FOUND",
            flagged: false,
          },
        ],
      },
    ],
    annex: {
      paragraphs: [
        {
          ref: "Q07-01",
          pnr: "TESTAA",
          lines: [
            "006  ADVISE SCHEDULE CHANGE",
            " 9.9XXXX/XXXX",
            " 9 XX999X 99XXX 9 XXXXXX XX9  9999  9999",
            "TKT/TIME LIMIT",
            "",
            "XXXX.XXXX*XXX 9999/99XXX99 XXXXXX X",
          ],
        },
      ],
    },
  }
}

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
      doc.schema = "queue-census/2"
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

  it("no deja pasar una línea con datos", () => {
    assert.ok(!isSafeLine(" 1.1TEST/PASSENGER"))
    assert.ok(!isSafeLine("RECEIVED FROM - XXX"))
    assert.ok(!isSafeLine("ñ"))
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
