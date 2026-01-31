import { BargainFinderMaxOptions, Sabre } from "sabre-client"
import { z } from "zod"

export const searchOptionsSchema = z.object({
  itinerary: z.array(
    z.object({
      origin: z.string().min(2, "Origen requerido"),
      destination: z.string().min(2, "Destino requerido"),
      departureDate: z.date(),
    })
  ),
  travelers: z.object({
    adults: z.number().min(1),
    children: z.number().min(0),
    infants: z.number().min(0),
  }),
})

export async function searchFlights(
  params: z.infer<typeof searchOptionsSchema>
) {
  const { itinerary, travelers } = params

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
      OriginDestinationInformation: itinerary.map((leg) => ({
        OriginLocation: { LocationCode: leg.origin },
        DestinationLocation: { LocationCode: leg.destination },
        DepartureDateTime: `${leg.departureDate.toISOString().split(".")[0]}`,
        Fixed: false
      })),
      TravelerInfoSummary: {
        AirTravelerAvail: 
        [
          {
            PassengerTypeQuantity: [{ Code: "ADT", Quantity: travelers.adults }],
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
  if (travelers.children) {
    sabreOptions.OTA_AirLowFareSearchRQ!.TravelerInfoSummary!.AirTravelerAvail!.push({
      PassengerTypeQuantity: [{ Code: "CHD", Quantity: travelers.children }],
    })
  }
  if (travelers.infants) {
    sabreOptions.OTA_AirLowFareSearchRQ!.TravelerInfoSummary!.AirTravelerAvail!.push({
      PassengerTypeQuantity: [{ Code: "INF", Quantity: travelers.infants }],
    })
  }

  try {
    const sabre = new Sabre()
    sabre.setAuthorization(process.env.SABRE_TOKEN!)
    console.dir(sabreOptions, { depth: null })
    const results = await sabre.search.shop(sabreOptions)
    return { data: results }
  } catch (error) {
    console.error("Error al llamar a search.shop:", error)
    return { error: "Hubo un error al buscar vuelos." }
  }
}
