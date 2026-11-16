import { FlowHeader } from "@/components/console/flow-header"
import { SalesFlow } from "@/components/sales/sales-flow"
import { getFlow } from "@/lib/flows"

export default function SalesPage() {
  const flow = getFlow("sales")
  if (flow === undefined) throw new Error("falta el flujo sales en FLOWS")
  return (
    <>
      <FlowHeader flow={flow} />
      <SalesFlow />
    </>
  )
}
