"use server"

import { z } from "zod"
import { Sabre } from "sabre-client"
import type { BargainFinderMaxOptions } from "sabre-client"

export const searchParamsSchema = z.object({
  origin: z.string().min(2, "Origen requerido"),
  destination: z.string().min(2, "Destino requerido"),
  departureDate: z.date(),
  adults: z.number().min(1),
})

export async function searchFlights(
  params: z.infer<typeof searchParamsSchema>
) {
  const { origin, destination, departureDate, adults } = params

  const sabreOptions: BargainFinderMaxOptions = {
    OTA_AirLowFareSearchRQ: {
      Version: "5",
      POS: {
        Source: [
          {
            PseudoCityCode: process.env.SABRE_ORGANIZATION!,
            RequestorID: { ID: "1", Type: "1", CompanyName: { Code: "TN" } },
            FixedPCC: true
          },
        ],
      },
      AvailableFlightsOnly: true,
      OriginDestinationInformation: [
        {
          OriginLocation: { LocationCode: origin },
          DestinationLocation: { LocationCode: destination },
          DepartureDateTime: `${departureDate.toISOString().split(".")[0]}`,
          Fixed: false
        },
      ],
      TravelerInfoSummary: {
        AirTravelerAvail: [
          {
            PassengerTypeQuantity: [{ Code: "ADT", Quantity: adults }],
          },
        ],
      },
      TPA_Extensions: {
        IntelliSellTransaction: {
          RequestType: { Name: '50ITINS' }
        }
      }
    },
  }

  try {
    const sabre = new Sabre()
    sabre.setAuthorization(process.env.SABRE_TOKEN!)
    const results = await sabre.search.shop(sabreOptions)
    return { data: results }
  } catch (error) {
    console.error("Error al llamar a search.shop:", error)
    return { error: "Hubo un error al buscar vuelos." }
  }
}
