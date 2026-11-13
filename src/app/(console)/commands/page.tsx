import { CommandsFlow } from "@/components/commands/commands-flow"
import { FlowHeader } from "@/components/console/flow-header"
import { getFlow } from "@/lib/flows"

/** Flujo 8: la consola de comandos de host (ADR-032). */
export default function CommandsPage() {
  const flow = getFlow("commands")
  if (flow === undefined) throw new Error("falta el flujo commands en FLOWS")
  return (
    <>
      <FlowHeader flow={flow} />
      <CommandsFlow />
    </>
  )
}
