import { AuthFlow } from "@/components/auth/auth-flow"
import { FlowHeader } from "@/components/console/flow-header"
import { getFlow } from "@/lib/flows"

export default function AuthPage() {
  const flow = getFlow("auth")
  if (flow === undefined) throw new Error("falta el flujo auth en FLOWS")
  return (
    <>
      <FlowHeader flow={flow} />
      <AuthFlow />
    </>
  )
}
