import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { QueueCensus } from "@/components/queue-census/queue-census"
import { PCC_PATTERN } from "@/lib/queues"

export const metadata: Metadata = {
  title: "Censo de colas · sabre-playground",
}

/**
 * `/queue-census`: el censo de colas (ADR-026), un recorrido de solo lectura por las colas 0–49
 * con PNR. Como la mesa, no es un flujo de la tabla de ADR-022.
 *
 * - `/queue-census`: con el PCC de la sesión.
 * - `/queue-census/<PCC>`: con ese PCC de trabajo, el mismo campo de la mesa (F9.6).
 */
export default async function QueueCensusPage({
  params,
}: {
  params: Promise<{ pcc?: string[] }>
}) {
  const { pcc: path = [] } = await params
  if (path.length > 1) notFound()
  const pcc =
    path[0] === undefined ? "" : decodeURIComponent(path[0]).toUpperCase()
  if (pcc !== "" && !PCC_PATTERN.test(pcc)) notFound()
  return <QueueCensus initialPcc={pcc} />
}
