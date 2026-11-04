"use client"

import { cn } from "cn"
import { ChevronRight } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockContent,
  CodeBlockCopyButton,
} from "@/components/ui/code-block"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

/**
 * Árbol JSON colapsable por nivel, sobre el `CodeBlock` de shadcn: el mismo marco, tamaño y
 * botón de copiar (que copia el JSON completo con sangría). Cada objeto o arreglo es un
 * `Collapsible` de Base UI. Va en `custom/` porque shadcn no trae un visor JSON (ADR-023).
 *
 * Recibe datos planos (lo que pasa por `JSON.stringify`). Dentro de `<code>` todo es `span`.
 */

type Json = string | number | boolean | null | Json[] | { [key: string]: Json }

interface JsonTreeProps
  extends Omit<React.ComponentProps<typeof CodeBlock>, "children"> {
  value: unknown
  /** Niveles abiertos al inicio. Por defecto 2. */
  defaultDepth?: number
}

function JsonTree({
  value,
  defaultDepth = 2,
  className,
  ...props
}: JsonTreeProps) {
  // Expandir o colapsar todo vuelve a montar el árbol con otra profundidad inicial.
  const [depth, setDepth] = useState({ value: defaultDepth, version: 0 })
  const data = (value === undefined ? null : value) as Json
  const expandable = data !== null && typeof data === "object"

  return (
    <CodeBlock
      data-slot="json-tree"
      size="sm"
      className={cn(className)}
      {...props}
    >
      <CodeBlockActions>
        {expandable && (
          <>
            <Button
              variant="ghost"
              size="xs"
              onClick={() =>
                setDepth((d) => ({ value: Infinity, version: d.version + 1 }))
              }
            >
              Expandir
            </Button>
            <Button
              variant="ghost"
              size="xs"
              onClick={() =>
                setDepth((d) => ({ value: 1, version: d.version + 1 }))
              }
            >
              Colapsar
            </Button>
          </>
        )}
        <CodeBlockCopyButton value={JSON.stringify(data, null, 2)} />
      </CodeBlockActions>
      <CodeBlockContent wrap className="max-h-[32rem]">
        <JsonNode
          key={depth.version}
          value={data}
          level={0}
          openDepth={depth.value}
          last
        />
      </CodeBlockContent>
    </CodeBlock>
  )
}

interface JsonNodeProps {
  value: Json
  name?: string
  level: number
  openDepth: number
  last: boolean
}

function JsonNode({ value, name, level, openDepth, last }: JsonNodeProps) {
  const comma = last ? null : <Punct>,</Punct>
  const label =
    name === undefined ? null : (
      <>
        <span data-slot="json-tree-key" className="text-foreground font-medium">
          {JSON.stringify(name)}
        </span>
        <Punct>: </Punct>
      </>
    )

  if (value === null || typeof value !== "object") {
    return (
      <span data-slot="json-tree-line" className="block ps-3.5">
        {label}
        <Primitive value={value} />
        {comma}
      </span>
    )
  }

  const isArray = Array.isArray(value)
  const entries: [string | undefined, Json][] = isArray
    ? value.map((item) => [undefined, item])
    : Object.entries(value)
  const [open, close] = isArray ? ["[", "]"] : ["{", "}"]

  if (entries.length === 0) {
    return (
      <span data-slot="json-tree-line" className="block ps-3.5">
        {label}
        <Punct>
          {open}
          {close}
        </Punct>
        {comma}
      </span>
    )
  }

  const summary = isArray
    ? `${entries.length} ${entries.length === 1 ? "elemento" : "elementos"}`
    : `${entries.length} ${entries.length === 1 ? "clave" : "claves"}`

  return (
    <JsonBranch
      label={label}
      summary={summary}
      brackets={[open, close]}
      comma={comma}
      defaultOpen={level < openDepth}
    >
      {entries.map(([key, item], index) => (
        <JsonNode
          key={key ?? index}
          name={key}
          value={item}
          level={level + 1}
          openDepth={openDepth}
          last={index === entries.length - 1}
        />
      ))}
    </JsonBranch>
  )
}

function JsonBranch({
  label,
  summary,
  brackets: [open, close],
  comma,
  defaultOpen,
  children,
}: {
  label: React.ReactNode
  summary: string
  brackets: [string, string]
  comma: React.ReactNode
  defaultOpen: boolean
  children: React.ReactNode
}) {
  // Estado propio por nodo: con `group-data-[open]` un nodo cerrado heredaría el estilo del
  // ancestro abierto.
  const [expanded, setExpanded] = useState(defaultOpen)

  return (
    <Collapsible
      open={expanded}
      onOpenChange={setExpanded}
      render={<span data-slot="json-tree-node" className="block" />}
    >
      <CollapsibleTrigger
        aria-label={summary}
        className="hover:bg-muted focus-visible:ring-ring/50 flex w-full cursor-pointer items-start rounded-sm text-start outline-none focus-visible:ring-2"
      >
        <ChevronRight
          className={cn(
            "text-muted-foreground mt-[0.2lh] size-3.5 shrink-0 transition-transform",
            expanded && "rotate-90"
          )}
        />
        <span>
          {label}
          <Punct>{open}</Punct>
          {!expanded && (
            <>
              <span className="text-muted-foreground"> … {summary} </span>
              <Punct>{close}</Punct>
              {comma}
            </>
          )}
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent
        render={<span className="border-border ms-1.5 block border-s ps-2" />}
      >
        {children}
      </CollapsibleContent>
      {expanded && (
        <span className="block ps-3.5">
          <Punct>{close}</Punct>
          {comma}
        </span>
      )}
    </Collapsible>
  )
}

function Primitive({ value }: { value: string | number | boolean | null }) {
  if (typeof value === "string") {
    return (
      <span className="text-muted-foreground break-all">
        {JSON.stringify(value)}
      </span>
    )
  }
  return (
    <span className={cn("text-primary", value === null && "italic")}>
      {String(value)}
    </span>
  )
}

function Punct({ children }: { children: React.ReactNode }) {
  return <span className="text-muted-foreground">{children}</span>
}

export type { JsonTreeProps }
export { JsonTree }
