"use client"

import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { CensusSummary } from "@/lib/census-summary"
import { bookingHref } from "@/lib/queue-desk"
import { cn } from "@/lib/utils"

const pic = (code: number) => String(code).padStart(3, "0")

const pct = (value: number | null) => (value === null ? "—" : `${value}%`)

/** `{ HK: 3, UN: 1 }` → `HK 3 · UN 1`, de mayor a menor. */
function counts(record: Record<string, number>): string {
  const entries = Object.entries(record).sort((a, b) => b[1] - a[1])
  return entries.length === 0
    ? "—"
    : entries.map(([key, value]) => `${key} ${value}`).join(" · ")
}

/**
 * La vista de resumen del censo (F10.4, #98; ADR-026): la matriz cola × PIC y lo de cada cola,
 * calculados del mismo `queue-census/1` que se exporta. No clasifica las colas: eso es del wiki.
 */
export function CensusSummaryView({
  summary,
  pcc,
}: {
  summary: CensusSummary
  /** El PCC de trabajo, para abrir la reserva con `targetPcc`. */
  pcc: string
}) {
  const shared = new Set(summary.sharedPics)
  return (
    <Card>
      <CardHeader>
        <CardTitle>Resumen</CardTitle>
        <CardDescription>
          Del mismo JSON que se exporta. Los PIC que aparecen en más de una cola
          van resaltados. El censo es una foto (Q-088): una cola vacía hoy no es
          una cola sin uso.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6 text-sm">
        <section className="flex flex-col gap-2">
          <h3 className="font-medium">Cola × PIC (PNR por celda)</h3>
          {summary.pics.length === 0 ? (
            <p className="text-muted-foreground">Ningún PIC en el censo.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-14">Cola</TableHead>
                  {summary.pics.map((code) => (
                    <TableHead
                      key={code}
                      className={cn(
                        "text-center font-mono",
                        shared.has(code) && "bg-amber-500/15"
                      )}
                      title={
                        shared.has(code)
                          ? "Aparece en más de una cola"
                          : undefined
                      }
                    >
                      {pic(code)}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.matrix.map((row) => (
                  <TableRow key={row.queue}>
                    <TableCell className="font-mono">{row.queue}</TableCell>
                    {summary.pics.map((code) => (
                      <TableCell
                        key={code}
                        className={cn(
                          "text-center tabular-nums",
                          shared.has(code) && "bg-amber-500/10",
                          row.cells[code] === undefined &&
                            "text-muted-foreground"
                        )}
                      >
                        {row.cells[code] ?? "·"}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>

        {summary.sharedPnrs.length > 0 && (
          <section className="flex flex-col gap-2">
            <h3 className="font-medium">PNR en más de una cola</h3>
            <ul className="flex flex-wrap gap-2">
              {summary.sharedPnrs.map((entry) => (
                <li key={entry.pnr}>
                  <PnrLink pnr={entry.pnr} pcc={pcc} />{" "}
                  <span className="text-muted-foreground font-mono text-xs">
                    {entry.refs.join(", ")}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="flex flex-col gap-2">
          <h3 className="font-medium">Por cola</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-14">Cola</TableHead>
                <TableHead>PIC dominantes</TableHead>
                <TableHead>Segmentos</TableHead>
                <TableHead>Aerolíneas</TableHead>
                <TableHead
                  className="text-end"
                  title="Sobre los PNR con los rasgos de la reserva"
                >
                  Boleto
                </TableHead>
                <TableHead
                  className="text-end"
                  title="Sobre los PNR con reserva y sin boleto: en uno emitido el plazo siempre quedó atrás"
                >
                  TAW vencido
                </TableHead>
                <TableHead
                  className="text-end"
                  title="PNR con algún segmento UN, TK, SC o WK"
                >
                  Cambio de horario
                </TableHead>
                <TableHead
                  className="text-end"
                  title="Media de placedAgeHours: una cota (Q-034), no la entrada a la cola"
                >
                  Antigüedad
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.queues.map((queue) => (
                <TableRow key={queue.queue}>
                  <TableCell className="font-mono">{queue.queue}</TableCell>
                  <TableCell className="font-mono text-xs whitespace-normal">
                    {queue.pics.length === 0
                      ? "—"
                      : queue.pics
                          .slice(0, 3)
                          .map((entry) => `${pic(entry.code)}×${entry.count}`)
                          .join(" · ")}
                  </TableCell>
                  <TableCell className="font-mono text-xs whitespace-normal">
                    {counts(queue.segmentStatus)}
                  </TableCell>
                  <TableCell className="font-mono text-xs whitespace-normal">
                    {counts(queue.carriers)}
                  </TableCell>
                  <TableCell className="text-end tabular-nums">
                    {pct(queue.pctTicketed)}
                  </TableCell>
                  <TableCell className="text-end tabular-nums">
                    {pct(queue.pctTawExpired)}
                  </TableCell>
                  <TableCell className="text-end tabular-nums">
                    {pct(queue.pctScheduleChange)}
                  </TableCell>
                  <TableCell className="text-end tabular-nums">
                    {queue.meanPlacedAgeHours === null
                      ? "—"
                      : `${queue.meanPlacedAgeHours} h`}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="text-muted-foreground text-xs">
            Boleto y horario: sobre los PNR con los rasgos de la reserva. TAW
            vencido: sobre los que además no tienen boleto. Cambio de horario:
            algún segmento UN, TK, SC o WK. Bases por cola (con reserva / sin
            boleto / leídos):{" "}
            {summary.queues
              .map(
                (queue) =>
                  `${queue.queue}: ${queue.withBooking}/${queue.unticketed}/${queue.sampled}`
              )
              .join(", ")}
            . La reserva de un PNR se abre desde su localizador.
          </p>
        </section>
      </CardContent>
    </Card>
  )
}

/** El localizador como enlace a `/booking`, en otra pestaña, con el PCC de trabajo. */
export function PnrLink({ pnr, pcc }: { pnr: string; pcc: string }) {
  return (
    <Link href={bookingHref(pnr, pcc)} target="_blank" rel="noopener">
      <Badge variant="outline" className="hover:bg-muted font-mono">
        {pnr}
      </Badge>
    </Link>
  )
}
