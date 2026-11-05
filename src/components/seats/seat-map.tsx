import type {
  GetSeatsResponse,
  Seat,
  SeatCabinCompartment,
  SeatSegmentRs,
} from "sabre-client"
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

/**
 * El mapa de asientos de `air.getSeats` como una tabla simple: una por cabina, filas por
 * número de fila y columnas por letra. Cada celda trae el `occupationStatusCode` tal cual
 * (PADIS 9865) y `$` si el asiento tiene precio.
 *
 * Con `onPick` (F3.3), los asientos libres se pueden elegir: uno por segmento, y `picked` dice
 * cuál está elegido en cada uno (`segmentRef` → número de asiento).
 *
 * En CERT el estado no refleja la ocupación real (Q-071, `get-seats` en el wiki).
 */
export function SeatMapView({
  result,
  picked,
  onPick,
}: {
  result: unknown
  picked?: Record<string, string>
  onPick?: (segmentRef: string, seat: string) => void
}) {
  const response = (result as GetSeatsResponse | undefined)?.response
  if (response === undefined || response.seatMaps.length === 0) return null

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-xs">
        Cada celda: <code>occupationStatusCode</code> (PADIS 9865:{" "}
        <code>F</code> libre, <code>O</code> ocupado). <code>$</code>: con
        precio. <code>—</code>: no existe. En CERT el estado no refleja la
        ocupación real.
        {onPick !== undefined && " Clic en un asiento libre para elegirlo."}
      </p>
      {response.seatMaps.map((map) => {
        const segment = response.segments.find((s) => s.id === map.segmentRef)
        return (
          <section
            key={`${map.segmentRef}-${map.flightLegRef ?? ""}`}
            className="flex flex-col gap-2"
          >
            <h3 className="font-mono text-sm font-medium">
              {segmentLabel(segment, map.segmentRef)}
            </h3>
            {(map.cabinCompartments ?? []).map((cabin, index) => (
              <CabinTable
                // Las cabinas no tienen id propio; el orden no cambia.
                // biome-ignore lint/suspicious/noArrayIndexKey: ver arriba
                key={index}
                cabin={cabin}
                picked={picked?.[map.segmentRef]}
                onPick={
                  onPick === undefined
                    ? undefined
                    : (seat) => onPick(map.segmentRef, seat)
                }
              />
            ))}
          </section>
        )
      })}
    </div>
  )
}

function segmentLabel(segment: SeatSegmentRs | undefined, ref: string) {
  if (segment === undefined) return ref
  const {
    bookingAirlineCode,
    bookingFlightNumber,
    departureAirportCode,
    arrivalAirportCode,
    departureDate,
    bookingClassCode,
  } = segment
  return `${bookingAirlineCode} ${bookingFlightNumber} ${departureAirportCode}→${arrivalAirportCode} ${departureDate} · clase ${bookingClassCode}`
}

function CabinTable({
  cabin,
  picked,
  onPick,
}: {
  cabin: SeatCabinCompartment
  picked?: string
  onPick?: (seat: string) => void
}) {
  const rows = cabin.seatRows ?? []
  const columns =
    cabin.cabinLayout?.columns.map((column) => column.id) ??
    cabin.columnIds ??
    [...new Set(rows.flatMap((row) => row.seats.map((s) => s.column)))].sort()
  const exitRows = new Set(
    (cabin.cabinLayout?.exitRowPosition ?? []).flatMap(
      ({ firstRow, lastRow }) =>
        Array.from({ length: lastRow - firstRow + 1 }, (_, i) => firstRow + i)
    )
  )

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium">
          {cabin.cabinName ?? "Cabina"}
          {cabin.cabinCode !== undefined && ` (${cabin.cabinCode})`}
        </span>
        {cabin.firstRow !== undefined && cabin.lastRow !== undefined && (
          <span className="text-muted-foreground">
            filas {cabin.firstRow}–{cabin.lastRow}
          </span>
        )}
      </div>
      <Table className="w-auto">
        <TableHeader>
          <TableRow>
            <TableHead className="w-0">Fila</TableHead>
            {columns.map((column) => (
              <TableHead key={column} className="text-center font-mono">
                {column}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const seats = new Map(row.seats.map((seat) => [seat.column, seat]))
            return (
              <TableRow key={row.row}>
                <TableCell className="font-mono text-xs">
                  {row.row}
                  {exitRows.has(row.row) && (
                    <Badge variant="outline" className="ms-1">
                      salida
                    </Badge>
                  )}
                </TableCell>
                {columns.map((column) => {
                  const number = `${row.row}${column}`
                  return (
                    <SeatCell
                      key={column}
                      seat={seats.get(column)}
                      picked={picked === number}
                      onPick={
                        onPick === undefined ? undefined : () => onPick(number)
                      }
                    />
                  )
                })}
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

function SeatCell({
  seat,
  picked = false,
  onPick,
}: {
  seat: Seat | undefined
  picked?: boolean
  onPick?: () => void
}) {
  if (seat === undefined) {
    return (
      <TableCell className="text-muted-foreground text-center font-mono text-xs">
        —
      </TableCell>
    )
  }
  const status = seat.occupationStatusCode ?? "?"
  const priced = (seat.offerItemRefIds?.length ?? 0) > 0
  const title = (seat.characteristics ?? [])
    .map((c) => c.description ?? c.code)
    .join(", ")
  const label = (
    <>
      {status}
      {priced && "$"}
      {seat.isOperative === false && "!"}
    </>
  )
  const free = status === "F" && seat.isOperative !== false
  return (
    <TableCell
      title={title}
      className={
        status === "F"
          ? "text-center font-mono text-xs"
          : "bg-muted text-muted-foreground text-center font-mono text-xs"
      }
    >
      {onPick !== undefined && free ? (
        <Button
          size="xs"
          variant={picked ? "default" : "ghost"}
          aria-pressed={picked}
          className="font-mono"
          onClick={onPick}
        >
          {label}
        </Button>
      ) : (
        label
      )}
    </TableCell>
  )
}
