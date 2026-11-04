import { ConstructionIcon } from "lucide-react"
import { notFound } from "next/navigation"
import { FlowHeader } from "@/components/console/flow-header"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { FLOWS, getFlow } from "@/lib/flows"

export function generateStaticParams() {
  return FLOWS.map((flow) => ({ flow: flow.slug }))
}

export const dynamicParams = false

/**
 * Lugar de cada flujo hasta que llegue su fase. Cuando un flujo tenga su página propia
 * (`src/app/(console)/<slug>/page.tsx`), esa ruta estática le gana a esta.
 */
export default async function FlowPage({
  params,
}: {
  params: Promise<{ flow: string }>
}) {
  const { flow: slug } = await params
  const flow = getFlow(slug)
  if (flow === undefined) notFound()

  return (
    <>
      <FlowHeader flow={flow} />
      <Empty className="flex-none border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ConstructionIcon />
          </EmptyMedia>
          <EmptyTitle>Todavía no está</EmptyTitle>
          <EmptyDescription>
            Este flujo llega con la Fase {flow.phase} del plan v2.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    </>
  )
}
