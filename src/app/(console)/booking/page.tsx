import { BookingFlow } from "@/components/booking/booking-flow"
import { FlowHeader } from "@/components/console/flow-header"
import { getFlow } from "@/lib/flows"

export default function BookingPage() {
  const flow = getFlow("booking")
  if (flow === undefined) throw new Error("falta el flujo booking en FLOWS")
  return (
    <>
      <FlowHeader flow={flow} />
      <BookingFlow />
    </>
  )
}
