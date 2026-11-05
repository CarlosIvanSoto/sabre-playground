import { FlowHeader } from "@/components/console/flow-header"
import { QueueParagraphFlow } from "@/components/queue-paragraph/queue-paragraph-flow"
import { getFlow } from "@/lib/flows"

export default function QueueParagraphPage() {
  const flow = getFlow("queue-paragraph")
  if (flow === undefined) {
    throw new Error("falta el flujo queue-paragraph en FLOWS")
  }
  return (
    <>
      <FlowHeader flow={flow} />
      <QueueParagraphFlow />
    </>
  )
}
