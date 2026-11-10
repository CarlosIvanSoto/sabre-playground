"use client"

import type {
  ReservationHistoryFlightSegment,
  ReservationHistoryResponse,
  ReservationHistoryText,
  ReservationHistoryTransaction,
} from "sabre-client"
import { Badge } from "@/components/ui/badge"

/**
 * El historial del PNR (`reservation.history`, el `*H` del host, F12.3) como línea de tiempo:
 * una entrada por transacción, con quién la firmó, cuándo y desde qué PCC, y lo que cambió con
 * su `action`. Sabre no publica el catálogo de `action`: la `A` inicial es un alta y la `X`, una
 * baja. Lo que el SDK no tipa (asientos, hotel, auto, importes) queda en la pestaña Crudo.
 *
 * Trae datos del pasajero: se ve en memoria, como el resto del historial de llamadas.
 */
export function PnrHistoryView({ result }: { result: unknown }) {
  const history = result as ReservationHistoryResponse
  if (!Array.isArray(history?.transactions)) return null
  if (history.transactions.length === 0) {
    return <p className="text-muted-foreground text-sm">Sin transacciones.</p>
  }
  return (
    <ol className="flex flex-col gap-3 border-s ps-4" aria-label="Historial">
      {history.transactions.map((transaction, index) => (
        <Transaction
          // `rph` puede faltar; el orden es el de Sabre y no cambia.
          // biome-ignore lint/suspicious/noArrayIndexKey: ver arriba
          key={index}
          transaction={transaction}
        />
      ))}
    </ol>
  )
}

function Transaction({
  transaction,
}: {
  transaction: ReservationHistoryTransaction
}) {
  const {
    rph,
    createdAt,
    agent,
    agentDutyCode,
    agentFunctionCode,
    pcc,
    aaaPcc,
    receivedFrom,
    flightSegments,
    generalInfo,
    remarks,
    accounting,
  } = transaction
  const empty =
    flightSegments.length +
      generalInfo.length +
      remarks.length +
      accounting.length ===
    0
  return (
    <li className="flex flex-col gap-1.5 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        {rph !== undefined && (
          <Badge variant="outline" className="font-mono">
            RPH {rph}
          </Badge>
        )}
        <span className="font-mono">{createdAt ?? "sin fecha"}</span>
        {agent !== undefined && (
          <span title="CreationAgent, duty code y function code">
            agente <span className="font-mono">{agent}</span>
            {(agentDutyCode !== undefined ||
              agentFunctionCode !== undefined) && (
              <span className="text-muted-foreground font-mono">
                {" "}
                {agentDutyCode ?? ""}
                {agentFunctionCode ?? ""}
              </span>
            )}
          </span>
        )}
        {pcc !== undefined && (
          <span>
            PCC <span className="font-mono">{pcc}</span>
            {aaaPcc !== undefined && aaaPcc !== pcc && (
              <span className="text-muted-foreground">
                {" "}
                (AAA <span className="font-mono">{aaaPcc}</span>)
              </span>
            )}
          </span>
        )}
      </div>
      {receivedFrom !== undefined && (
        <div className="text-muted-foreground text-xs">
          recibido de <span className="font-mono">{receivedFrom}</span>
        </div>
      )}
      {empty && (
        <div className="text-muted-foreground text-xs">
          Sin elementos tipados: lo que cambió está en la pestaña Crudo.
        </div>
      )}
      <Items title="flightSegments">
        {flightSegments.map((segment, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: el orden es el de Sabre
          <Segment key={index} segment={segment} />
        ))}
      </Items>
      <Items title="generalInfo">
        {generalInfo.map((item, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: el orden es el de Sabre
          <Text key={index} item={item} />
        ))}
      </Items>
      <Items title="remarks">
        {remarks.map((item, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: el orden es el de Sabre
          <Text key={index} item={item} />
        ))}
      </Items>
      <Items title="accounting">
        {accounting.map((item, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: el orden es el de Sabre
          <Line key={index} action={item.action}>
            {[
              item.type && `type ${item.type}`,
              item.linkCode && `link ${item.linkCode}`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </Line>
        ))}
      </Items>
    </li>
  )
}

function Items({
  title,
  children,
}: {
  title: string
  children: React.ReactNode[]
}) {
  if (children.length === 0) return null
  return (
    <div className="flex flex-col gap-0.5">
      <div className="text-muted-foreground font-mono text-xs">{title}</div>
      <ul className="flex flex-col gap-0.5">{children}</ul>
    </div>
  )
}

/** Una línea con su `action`: en rojo las bajas (`X…`). */
function Line({
  action,
  children,
}: {
  action?: string
  children: React.ReactNode
}) {
  return (
    <li className="flex items-baseline gap-2 font-mono text-xs">
      <Badge
        variant={action?.startsWith("X") ? "destructive" : "secondary"}
        className="w-12 shrink-0 justify-center font-mono"
      >
        {action ?? "—"}
      </Badge>
      <span className="break-all whitespace-pre-wrap">{children}</span>
    </li>
  )
}

function Text({ item }: { item: ReservationHistoryText }) {
  return <Line action={item.action}>{item.text}</Line>
}

/** `AA 100 Y DFW-LAX 12-19T13:10 → 12-19T14:45 HK 1`, con lo que haya. Fechas sin año. */
function Segment({ segment }: { segment: ReservationHistoryFlightSegment }) {
  const route =
    segment.origin !== undefined || segment.destination !== undefined
      ? `${segment.origin ?? "?"}-${segment.destination ?? "?"}`
      : undefined
  const times =
    segment.departureDateTime !== undefined
      ? `${segment.departureDateTime}${segment.arrivalDateTime === undefined ? "" : ` → ${segment.arrivalDateTime}`}`
      : undefined
  return (
    <Line action={segment.action}>
      {[
        [segment.marketingAirline, segment.flightNumber]
          .filter(Boolean)
          .join(" "),
        segment.bookingClass,
        route,
        times,
        segment.status,
        segment.numberInParty === undefined
          ? undefined
          : `×${segment.numberInParty}`,
        segment.supplierRef,
      ]
        .filter(Boolean)
        .join(" ")}
    </Line>
  )
}
