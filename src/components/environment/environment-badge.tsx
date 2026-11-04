import { Badge } from "@/components/ui/badge"
import type { ConsoleEnvironmentId } from "@/lib/environment"

const LABEL: Record<ConsoleEnvironmentId, string> = {
  cert: "CERT",
  prod: "Producción",
  fake: "Fake",
}

const VARIANT = {
  cert: "secondary",
  prod: "destructive",
  fake: "outline",
} as const

/** El entorno como insignia: producción en rojo, para que no pase desapercibida. */
export function EnvironmentBadge({
  environment,
  className,
}: {
  environment: ConsoleEnvironmentId
  className?: string
}) {
  return (
    <Badge variant={VARIANT[environment]} className={className}>
      {LABEL[environment]}
    </Badge>
  )
}
