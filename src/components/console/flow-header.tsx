import { BookOpenIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { Flow } from "@/lib/flows"

/**
 * El encabezado de un flujo: número, título, métodos del SDK que recorre y "Qué es esto", la
 * ruta de su página en `sabre-wiki`. La consola muestra el flujo; la explicación vive en la
 * wiki (ADR-022).
 */
export function FlowHeader({ flow }: { flow: Flow }) {
  return (
    <header className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <p className="text-muted-foreground text-sm">Flujo {flow.number}</p>
        <h1 className="text-2xl font-semibold">{flow.title}</h1>
        <p className="text-muted-foreground">{flow.description}</p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {flow.methods.map((method) => (
          <Badge key={method} variant="outline" className="font-mono">
            {method}
          </Badge>
        ))}
      </div>
      <p className="flex flex-wrap items-center gap-1.5 text-sm">
        <BookOpenIcon className="text-muted-foreground size-4" />
        <span className="font-medium">Qué es esto:</span>
        <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs break-all">
          sabre-wiki/{flow.wiki}
        </code>
      </p>
    </header>
  )
}
