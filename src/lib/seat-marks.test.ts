import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { GetSeatsResponse, Seat } from "sabre-client"
import {
  characteristicText,
  findSeat,
  hostSeatMapOf,
  riskySeats,
  seatMarks,
  seatPrices,
} from "./seat-marks.ts"

/** Marcas del mapa de asientos (F16.7, #165). Datos sintéticos con la forma de Get Seats. */

const free: Seat = {
  column: "A",
  occupationStatusCode: "F",
  characteristics: [{ code: "W", description: "Window" }],
}
const paid: Seat = {
  column: "A",
  occupationStatusCode: "F",
  characteristics: [{ code: "CH", description: "Chargeable" }],
  offerItemRefIds: ["OI1"],
}
const preferred: Seat = {
  column: "C",
  occupationStatusCode: "F",
  characteristics: [
    { code: "A", description: "Aisle" },
    { code: "O", description: "PreferredSeat" },
    { code: "1", description: "RestrictedGeneral" },
  ],
}

const availability = {
  warnings: [],
  errors: [],
  response: {
    segments: [],
    passengers: [],
    serviceDefinitions: [],
    offerItems: [
      {
        id: "OI1",
        serviceDefinitionRef: "SD1",
        priceDefinitionRef: "PD1",
        segmentRefs: ["S2"],
        passengerRefs: ["P1"],
      },
    ],
    priceDefinitions: [
      { id: "PD1", currencyCode: "MXN", totalPrice: { amount: 859 } },
    ],
    seatMaps: [
      {
        segmentRef: "S2",
        cabinCompartments: [
          {
            seatRows: [
              { row: 10, seats: [paid] },
              { row: 15, seats: [preferred] },
              { row: 16, seats: [free] },
            ],
          },
        ],
      },
    ],
  },
} satisfies GetSeatsResponse

describe("seatMarks", () => {
  it("un asiento libre sin marcas", () => {
    assert.deepEqual(seatMarks(free), [])
  })

  it("de pago por offerItemRefIds o por CH", () => {
    assert.deepEqual(seatMarks(paid), ["priced"])
    assert.deepEqual(
      seatMarks({ column: "B", characteristics: [{ code: "CH" }] }),
      ["priced"]
    )
  })

  it("preferente (O) y restringido (1), sin CH", () => {
    assert.deepEqual(seatMarks(preferred), ["preferred", "restricted"])
  })

  it("el occupationStatusCode O (ocupado) no es preferente", () => {
    assert.deepEqual(seatMarks({ column: "A", occupationStatusCode: "O" }), [])
  })
})

describe("characteristicText", () => {
  it("código y descripción, o solo el código", () => {
    assert.equal(
      characteristicText({ code: "O", description: "PreferredSeat" }),
      "O PreferredSeat"
    )
    assert.equal(characteristicText({ code: "1" }), "1")
  })
})

describe("seatPrices", () => {
  it("resuelve el precio por offerItems y priceDefinitions", () => {
    assert.deepEqual(seatPrices(paid, availability.response), ["859 MXN"])
    assert.deepEqual(seatPrices(free, availability.response), [])
  })
})

describe("findSeat", () => {
  it("por segmento y número", () => {
    assert.equal(findSeat(availability.response, "S2", "15C"), preferred)
    assert.equal(findSeat(availability.response, "S1", "15C"), undefined)
    assert.equal(findSeat(availability.response, "S2", "99Z"), undefined)
  })
})

describe("riskySeats", () => {
  it("solo los elegidos con marcas", () => {
    assert.deepEqual(
      riskySeats(
        [
          { segmentIndex: 2, travelerIndex: 1, number: "15C" },
          { segmentIndex: 2, travelerIndex: 1, number: "16A" },
        ],
        availability
      ),
      [
        {
          segmentRef: "S2",
          number: "15C",
          marks: ["preferred", "restricted"],
        },
      ]
    )
  })

  it("sin mapa no hay nada que avisar", () => {
    assert.deepEqual(
      riskySeats(
        [{ segmentIndex: 2, travelerIndex: 1, number: "15C" }],
        undefined
      ),
      []
    )
  })
})

describe("hostSeatMapOf", () => {
  it("parte en renglones el mapa de un rechazo de AirSeatLLSRQ", () => {
    const map = hostSeatMapOf({
      class: "SabreBusinessError",
      message: "Create Booking falló",
      errors: [
        {
          type: "DOWNLINE_SERVICE_ERROR",
          description:
            "The AirSeatLLSRQ service returned an error: AUTH- 64,1 - AAA  2 - BBB,W15 *G Q",
        },
      ],
    })
    assert.equal(
      map,
      "The AirSeatLLSRQ service returned an error: AUTH- 64\n1 - AAA  2 - BBB\nW15 *G Q"
    )
  })

  it("otro error no trae mapa", () => {
    assert.equal(
      hostSeatMapOf({ class: "SabreBusinessError", message: "UNAUTHORIZED" }),
      undefined
    )
  })
})
