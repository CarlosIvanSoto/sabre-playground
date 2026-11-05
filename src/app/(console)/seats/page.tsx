import { FlowHeader } from "@/components/console/flow-header"
import { SeatsFlow } from "@/components/seats/seats-flow"
import { getFlow } from "@/lib/flows"

/**
 * Flujo 3. `/seats?pnrLocator=<localizador>` prellena el formulario: la hoja de reserva de la
 * mesa de colas enlaza aquí. No corre nada solo.
 */
export default async function SeatsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { pnrLocator } = await searchParams
  const text =
    typeof pnrLocator === "string" ? pnrLocator.trim().toUpperCase() : ""
  const flow = getFlow("seats")
  if (flow === undefined) throw new Error("falta el flujo seats en FLOWS")
  return (
    <>
      <FlowHeader flow={flow} />
      <SeatsFlow initialPnrLocator={/^[A-Z]{6}$/.test(text) ? text : ""} />
    </>
  )
}
