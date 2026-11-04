"use client"

import { DownloadIcon } from "lucide-react"
import { Button } from "@/components/ui/button"

/** Descarga `value` como un archivo de texto llamado `filename`, sin pasar por el servidor. */
function download(value: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([value], { type }))
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

interface DownloadButtonProps
  extends Omit<React.ComponentProps<typeof Button>, "value" | "type"> {
  value: string
  filename: string
  /** Media type del archivo. Por defecto `text/plain`. */
  mediaType?: string
}

/** Botón de ícono para la barra de un `CodeBlock`, junto al de copiar. */
function DownloadButton({
  value,
  filename,
  mediaType = "text/plain",
  variant = "ghost",
  size = "icon-xs",
  onClick,
  ...props
}: DownloadButtonProps) {
  return (
    <Button
      data-slot="download-button"
      variant={variant}
      size={size}
      aria-label={`Descargar ${filename}`}
      onClick={(event) => {
        onClick?.(event)
        download(value, filename, mediaType)
      }}
      {...props}
    >
      <DownloadIcon />
    </Button>
  )
}

export type { DownloadButtonProps }
export { DownloadButton }
