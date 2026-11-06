import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { QueueCensusExport } from "./census-export.ts"
import { booking, census } from "./census-fixture.ts"
import { summarizeCensus } from "./census-summary.ts"

/** La vista de resumen (F10.4, #98), sobre el mismo `queue-census/2` que se exporta. */

/** El censo de prueba, con una segunda cola que repite un PIC y un PNR. */
function twoQueues(): QueueCensusExport {
  const doc = census()
  const changed = booking()
  changed.isTicketed = true
  changed.hoursToPurchaseDeadline = 5
  changed.flights[0] = {
    ...changed.flights[0],
    status: "UN",
    carrier: "DL",
    departureDelayMinutes: 45,
  }
  doc.queues.push({
    queue: 9,
    count: 3,
    sampled: 2,
    ended: "limit",
    items: [
      {
        ...doc.queues[0].items[0],
        ref: "Q09-01",
        pics: [{ code: 6, text: "ADVISE SCHEDULE CHANGE" }],
        placedAgeHours: 10,
        booking: changed,
        flagged: false,
      },
      {
        ...doc.queues[0].items[1],
        ref: "Q09-02",
        pnr: "TESTAC",
        pics: [{ code: 3, text: "TICKETING" }],
        placedAgeHours: 20,
      },
    ],
  })
  return doc
}

describe("summarizeCensus", () => {
  it("arma la matriz cola × PIC y marca lo repetido entre colas", () => {
    const summary = summarizeCensus(twoQueues())
    assert.deepEqual(summary.pics, [3, 6, 11])
    assert.deepEqual(summary.matrix, [
      { queue: 7, cells: { 6: 1, 11: 1 } },
      { queue: 9, cells: { 3: 1, 6: 1 } },
    ])
    assert.deepEqual(summary.sharedPics, [6])
    assert.deepEqual(summary.sharedPnrs, [
      { pnr: "TESTAA", refs: ["Q07-01", "Q09-01"] },
    ])
  })

  it("calcula los porcentajes sobre los PNR con reserva", () => {
    const [seven, nine] = summarizeCensus(twoQueues()).queues
    assert.deepEqual(seven, {
      queue: 7,
      sampled: 2,
      withBooking: 1,
      unticketed: 1,
      pics: [
        { code: 6, count: 1 },
        { code: 11, count: 1 },
      ],
      segmentStatus: { HK: 1 },
      carriers: { AM: 1 },
      pctTicketed: 0,
      pctTawExpired: 100,
      pctScheduleChange: 0,
      meanPlacedAgeHours: 31,
    })
    assert.equal(nine?.pctTicketed, 100)
    // Sin PNR sin boleto, el TAW vencido no tiene base.
    assert.equal(nine?.unticketed, 0)
    assert.equal(nine?.pctTawExpired, null)
    assert.equal(nine?.pctScheduleChange, 100)
    assert.deepEqual(nine?.segmentStatus, { UN: 1 })
    assert.deepEqual(nine?.carriers, { DL: 1 })
    assert.equal(nine?.meanPlacedAgeHours, 15)
  })

  it("no cuenta el TAW vencido de un PNR emitido", () => {
    const doc = census()
    const issued = doc.queues[0].items[0].booking
    if (issued === null) throw new Error("fixture sin reserva")
    issued.isTicketed = true
    issued.hoursToPurchaseDeadline = -500
    const [seven] = summarizeCensus(doc).queues
    assert.equal(seven?.pctTawExpired, null)
    assert.equal(seven?.pctTicketed, 100)
  })

  it("mide el cambio de horario por el estado del segmento, no por los minutos", () => {
    const doc = census()
    const booking = doc.queues[0].items[0].booking
    if (booking === null) throw new Error("fixture sin reserva")
    booking.flights[0] = {
      ...booking.flights[0],
      status: "TK",
      departureDelayMinutes: null,
    }
    const [seven] = summarizeCensus(doc).queues
    assert.equal(seven?.pctScheduleChange, 100)
  })

  it("deja null los porcentajes de una cola sin reservas", () => {
    const doc = census()
    for (const item of doc.queues[0].items) item.booking = null
    const [seven] = summarizeCensus(doc).queues
    assert.equal(seven?.withBooking, 0)
    assert.equal(seven?.pctTicketed, null)
  })
})
