"use client"

import { FileCodeIcon, FileTextIcon } from "lucide-react"
import { useState } from "react"
import { DownloadButton } from "@/components/custom/download-button"
import { JsonTree } from "@/components/custom/json-tree"
import { Button } from "@/components/ui/button"
import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockContent,
  CodeBlockCopyButton,
  CodeBlockHeader,
  CodeBlockLine,
  CodeBlockTitle,
} from "@/components/ui/code-block"
import { useHighlightedCode } from "@/hooks/use-highlighted-code"
import { formatXml } from "@/lib/format-xml"

/** Lo que hace falta para mostrar un body crudo: el de la respuesta o el del request. */
interface RawText {
  protocol: string
  body: string
}

type Format = "xml" | "json" | "text"

/** Arriba de esto no se resalta: shiki en el navegador se vuelve lento con un BFM grande. */
const HIGHLIGHT_LIMIT = 200_000

/** El formato del body: SOAP y lo que empiece con `<` es XML; lo que se parsee, JSON. */
function detect(raw: RawText): { format: Format; pretty: string } {
  const body = raw.body.trim()
  if (raw.protocol === "soap" || body.startsWith("<")) {
    return { format: "xml", pretty: formatXml(body) }
  }
  try {
    return { format: "json", pretty: JSON.stringify(JSON.parse(body), null, 2) }
  } catch {
    return { format: "text", pretty: raw.body }
  }
}

const EXTENSION: Record<Format, string> = {
  xml: "xml",
  json: "json",
  text: "txt",
}
const MEDIA_TYPE: Record<Format, string> = {
  xml: "application/xml",
  json: "application/json",
  text: "text/plain",
}

/**
 * Un body crudo (respuesta o request), con formato: el JSON como árbol colapsable y el XML con
 * sangría y resaltado. "Tal cual" muestra el texto como llegó. Copiar y descargar siempre
 * usan ese texto original, para que sirva de fixture.
 *
 * `name` es la base del archivo (p. ej. `queue.count`): se descarga como
 * `<name>.<suffix>.<xml|json|txt>`, con `suffix` `raw` (la respuesta) o `request`.
 */
export function RawBody({
  raw,
  name,
  suffix = "raw",
}: {
  raw: RawText
  name: string
  suffix?: "raw" | "request"
}) {
  const { format, pretty } = detect(raw)
  const [asIs, setAsIs] = useState(false)
  const filename = `${name}.${suffix}.${EXTENSION[format]}`

  const asIsToggle =
    format === "text" ? null : (
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label="Ver tal cual"
        aria-pressed={asIs}
        className="aria-pressed:text-foreground"
        onClick={() => setAsIs((value) => !value)}
      >
        <FileTextIcon />
      </Button>
    )

  if (format === "json" && !asIs) {
    return (
      <JsonTree
        value={JSON.parse(raw.body)}
        filename={filename}
        source={raw.body}
        actions={asIsToggle}
      />
    )
  }

  return (
    <Text
      text={asIs ? raw.body : pretty}
      original={raw.body}
      language={format === "text" ? "" : format}
      filename={filename}
      type={MEDIA_TYPE[format]}
      actions={asIsToggle}
    />
  )
}

/** Texto resaltado con su barra. Copiar y descargar usan `original`, el body como llegó. */
function Text({
  text,
  original,
  language,
  filename,
  type,
  actions,
}: {
  text: string
  original: string
  language: string
  filename: string
  type: string
  actions: React.ReactNode
}) {
  // Sin lenguaje, el hook devuelve las líneas sin resaltar.
  const lines = useHighlightedCode(
    text,
    text.length > HIGHLIGHT_LIMIT ? "" : language
  )

  return (
    <CodeBlock size="sm">
      <CodeBlockHeader>
        <CodeBlockTitle>
          <FileCodeIcon />
          {filename}
        </CodeBlockTitle>
        <CodeBlockActions>
          {actions}
          <DownloadButton
            value={original}
            filename={filename}
            mediaType={type}
          />
          <CodeBlockCopyButton value={original} />
        </CodeBlockActions>
      </CodeBlockHeader>
      <CodeBlockContent wrap className="max-h-[32rem]">
        {lines.map((line, index) => (
          // Las líneas no tienen id y cambian todas juntas.
          // biome-ignore lint/suspicious/noArrayIndexKey: ver arriba
          <CodeBlockLine key={index}>{line}</CodeBlockLine>
        ))}
      </CodeBlockContent>
    </CodeBlock>
  )
}
