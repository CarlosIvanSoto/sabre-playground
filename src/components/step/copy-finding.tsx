"use client"

import { CheckIcon, NotebookPenIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { useHistory } from "@/components/history/history-provider"
import { Button } from "@/components/ui/button"
import { findingMarkdown } from "@/lib/finding"
import type { StepRun } from "@/lib/step/types"

/**
 * "Copiar como hallazgo": el paso como bloque Markdown para la wiki. La fecha y la entrada
 * salen de la entrada del historial que guardó este mismo `run` (`useStep` guarda el mismo
 * objeto en los dos lados), así que funciona igual desde un paso y desde el historial. Si la
 * entrada ya salió del historial, va sin entrada y con la fecha de ahora.
 */
export function CopyFinding({ run, title }: { run: StepRun; title: string }) {
  const { entries } = useHistory()
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timeout = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timeout)
  }, [copied])

  const copy = () => {
    const entry = entries.find((candidate) => candidate.run === run)
    const markdown = findingMarkdown(entry ?? { method: title, run })
    navigator.clipboard
      .writeText(markdown)
      .then(() => {
        setCopied(true)
        toast.success("Hallazgo copiado", {
          description: "Pégalo en la página de la entidad en sabre-wiki.",
        })
      })
      .catch(() => toast.error("No se pudo copiar al portapapeles"))
  }

  return (
    <Button variant="outline" size="sm" onClick={copy}>
      {copied ? <CheckIcon /> : <NotebookPenIcon />}
      Copiar como hallazgo
    </Button>
  )
}
