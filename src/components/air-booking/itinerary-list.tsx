"use client"

import type { BargainFinderMaxResponse } from "sabre-client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  type ChosenItinerary,
  chooseItinerary,
  type ItinerarySummary,
  summarizeItinerary,
} from "@/lib/air-booking"

/**
 * La lista compacta de itinerarios de BFM (o de Revalidate): una fila por itinerario con
 * sus vuelos, clases, escalas y precio total. Con `onChoose`, cada fila se puede elegir.
 */
export function ItineraryList({
  result,
  chosenKey,
  onChoose,
}: {
  result: unknown
  chosenKey?: string
  onChoose?: (key: string, chosen: ChosenItinerary) => void
}) {
  const groups = (result as BargainFinderMaxResponse | undefined)
    ?.itineraryGroups
  if (groups === undefined || groups.length === 0) return null

  const rows = groups.flatMap((group, groupIndex) =>
    group.itineraries.map((itinerary) => ({
      group,
      itinerary,
      summary: summarizeItinerary(group, groupIndex, itinerary),
    }))
  )

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>#</TableHead>
          <TableHead>Vuelos</TableHead>
          <TableHead>Clase</TableHead>
          <TableHead>Escalas</TableHead>
          <TableHead className="text-right">Total</TableHead>
          {onChoose !== undefined && <TableHead />}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map(({ group, itinerary, summary }) => {
          const chosen = summary.key === chosenKey
          return (
            <TableRow
              key={summary.key}
              data-state={chosen ? "selected" : undefined}
              className="align-top"
            >
              <TableCell className="font-mono text-xs">{summary.id}</TableCell>
              <TableCell>
                <Flights summary={summary} />
              </TableCell>
              <TableCell className="font-mono text-xs">
                {summary.bookingClasses.join(" ")}
              </TableCell>
              <TableCell>{summary.stops}</TableCell>
              <TableCell className="text-right font-mono text-xs">
                {summary.price === undefined
                  ? "—"
                  : `${summary.price.amount.toFixed(2)} ${summary.price.currency}`}
              </TableCell>
              {onChoose !== undefined && (
                <TableCell className="text-right">
                  {chosen ? (
                    <Badge>Elegido</Badge>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        onChoose(summary.key, chooseItinerary(group, itinerary))
                      }
                    >
                      Elegir
                    </Button>
                  )}
                </TableCell>
              )}
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

function Flights({ summary }: { summary: ItinerarySummary }) {
  return (
    <div className="flex flex-col gap-0.5 font-mono text-xs">
      {summary.flights.map((flight, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: la lista no cambia de orden
        <div key={index}>
          <span className="font-medium">{flight.flight}</span>
          {flight.operatedBy !== undefined && (
            <span className="text-muted-foreground">
              {" "}
              ({flight.operatedBy})
            </span>
          )}{" "}
          {flight.from} {flight.departs} → {flight.to} {flight.arrives}
          {flight.arrivalDays !== undefined && flight.arrivalDays > 0 && (
            <sup>+{flight.arrivalDays}</sup>
          )}
          {flight.date !== undefined && (
            <span className="text-muted-foreground"> · {flight.date}</span>
          )}
        </div>
      ))}
    </div>
  )
}

/** El itinerario que recibe un paso, en pocas líneas: para la columna del formulario. */
export function ItineraryBrief({
  chosen,
  label,
}: {
  chosen: ChosenItinerary
  label: string
}) {
  const summary = summarizeItinerary(chosen.group, 0, chosen.itinerary)
  return (
    <div className="bg-muted/50 flex flex-col gap-1 rounded-md p-3">
      <p className="text-muted-foreground text-xs">{label}</p>
      <Flights summary={summary} />
      <p className="font-mono text-xs">
        Clase {summary.bookingClasses.join(" ") || "—"} ·{" "}
        {summary.price === undefined
          ? "sin precio"
          : `${summary.price.amount.toFixed(2)} ${summary.price.currency}`}
      </p>
    </div>
  )
}
