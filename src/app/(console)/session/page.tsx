import { FlowHeader } from "@/components/console/flow-header"
import { SessionFlow } from "@/components/session/session-flow"
import { getFlow } from "@/lib/flows"

export default function SessionPage() {
  const flow = getFlow("session")
  if (flow === undefined) throw new Error("falta el flujo session en FLOWS")
  return (
    <>
      <FlowHeader flow={flow} />
      <SessionFlow />
    </>
  )
}
