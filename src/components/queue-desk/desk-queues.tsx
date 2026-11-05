"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { DeskCount } from "@/lib/queue-desk"
import { parseQueueRef } from "@/lib/queues"
import { cn } from "@/lib/utils"

/**
 * La columna de conteo de la mesa: el resultado de `count` como lista. Un clic en una cola
 * numérica entra a ella; las colas con nombre se ven sin acción (Q-086). Como Sabre no lista
 * las colas vacías, abajo se puede escribir otra cola para entrar.
 */
export function DeskQueues({
  count,
  failure,
  active,
  disabledReason,
  pending,
  onEnter,
}: {
  count?: DeskCount
  failure?: string
  /** La cola en la que está el cursor, si está dentro de una. */
  active?: string
  /** Por qué no se puede entrar ahora; `undefined` si se puede. */
  disabledReason?: string
  pending: boolean
  onEnter: (queue: string) => void
}) {
  const disabled = pending || disabledReason !== undefined
  return (
    <div className="flex flex-col gap-3 text-sm">
      {failure !== undefined && (
        <p className="text-destructive break-words">{failure}</p>
      )}
      {count === undefined ? (
        <p className="text-muted-foreground">
          Sin conteo todavía. Con la sesión abierta, ⟳ corre{" "}
          <code>queue.count</code>.
        </p>
      ) : count.queues.length === 0 ? (
        <p className="text-muted-foreground">
          Ninguna cola con PNR o mensajes.
        </p>
      ) : (
        <ul className="flex flex-col gap-0.5" aria-label="Conteo de colas">
          {count.queues.map((row) => (
            <li key={row.queue}>
              {row.named ? (
                <div
                  className="text-muted-foreground flex items-center gap-2 rounded-md px-2 py-1.5"
                  title="Q-086: list y access con este nombre dan INVALID QUEUE NAME FORMAT"
                >
                  <span className="w-10 font-mono">{row.queue}</span>
                  <span className="text-xs">Q-086</span>
                  <span className="ms-auto tabular-nums">{row.count}</span>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={disabled}
                  aria-current={row.queue === active ? "true" : undefined}
                  title={disabledReason ?? `Entrar a la cola ${row.queue}`}
                  onClick={() => onEnter(row.queue)}
                  className={cn(
                    "hover:bg-muted flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-start disabled:pointer-events-none disabled:opacity-50",
                    row.queue === active && "bg-muted font-medium"
                  )}
                >
                  <span className="w-10 font-mono">{row.queue}</span>
                  {row.queue === active && <Badge>dentro</Badge>}
                  <span className="ms-auto tabular-nums">{row.count}</span>
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {count !== undefined && (
        <p className="text-muted-foreground border-t pt-2 text-xs">
          {[
            count.totals.pnrs !== undefined && `${count.totals.pnrs} PNR`,
            count.totals.messages !== undefined &&
              `${count.totals.messages} msg`,
            count.totals.specials !== undefined &&
              `${count.totals.specials} especiales`,
          ]
            .filter(Boolean)
            .join(" · ")}
          {count.countedAt !== undefined && (
            <span className="block font-mono">host {count.countedAt}</span>
          )}
        </p>
      )}
      <OtherQueue disabled={disabled} onEnter={onEnter} />
      {disabledReason !== undefined && (
        <p className="text-muted-foreground text-xs">{disabledReason}</p>
      )}
    </div>
  )
}

/** Entrar a una cola que no está en el conteo: Sabre no lista las vacías. */
function OtherQueue({
  disabled,
  onEnter,
}: {
  disabled: boolean
  onEnter: (queue: string) => void
}) {
  const [text, setText] = useState("")
  const ref = parseQueueRef(text)
  const invalid =
    text.trim() !== "" && (ref === undefined || typeof ref !== "number")
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault()
        if (typeof ref === "number") onEnter(String(ref))
      }}
    >
      <Input
        aria-label="Otra cola"
        placeholder="Otra cola"
        inputMode="numeric"
        className="h-8 font-mono"
        aria-invalid={invalid}
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
      <Button
        type="submit"
        size="sm"
        variant="outline"
        disabled={disabled || typeof ref !== "number"}
        title={invalid ? "Un número de 0 a 511" : undefined}
      >
        Entrar
      </Button>
    </form>
  )
}
