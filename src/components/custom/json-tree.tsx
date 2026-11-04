"use client"

import { cn } from "cn"
import {
  ChevronRight,
  ChevronsDownUpIcon,
  ChevronsUpDownIcon,
  FileJsonIcon,
} from "lucide-react"
import { useState } from "react"
import { DownloadButton } from "@/components/custom/download-button"
import { Button } from "@/components/ui/button"
import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockContent,
  CodeBlockCopyButton,
  CodeBlockHeader,
  CodeBlockTitle,
} from "@/components/ui/code-block"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

/**
 * Árbol JSON colapsable por nivel, sobre el `CodeBlock` de shadcn. La barra es un
 * `CodeBlockHeader` con el nombre del archivo y las acciones: expandir o colapsar todo,
 * descargar y copiar. Cada objeto o arreglo es un `Collapsible` de Base UI. Va en `custom/`
 * porque shadcn no trae un visor JSON (ADR-023).
 *
 * Recibe datos planos (lo que pasa por `JSON.stringify`). Dentro de `<code>` todo es `span`.
 */

type Json = string | number | boolean | null | Json[] | { [key: string]: Json }

interface JsonTreeProps
  extends Omit<React.ComponentProps<typeof CodeBlock>, "children"> {
  value: unknown
  /** Nombre del archivo: se muestra en la barra y es el de la descarga. */
  filename: string
  /** Texto que se copia y se descarga. Por defecto, `value` como JSON con sangría. */
  source?: string
  /** Niveles abiertos al inicio. Por defecto 2. */
  defaultDepth?: number
  /** Acciones extra, antes de las de expandir, descargar y copiar. */
  actions?: React.ReactNode
}

/** Niveles de objetos y arreglos con contenido: 0 para un primitivo o un `{}`. */
function branchDepth(value: Json): number {
  if (value === null || typeof value !== "object") return 0
  const children = Object.values(value)
  if (children.length === 0) return 0
  return 1 + Math.max(...children.map(branchDepth))
}

function JsonTree({
  value,
  filename,
  source,
  defaultDepth = 2,
  actions,
  className,
  ...props
}: JsonTreeProps) {
  const data = (value === undefined ? null : value) as Json
  const depth = branchDepth(data)
  // Expandir o colapsar todo vuelve a montar el árbol con otra profundidad inicial. `expanded`
  // dice si todo está abierto; abrir o cerrar un nodo a mano lo pasa a `false`, y el botón
  // vuelve a ofrecer "Expandir todo".
  const [tree, setTree] = useState({
    openDepth: defaultDepth,
    expanded: depth <= defaultDepth,
    version: 0,
  })
  const text = source ?? JSON.stringify(data, null, 2)

  const toggleAll = () =>
    setTree((t) =>
      t.expanded
        ? { openDepth: 0, expanded: false, version: t.version + 1 }
        : { openDepth: Infinity, expanded: true, version: t.version + 1 }
    )
  const onManualToggle = () =>
    setTree((t) => (t.expanded ? { ...t, expanded: false } : t))

  return (
    <CodeBlock
      data-slot="json-tree"
      size="sm"
      className={cn(className)}
      {...props}
    >
      <CodeBlockHeader>
        <CodeBlockTitle>
          <FileJsonIcon />
          {filename}
        </CodeBlockTitle>
        <CodeBlockActions>
          {actions}
          {depth > 0 && (
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={tree.expanded ? "Colapsar todo" : "Expandir todo"}
              onClick={toggleAll}
            >
              {tree.expanded ? <ChevronsDownUpIcon /> : <ChevronsUpDownIcon />}
            </Button>
          )}
          <DownloadButton
            value={text}
            filename={filename}
            mediaType="application/json"
          />
          <CodeBlockCopyButton value={text} />
        </CodeBlockActions>
      </CodeBlockHeader>
      <CodeBlockContent wrap className="max-h-[32rem]">
        <JsonNode
          key={tree.version}
          value={data}
          level={0}
          openDepth={tree.openDepth}
          onToggle={onManualToggle}
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
  /** Se llama cuando se abre o se cierra un nodo a mano. */
  onToggle: () => void
  last: boolean
}

function JsonNode({
  value,
  name,
  level,
  openDepth,
  onToggle,
  last,
}: JsonNodeProps) {
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
      onToggle={onToggle}
    >
      {entries.map(([key, item], index) => (
        <JsonNode
          key={key ?? index}
          name={key}
          value={item}
          level={level + 1}
          openDepth={openDepth}
          onToggle={onToggle}
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
  onToggle,
  children,
}: {
  label: React.ReactNode
  summary: string
  brackets: [string, string]
  comma: React.ReactNode
  defaultOpen: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  // Estado propio por nodo: con `group-data-[open]` un nodo cerrado heredaría el estilo del
  // ancestro abierto.
  const [expanded, setExpanded] = useState(defaultOpen)

  return (
    <Collapsible
      open={expanded}
      onOpenChange={(open) => {
        setExpanded(open)
        onToggle()
      }}
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
