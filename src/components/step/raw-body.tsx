"use client"

import { useState } from "react"
import { JsonTree } from "@/components/custom/json-tree"
import { Button } from "@/components/ui/button"
import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockContent,
  CodeBlockCopyButton,
  CodeBlockLine,
} from "@/components/ui/code-block"
import { useHighlightedCode } from "@/hooks/use-highlighted-code"
import { formatXml } from "@/lib/format-xml"
import type { RawResponse } from "@/lib/step/types"

type Format = "xml" | "json" | "text"

/** Arriba de esto no se resalta: shiki en el navegador se vuelve lento con un BFM grande. */
const HIGHLIGHT_LIMIT = 200_000

/** El formato del body: SOAP y lo que empiece con `<` es XML; lo que se parsee, JSON. */
function detect(raw: RawResponse): { format: Format; pretty: string } {
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

/**
 * El body de la respuesta cruda, con formato: el JSON como árbol colapsable y el XML con
 * sangría y resaltado. "Tal cual" muestra el texto como llegó, resaltado, y su botón de
 * copiar copia ese texto original.
 */
export function RawBody({ raw }: { raw: RawResponse }) {
  const { format, pretty } = detect(raw)
  const [asIs, setAsIs] = useState(false)

  return (
    <div className="flex flex-col gap-2">
      {format !== "text" && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="xs"
            aria-pressed={asIs}
            onClick={() => setAsIs((value) => !value)}
          >
            {asIs ? "Con formato" : "Tal cual"}
          </Button>
        </div>
      )}
      {format === "json" && !asIs ? (
        <JsonTree value={JSON.parse(raw.body)} />
      ) : (
        <Text
          text={asIs ? raw.body : pretty}
          original={raw.body}
          language={format === "text" ? "" : format}
        />
      )}
    </div>
  )
}

/** Texto resaltado. El botón de copiar copia `original`, el body como llegó. */
function Text({
  text,
  original,
  language,
}: {
  text: string
  original: string
  language: string
}) {
  // Sin lenguaje, el hook devuelve las líneas sin resaltar.
  const lines = useHighlightedCode(
    text,
    text.length > HIGHLIGHT_LIMIT ? "" : language
  )

  return (
    <CodeBlock size="sm">
      <CodeBlockActions>
        <CodeBlockCopyButton value={original} />
      </CodeBlockActions>
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
