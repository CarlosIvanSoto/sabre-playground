import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { QueueDesk } from "@/components/queue-desk/queue-desk"
import { PCC_PATTERN } from "@/lib/queues"

export const metadata: Metadata = {
  title: "Mesa de colas · sabre-playground",
}

/**
 * `/queue-desk`: la mesa de colas (ADR-025). No es un flujo de la tabla de ADR-022: compone
 * los flujos 4, 5 y 6 en una pantalla de trabajo, así que no lleva `FlowHeader`.
 *
 * - `/queue-desk`: con el PCC de la sesión.
 * - `/queue-desk/<PCC>`: con ese PCC de trabajo (F9.6). Al cambiarlo en la mesa, la URL cambia
 *   con `history.replaceState`, sin volver a montar la página.
 */
export default async function QueueDeskPage({
  params,
}: {
  params: Promise<{ pcc?: string[] }>
}) {
  const { pcc: path = [] } = await params
  if (path.length > 1) notFound()
  const pcc =
    path[0] === undefined ? "" : decodeURIComponent(path[0]).toUpperCase()
  if (pcc !== "" && !PCC_PATTERN.test(pcc)) notFound()
  return <QueueDesk initialPcc={pcc} />
}
