"use client"

import { useState } from "react"
import type { QueueActivityCounters } from "sabre-client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { type DeskActivity, type DeskCount, workingPcc } from "@/lib/queue-desk"
import { ACTIVITY_COUNTERS, PCC_PATTERN, parseQueueRef } from "@/lib/queues"
import { cn } from "@/lib/utils"

/**
 * La columna de conteo de la mesa: el resultado de `count` como lista. Un clic en una cola
 * numérica o en la S (mensajes) entra a ella; las colas con nombre se ven sin acción (Q-086). Como Sabre no lista
 * las colas vacías, abajo se puede escribir otra cola para entrar.
 *
 * Debajo de cada cola van los contadores de `queue.activity` que no están en cero (F12.2), y al
 * final las colas vacías que tienen alguno. No se interpretan (Q-097).
 */
export function DeskQueues({
  count,
  failure,
  activity,
  activityFailure,
  active,
  disabledReason,
  pending,
  onEnter,
}: {
  count?: DeskCount
  failure?: string
  activity?: DeskActivity
  activityFailure?: string
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
                  <span className="ms-auto tabular-nums">
                    {count.estimated.includes(row.queue) && (
                      <span
                        className="text-muted-foreground me-1 text-xs"
                        title="Estimado: ajustado después de mover o sacar, hasta el siguiente ⟳"
                      >
                        estimado
                      </span>
                    )}
                    {row.count}
                  </span>
                </button>
              )}
              <Counters counters={activity?.queues[row.queue]} />
            </li>
          ))}
        </ul>
      )}
      {activity !== undefined && activity.emptyWithCounters.length > 0 && (
        <div className="flex flex-col gap-0.5 text-xs">
          <span className="text-muted-foreground">Vacías con contadores</span>
          {activity.emptyWithCounters.map((queue) => (
            <div key={queue} className="px-2">
              <span className="font-mono">{queue}</span>
              <Counters counters={activity.queues[queue]} />
            </div>
          ))}
        </div>
      )}
      {activityFailure !== undefined && (
        <p className="text-destructive text-xs break-words">
          queue.activity: {activityFailure}
        </p>
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
          {activity?.analyzedAt !== undefined && (
            <span
              className="block font-mono"
              title="queue.activity: contadores sin interpretar (Q-097)"
            >
              QA {activity.analyzedAt}
            </span>
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

/**
 * Los contadores de `activity` de una cola que no están en cero, salvo `numMessages`, que ya es
 * el número del conteo. El título de cada uno dice el nombre de Sabre.
 */
function Counters({ counters }: { counters?: QueueActivityCounters }) {
  if (counters === undefined) return null
  const shown = ACTIVITY_COUNTERS.filter(
    ({ key }) => key !== "numMessages" && counters[key] !== 0
  )
  if (shown.length === 0) return null
  return (
    <div className="text-muted-foreground flex flex-wrap gap-x-2 ps-12 pe-2 text-xs tabular-nums">
      {shown.map(({ key, short, label }) => (
        <span key={key} title={`${label} (sin interpretar, Q-097)`}>
          {short} {counters[key]}
        </span>
      ))}
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

/**
 * El PCC de trabajo de la mesa (F9.6): con qué PCC se cuenta y se entra. La sesión no cambia;
 * el PCC va en cada operación. Vacío vuelve al de la sesión.
 */
export function DeskPcc({
  pcc,
  sessionPcc,
  disabled,
  onChange,
}: {
  /** El PCC de trabajo; vacío es el de la sesión. */
  pcc: string
  sessionPcc: string
  disabled: boolean
  onChange: (pcc: string) => void
}) {
  const [text, setText] = useState(pcc)
  const typed = text.trim().toUpperCase()
  const invalid = typed !== "" && !PCC_PATTERN.test(typed)
  const next = workingPcc(typed, sessionPcc)
  return (
    <form
      className="flex flex-col gap-1"
      onSubmit={(event) => {
        event.preventDefault()
        if (!invalid) onChange(next)
      }}
    >
      <Label htmlFor="desk-pcc" className="text-xs">
        PCC de trabajo
      </Label>
      <div className="flex items-center gap-2">
        <Input
          id="desk-pcc"
          className="h-8 font-mono uppercase"
          maxLength={4}
          placeholder={sessionPcc || "sesión"}
          aria-invalid={invalid}
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
        <Button
          type="submit"
          size="sm"
          variant="outline"
          disabled={disabled || invalid || next === pcc}
          title={
            invalid
              ? "3 o 4 letras o dígitos"
              : "Cambia el PCC: sale de la cola si está dentro y vuelve a contar"
          }
        >
          Cambiar
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">
        {pcc === ""
          ? "El de la sesión."
          : `Otro PCC que el de la sesión${sessionPcc ? ` (${sessionPcc})` : ""}.`}
      </p>
    </form>
  )
}
