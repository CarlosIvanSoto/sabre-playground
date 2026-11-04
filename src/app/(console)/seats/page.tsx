import { FlowHeader } from "@/components/console/flow-header"
import { SeatsFlow } from "@/components/seats/seats-flow"
import { getFlow } from "@/lib/flows"

export default function SeatsPage() {
  const flow = getFlow("seats")
  if (flow === undefined) throw new Error("falta el flujo seats en FLOWS")
  return (
    <>
      <FlowHeader flow={flow} />
      <SeatsFlow />
    </>
  )
}
