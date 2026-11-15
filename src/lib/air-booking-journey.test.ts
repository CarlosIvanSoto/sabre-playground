import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  cleanupWaitingFor,
  INITIAL_JOURNEY,
  type Journey,
  type JourneyAction,
  journeyReducer,
  stepStatus,
} from "./air-booking-journey.ts"

/** El recorrido de W4 en el flujo 2 (F16.3): emitir, leer boletos, limpiar y comprobar. */

const run = (...actions: JourneyAction[]): Journey =>
  actions.reduce(journeyReducer, INITIAL_JOURNEY)

const created: JourneyAction[] = [
  { type: "created", confirmationId: "ABCDEF", targetPcc: "X1YZ" },
  { type: "read", ok: true },
]

describe("W4 en el recorrido", () => {
  it("Create guarda el PCC de la reserva", () => {
    assert.equal(run(...created).targetPcc, "X1YZ")
  })

  it("sin emisión, Limpiar no espera nada", () => {
    const state = run(...created)
    assert.equal(cleanupWaitingFor(state), undefined)
    assert.equal(stepStatus(state, "fulfill").status, "skipped")
  })

  it("con emisión, Limpiar espera el Get de boletos, que da los TE", () => {
    const issued = run(
      ...created,
      { type: "fulfill" },
      { type: "fulfilled", outcome: "issued" }
    )
    assert.notEqual(cleanupWaitingFor(issued), undefined)
    const read = journeyReducer(issued, {
      type: "ticketsRead",
      ok: true,
      liveTickets: ["0010000000001"],
    })
    assert.equal(cleanupWaitingFor(read), undefined)
    assert.deepEqual(read.liveTickets, ["0010000000001"])
  })

  it("un incierto también espera el Get, y se ve como incierto", () => {
    const state = run(
      ...created,
      { type: "fulfill" },
      { type: "fulfilled", outcome: "uncertain" }
    )
    assert.notEqual(cleanupWaitingFor(state), undefined)
    assert.equal(stepStatus(state, "fulfill").detail, "incierto: verificar")
  })

  it("Comprobar falla si un boleto anulado no está en TV", () => {
    const base: JourneyAction[] = [
      ...created,
      { type: "fulfill" },
      { type: "fulfilled", outcome: "issued" },
      { type: "ticketsRead", ok: true, liveTickets: ["0010000000001"] },
      { type: "cancelled", ok: true },
    ]
    const bad = run(...base, {
      type: "verified",
      ok: true,
      noFlights: true,
      notVoided: ["0010000000001"],
    })
    assert.equal(bad.verified, false)
    assert.equal(stepStatus(bad, "verify").status, "failed")
    assert.deepEqual(bad.notVoided, ["0010000000001"])
    const good = run(...base, {
      type: "verified",
      ok: true,
      noFlights: true,
      notVoided: [],
    })
    assert.equal(good.verified, true)
  })

  it("una emisión nueva vacía la lectura de boletos", () => {
    const state = run(
      ...created,
      { type: "fulfill" },
      { type: "fulfilled", outcome: "issued" },
      { type: "ticketsRead", ok: true, liveTickets: ["0010000000001"] },
      { type: "fulfill" }
    )
    assert.equal(state.ticketRead, false)
    assert.deepEqual(state.liveTickets, [])
  })
})
