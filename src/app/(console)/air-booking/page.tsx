import { AirBookingFlow } from "@/components/air-booking/air-booking-flow"
import { FlowHeader } from "@/components/console/flow-header"
import { getFlow } from "@/lib/flows"

export default function AirBookingPage() {
  const flow = getFlow("air-booking")
  if (flow === undefined) throw new Error("falta el flujo air-booking en FLOWS")
  return (
    <>
      <FlowHeader flow={flow} />
      <AirBookingFlow />
    </>
  )
}
