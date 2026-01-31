"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge, badgeVariants } from "@/components/ui/badge"
import { Plane, ArrowRight, Clock, MapPin, Info } from "lucide-react"
import { BargainFinderMaxResponseSuccess, BargainFinderMaxSchema } from "sabre-client"
import { Button } from "@/components/ui/button"
import { useState } from "react"

type Itinerary = BargainFinderMaxSchema["ItineraryType"]
type LegDesc = BargainFinderMaxSchema["LegDescriptionType"];
type ScheduleDesc = BargainFinderMaxSchema["ScheduleDescType"];
interface GroupedItineraryProps {
  data: BargainFinderMaxResponseSuccess
}

export function GroupedItinerary({ data }: GroupedItineraryProps) {
  const { scheduleDescs, itineraryGroups, legDescs, fareComponentDescs, baggageAllowanceDescs } = data.groupedItineraryResponse

  // Helper function to format time from ISO string
  const formatTime = (timeString: string | undefined) => {
    if (!timeString) return ""
    const [time] = timeString.split(/[+-]/)
    return time.substring(0, 5) // Returns HH:MM
  }

  // Helper function to format duration in minutes to hours and minutes
  const formatDuration = (minutes: number | undefined) => {
    if (minutes === undefined) return ""
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours}h ${mins}m`
  }

  // Helper function to get airline name from code
  const getAirlineName = (code: string) => {
    const airlines: Record<string, string> = {
      AM: "Aeroméxico",
      AA: "American Airlines",
      DL: "Delta Airlines",
      UA: "United Airlines",
      Y4: "Volaris",
      VB: "VivaAerobus",
    }
    return airlines[code] || code
  }

  // Helper function to get stop text
  const getStopText = (stopCount: number | undefined) => {
    if (stopCount === 0) return "Directo"
    if (stopCount === 1) return "1 Escala"
    return `${stopCount} Escalas`
  }

  // Helper to get a user-friendly fare family name
  const getFareFamilyName = (fareBasis: string | undefined): string => {
    if (!fareBasis) return "Tarifa"
    // This is a simplified example. You'd expand this with your business logic.
    if (fareBasis.includes("LIGHT") || fareBasis.startsWith("Z")) return "Básica"
    if (fareBasis.includes("CLASSIC") || fareBasis.startsWith("E")) return "Clásica"
    if (fareBasis.includes("FLEX") || fareBasis.startsWith("B")) return "Flexible"
    if (fareBasis.includes("AM") || fareBasis.startsWith("M")) return "AM Plus"
    if (fareBasis.includes("PREMIER") || fareBasis.startsWith("I")) return "Premier"
    return "Especial"
  }

  // Get pricing information if available
  const getFareInfo = (itinerary: Itinerary) => {
    const pricing = itinerary.pricingInformation?.[0]
    if (!pricing) return { price: null, fareBasis: null, baggage: null }

    const fareComponentRef = pricing.fare?.passengerInfoList?.[0]?.passengerInfo?.fareComponents?.[0]?.ref
    const fareBasis = fareComponentDescs?.find(fc => fc.id === fareComponentRef)?.fareBasisCode

    const baggageRef = pricing.fare?.passengerInfoList?.[0]?.passengerInfo?.baggageInformation?.[0]?.allowance?.ref
    const baggage = baggageAllowanceDescs?.find(b => b.id === baggageRef)

    return {
      price: pricing.fare?.totalFare ? {
        amount: pricing.fare.totalFare.totalPrice,
        currency: pricing.fare.totalFare.currency,
      } : null,
      fareBasis,
      baggage
    }
  }
  if (!itineraryGroups) {
    return <div>No se encontraron itinerarios.</div>
  }

  const allItineraries = itineraryGroups.flatMap(group => group.itineraries ?? [])

  // Group itineraries by flight to show different fares for the same flight
  const itinerariesByFlight = allItineraries.reduce((acc, itinerary) => {
    const leg = legDescs?.find(l => l.id === itinerary.legs?.[0]?.ref)
    const flight = scheduleDescs?.find(s => s.id === leg?.schedules[0]?.ref)
    if (flight) {
      const flightId = `${flight.carrier.marketing}-${flight.carrier.marketingFlightNumber}-${flight.departure.time}`
      if (!acc[flightId]) {
        acc[flightId] = { flight, fares: [] }
      }
      acc[flightId].fares.push(itinerary)
    }
    return acc
  }, {} as Record<string, { flight: ScheduleDesc; fares: Itinerary[] }>)

  if (Object.keys(itinerariesByFlight).length === 0) {
    return <div>Cargando...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-foreground">Resultados de Búsqueda</h2>
        <p className="text-sm text-muted-foreground">
          {Object.keys(itinerariesByFlight).length} {Object.keys(itinerariesByFlight).length === 1 ? "vuelo encontrado" : "vuelos encontrados"}
        </p>
      </div>

      <div className="space-y-4">
        {Object.values(itinerariesByFlight).map(({ flight, fares }) => {

          // const [selectedItinerary, setSelectedItinerary] = useState<Itinerary>(fares[0]);
          // Sort fares by price to select the cheapest as default
          // fares.sort((a, b) => (getFareInfo(a).price?.amount ?? Infinity) - (getFareInfo(b).price?.amount ?? Infinity));
          const { price, fareBasis } = getFareInfo(fares[0]);

          return (
            <Card key={flight.id} className="border-border hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                  {/* Flight Info */}
                  <div className="flex-1 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
                        <Plane className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">{getAirlineName(flight.carrier.marketing)}</p>
                        <p className="text-sm text-muted-foreground">
                          {flight.carrier.marketing} {flight.carrier.marketingFlightNumber} - {fareBasis}
                        </p>
                      </div>
                      {flight.eTicketable && (
                        <Badge variant="secondary" className="ml-auto">
                          E-Ticket
                        </Badge>
                      )}
                      <Badge variant='outline'>
                        {getFareFamilyName(fareBasis || undefined)}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-center min-w-[80px]">
                        <p className="text-2xl font-bold text-foreground">{formatTime(flight.departure.time)}</p>
                        <p className="text-sm text-muted-foreground">{flight.departure.airport}</p>
                        {flight.departure.terminal && (
                          <p className="text-xs text-muted-foreground">Terminal {flight.departure.terminal}</p>
                        )}
                      </div>

                      <div className="flex-1 flex flex-col items-center gap-1">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          <span>{formatDuration(flight.elapsedTime)}</span>
                        </div>
                        <div className="w-full h-px bg-border relative">
                          <ArrowRight className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {getStopText(flight.stopCount || 0)}
                        </Badge>
                      </div>

                      <div className="text-center min-w-[80px]">
                        <p className="text-2xl font-bold text-foreground">{formatTime(flight.arrival.time)}</p>
                        <p className="text-sm text-muted-foreground">{flight.arrival.airport}</p>
                        {flight.arrival.terminal && (
                          <p className="text-xs text-muted-foreground">Terminal {flight.arrival.terminal}</p>
                        )}
                      </div>
                    </div>

                    {/* Additional Info */}
                    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        <span>{flight.totalMilesFlown} millas</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Info className="w-3 h-3" />
                        <span>Equipo: {flight.carrier.equipment?.code}</span>
                      </div>
                      {flight.carrier.codeShared && (
                        <div className="text-xs">
                          <span>Operado por: {flight.carrier.codeShared}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Price and Action */}
                  <div className="flex flex-row lg:flex-col items-center lg:items-end justify-between lg:justify-center gap-4 lg:min-w-[180px]">
                    {/* <div className="flex flex-wrap gap-2 justify-center lg:justify-end">
                      {fares.map(fareItinerary => {
                        const { fareBasis: currentFareBasis } = getFareInfo(fareItinerary);
                        const isSelected = fareItinerary.id === selectedItinerary.id;
                        return (
                          <Button
                            key={fareItinerary.id}
                            variant={isSelected ? "secondary" : "outline"}
                            size="sm"
                            onClick={() => setSelectedItinerary(fareItinerary)}
                          >
                            {getFareFamilyName(currentFareBasis || undefined)}
                          </Button>
                        )
                      })}
                    </div> */}
                    {price ? (
                      <div className="text-left lg:text-right">
                        <p className="text-sm text-muted-foreground">Precio total</p>
                        <p className="text-3xl font-bold text-foreground">${price.amount.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">{price.currency}</p>
                      </div>
                    ) : (
                      <div className="text-left lg:text-right animate-pulse">
                        <p className="text-sm text-muted-foreground">Consultar precio</p>
                      </div>
                    )}
                    <Button>Seleccionar</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {Object.keys(itinerariesByFlight).length === 0 && (
        <Card className="border-border">
          <CardContent className="p-12 text-center">
            <Plane className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-foreground mb-2">No se encontraron vuelos</h3>
            <p className="text-muted-foreground">
              Intenta ajustar tus criterios de búsqueda para encontrar más opciones.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
