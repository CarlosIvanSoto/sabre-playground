"use client"

import { SearchIcon } from "lucide-react"
import { Fragment, useState } from "react"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  ISSUE_BLOCKED_REASON,
  matchHostCommand,
  suggestHostCommands,
  toHostSeparator,
} from "@/lib/host-command-policy"
import {
  HOST_COMMAND_GROUPS,
  HOST_COMMAND_TYPE_LABELS,
  HOST_COMMANDS,
  type HostCommand,
  type HostCommandType,
} from "@/lib/host-commands"

/**
 * El panel de comandos conocidos (F15.3): los de `host-commands.ts`, agrupados como la página
 * comandos-de-host del wiki, con búsqueda. Un clic pone la plantilla en la línea, sin
 * mandarla. Las entradas de tipo `emite`, y en producción las que no son de lectura, se ven
 * pero no se insertan (ADR-032).
 */

const TYPE_VARIANT: Record<
  HostCommandType,
  "secondary" | "outline" | "default" | "destructive"
> = {
  lectura: "secondary",
  sesion: "outline",
  escritura: "default",
  emite: "destructive",
}

export function TypeBadge({ type }: { type: HostCommandType }) {
  return (
    <Badge variant={TYPE_VARIANT[type]}>{HOST_COMMAND_TYPE_LABELS[type]}</Badge>
  )
}

/** La plantilla con los marcadores resaltados. */
function Template({ template }: { template: string }) {
  const parts = template.split(/(<[^<>]+>)/u)
  return (
    <code className="font-mono text-sm">
      {parts.map((part, index) =>
        part.startsWith("<") ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: partes fijas de la plantilla
          <span key={index} className="text-primary italic">
            {part}
          </span>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: partes fijas de la plantilla
          <Fragment key={index}>{part}</Fragment>
        )
      )}
    </code>
  )
}

function matches(entry: HostCommand, query: string): boolean {
  if (query === "") return true
  return [entry.template, entry.description, entry.source].some((text) =>
    text.toUpperCase().includes(query)
  )
}

export function HostCommandPanel({
  onInsert,
  readOnly,
}: {
  onInsert: (entry: HostCommand) => void
  /** Producción: lo que no es lectura se ve, pero no se inserta. */
  readOnly: boolean
}) {
  const [search, setSearch] = useState("")
  const query = toHostSeparator(search).trim().toUpperCase()
  const shown = HOST_COMMAND_GROUPS.map((group) => ({
    ...group,
    entries: HOST_COMMANDS.filter(
      (entry) => entry.group === group.id && matches(entry, query)
    ),
  })).filter((group) => group.entries.length > 0)

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Comandos conocidos</CardTitle>
        <CardDescription>
          De <code>wiki/concepts/comandos-de-host.md</code>. Un clic pone la
          plantilla en la línea, sin mandarla; Tab salta de un marcador al
          siguiente.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="relative">
          <SearchIcon className="text-muted-foreground pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2" />
          <Input
            type="search"
            aria-label="Buscar comando"
            placeholder="Buscar por comando o por texto"
            className="ps-8"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        {shown.length === 0 && (
          <p className="text-muted-foreground text-sm">Nada con «{search}».</p>
        )}
        <div className="flex max-h-[75vh] flex-col gap-4 overflow-y-auto">
          {shown.map((group) => (
            <section key={group.id} className="flex flex-col gap-1">
              <h3 className="text-muted-foreground text-xs font-medium uppercase">
                {group.label}
              </h3>
              <ul className="flex flex-col">
                {group.entries.map((entry) => {
                  const blocked =
                    entry.type === "emite"
                      ? ISSUE_BLOCKED_REASON
                      : readOnly && entry.type !== "lectura"
                        ? `Producción: solo se mandan las lecturas del panel, y es de tipo ${HOST_COMMAND_TYPE_LABELS[entry.type]}.`
                        : undefined
                  return (
                    <li key={entry.template}>
                      <button
                        type="button"
                        disabled={blocked !== undefined}
                        title={blocked ?? entry.source}
                        onClick={() => onInsert(entry)}
                        className="hover:bg-muted flex w-full flex-col gap-0.5 rounded-md px-2 py-1.5 text-start disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <span className="flex items-center justify-between gap-2">
                          <Template template={entry.template} />
                          <TypeBadge type={entry.type} />
                        </span>
                        <span className="text-muted-foreground text-xs">
                          {entry.description}
                        </span>
                        <span className="text-muted-foreground/70 truncate text-[0.65rem]">
                          {entry.source}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Junto a la línea: el tipo del comando escrito si corresponde a una entrada del panel (por
 * prefijo), o el de la entrada que se está escribiendo (`PE` → `PE*<PCC>`).
 */
export function CommandType({ command }: { command: string }) {
  if (command.trim() === "") return null
  const entry = matchHostCommand(command)
  if (entry !== undefined) {
    return (
      <>
        <TypeBadge type={entry.type} />
        <code className="text-muted-foreground">{entry.template}</code>
      </>
    )
  }
  const [first, ...rest] = suggestHostCommands(command)
  if (first !== undefined && rest.every((other) => other.type === first.type)) {
    return (
      <>
        <TypeBadge type={first.type} />
        <code className="text-muted-foreground">
          {first.template}
          {rest.length > 0 && ` y ${rest.length} más`}
        </code>
      </>
    )
  }
  if (first !== undefined) {
    return (
      <span className="text-muted-foreground">
        {1 + rest.length} comandos del panel empiezan así
      </span>
    )
  }
  return <span className="text-muted-foreground">no está en el panel</span>
}
