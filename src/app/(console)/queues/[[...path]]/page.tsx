import { notFound } from "next/navigation"
import { FlowHeader } from "@/components/console/flow-header"
import { QueuesFlow } from "@/components/queues/queues-flow"
import { getFlow } from "@/lib/flows"
import { PCC_PATTERN, parseQueueRef } from "@/lib/queues"

/**
 * Flujo 6, con las rutas por PCC y cola de la v1 (`/queue/[pcc]/...`):
 *
 * - `/queues`: todos los pasos, con el PCC de la sesión.
 * - `/queues/<PCC>`: los pasos con ese PCC ya puesto.
 * - `/queues/<PCC>/<cola>`: además la cola.
 *
 * La ruta es el punto de entrada: arranca el recorrido (`queue-journey`) con esa cola. Al
 * elegir otra en `count`, el flujo cambia la URL con `history.replaceState`, sin volver a
 * montar la página. La sesión sigue en el registro del servidor.
 */
export default async function QueuesPage({
  params,
}: {
  params: Promise<{ path?: string[] }>
}) {
  const { path = [] } = await params
  if (path.length > 2) notFound()
  const [pcc = "", queue = ""] = path.map((part) =>
    decodeURIComponent(part).toUpperCase()
  )
  if (pcc !== "" && !PCC_PATTERN.test(pcc)) notFound()
  if (queue !== "" && parseQueueRef(queue) === undefined) notFound()

  const flow = getFlow("queues")
  if (flow === undefined) throw new Error("falta el flujo queues en FLOWS")
  return (
    <>
      <FlowHeader flow={flow} />
      <QueuesFlow initialPcc={pcc} initialQueue={queue} />
    </>
  )
}
