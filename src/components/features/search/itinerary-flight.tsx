import { useState } from "react";
import { BargainFinderMaxSchema } from "sabre-client";

type Itinerary = BargainFinderMaxSchema["ItineraryType"]
type ScheduleDesc = BargainFinderMaxSchema["ScheduleDescType"];

interface ItineraryFlightProps {
  flight: ScheduleDesc;
  fares: Itinerary[];
}


export function ItineraryFlight({ flight, fares }: ItineraryFlightProps) {
  const [selectedItinerary, setSelectedItinerary] = useState<Itinerary>(fares[0]);
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
  // Sort fares by price to select the cheapest as default
  fares.sort((a, b) => (getFareInfo(a).price?.amount ?? Infinity) - (getFareInfo(b).price?.amount ?? Infinity));
  const { price, fareBasis } = getFareInfo(selectedItinerary);

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
                  {flight.carrier.marketing} {flight.carrier.marketingFlightNumber}
                </p>
              </div>
              {flight.eTicketable && (
                <Badge variant="secondary" className="ml-auto">
                  E-Ticket
                </Badge>
              )}
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
            <div className="flex flex-wrap gap-2 justify-center lg:justify-end">
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
            </div>
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
}