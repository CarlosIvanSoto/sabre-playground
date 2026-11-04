import "server-only"

import type { BargainFinderMaxRequest } from "sabre-client"
import type { SearchQuery } from "@/lib/air-booking"

/**
 * El body de Bargain Finder Max v5 para la búsqueda mínima de F3.1. El SDK no completa
 * `Version` ni `POS` (`bargain-finder-max` en el wiki): `Version: "5"`, `RequestorID` y
 * `50ITINS` salen del ejemplo de Sabre.
 *
 * El PCC del `POS` es el del EPR y no sale del servidor: Revalidate vuelve a armar este
 * request desde la misma búsqueda en lugar de recibirlo del cliente.
 */
export function buildSearchRequest(
  query: SearchQuery,
  pcc: string
): BargainFinderMaxRequest {
  return {
    OTA_AirLowFareSearchRQ: {
      Version: "5",
      POS: {
        Source: [
          {
            PseudoCityCode: pcc,
            RequestorID: { Type: "1", ID: "1", CompanyName: { Code: "TN" } },
          },
        ],
      },
      OriginDestinationInformation: [
        {
          DepartureDateTime: `${query.departureDate}T00:00:00`,
          OriginLocation: { LocationCode: query.origin },
          DestinationLocation: { LocationCode: query.destination },
        },
      ],
      TravelPreferences: {
        ...(query.directOnly ? { MaxStopsQuantity: 0 } : {}),
        ...(query.airline !== undefined
          ? { VendorPref: [{ Code: query.airline }] }
          : {}),
      },
      TravelerInfoSummary: {
        AirTravelerAvail: [
          { PassengerTypeQuantity: [{ Code: "ADT", Quantity: query.adults }] },
        ],
      },
      TPA_Extensions: {
        IntelliSellTransaction: { RequestType: { Name: "50ITINS" } },
      },
    },
  }
}
