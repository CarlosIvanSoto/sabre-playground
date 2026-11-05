import Link from "next/link"
import { FlowAvailability } from "@/components/console/flow-availability"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { FLOWS } from "@/lib/flows"

export default function Home() {
  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">sabre-playground</h1>
        <p className="text-muted-foreground">
          Playground local de <code>sabre-client</code>: recorre los flujos del
          SDK paso a paso. No es una herramienta oficial de Sabre.
        </p>
      </header>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {FLOWS.map((flow) => (
          <Link key={flow.slug} href={`/${flow.slug}`} className="group">
            <Card className="group-hover:bg-muted/50 h-full transition-colors">
              <CardHeader>
                <CardDescription>Flujo {flow.number}</CardDescription>
                <CardTitle>{flow.title}</CardTitle>
                <CardDescription>{flow.description}</CardDescription>
                <FlowAvailability flow={flow} />
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </>
  )
}
