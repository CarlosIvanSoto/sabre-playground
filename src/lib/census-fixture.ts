import {
  CENSUS_SCHEMA,
  type QueueCensusExport,
  TAKEN_AT_SOURCE,
} from "./census-export.ts"
import type { BookingTraits } from "./census-traits.ts"

/**
 * Un censo `queue-census/2` sintético para los tests (F10.3 y F10.4). Los localizadores son de
 * prueba (`TESTAA`…) y el PCC es inventado (`Z9Z9`): ningún dato real.
 */

export const PCC = "Z9Z9"
export const context = { locators: new Set(["TESTAA", "TESTAB"]), pccs: [PCC] }

export function booking(): BookingTraits {
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
        departureDelayMinutes: null,
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

export function census(): QueueCensusExport {
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
            "9XXX.9XXX*XXX 9999/99XXX99 XXXXXX H",
          ],
        },
      ],
    },
  }
}
