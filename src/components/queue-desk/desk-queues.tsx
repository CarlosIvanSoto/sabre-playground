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

/** Una fila de la lista: una cola del conteo, o una vacía que solo trae actividad. */
interface Row {
  queue: string
  count: number
  named: boolean
  /** No está en el conteo: Sabre la listó en `activity` porque tiene contadores. */
  empty: boolean
}

/** S y las alfabéticas primero, después las numéricas en orden, y al final las con nombre. */
function rank(row: Row): [number, number, string] {
  if (row.named) return [2, 0, row.queue]
  return /^\d+$/.test(row.queue)
    ? [1, Number(row.queue), row.queue]
    : [0, 0, row.queue]
}

function rowsOf(count: DeskCount, activity?: DeskActivity): Row[] {
  const rows: Row[] = [
    ...count.queues.map((row) => ({ ...row, empty: false })),
    ...(activity?.emptyWithCounters ?? []).map((queue) => ({
      queue,
      count: 0,
      named: false,
      empty: true,
    })),
  ]
  return rows.sort((a, b) => {
    const [ga, na, ta] = rank(a)
    const [gb, nb, tb] = rank(b)
    return ga - gb || na - nb || ta.localeCompare(tb)
  })
}

/** `11-09T17:34` → `11-09 17:34`. */
const hostTime = (text: string) => text.replace("T", " ")

/**
 * La columna de colas de la mesa. Una sola lista con dos datos por cola:
 * - a la derecha, cuántos PNR o mensajes tiene ahora (`count`);
 * - debajo, en palabras, la actividad de `queue.activity` que no está en cero (F12.2). No se
 *   interpreta: nadie sabe desde cuándo cuenta (Q-097).
 *
 * Las colas vacías que Sabre lista en `activity` van en la misma lista, con 0. Un clic en una
 * cola numérica o en la S (mensajes) entra a ella; las colas con nombre se ven sin acción
 * (Q-086). Como `count` no lista las vacías, abajo se puede escribir otra cola para entrar.
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
  const rows = count === undefined ? [] : rowsOf(count, activity)
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
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground">
          Ninguna cola con PNR o mensajes.
        </p>
      ) : (
        <div className="flex flex-col gap-1">
          <div className="text-muted-foreground flex items-baseline justify-between px-2 text-xs">
            <span>Cola</span>
            <span>Ahora</span>
          </div>
          <ul
            className="flex flex-col divide-y rounded-md border"
            aria-label="Colas"
          >
            {rows.map((row) => (
              <li key={row.queue}>
                <QueueRow
                  row={row}
                  estimated={count.estimated.includes(row.queue)}
                  counters={activity?.queues[row.queue]}
                  active={row.queue === active}
                  disabled={disabled}
                  disabledReason={disabledReason}
                  onEnter={onEnter}
                />
              </li>
            ))}
          </ul>
          {activity !== undefined && (
            <p
              className="text-muted-foreground px-2 text-xs"
              title="QueueAnalysisLLSRQ: ninguna fuente dice desde cuándo cuentan (Q-097)"
            >
              Debajo de cada cola, la actividad del <code>QA</code>: no se sabe
              desde cuándo cuenta.
            </p>
          )}
        </div>
      )}
      {activityFailure !== undefined && (
        <p className="text-destructive text-xs break-words">
          queue.activity: {activityFailure}
        </p>
      )}
      {count !== undefined && (
        <dl className="text-muted-foreground grid grid-cols-[auto_1fr] gap-x-2 border-t pt-2 text-xs">
          <dt>Total</dt>
          <dd>
            {[
              count.totals.pnrs !== undefined && `${count.totals.pnrs} PNR`,
              count.totals.messages !== undefined &&
                `${count.totals.messages} ${count.totals.messages === 1 ? "mensaje" : "mensajes"}`,
              count.totals.specials !== undefined &&
                count.totals.specials > 0 &&
                `${count.totals.specials} especiales`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </dd>
          {count.countedAt !== undefined && (
            <>
              <dt>Conteo</dt>
              <dd className="font-mono">{hostTime(count.countedAt)}</dd>
            </>
          )}
          {activity?.analyzedAt !== undefined && (
            <>
              <dt>Actividad</dt>
              <dd className="font-mono">{hostTime(activity.analyzedAt)}</dd>
            </>
          )}
          {(count.countedAt !== undefined ||
            activity?.analyzedAt !== undefined) && (
            <dd className="col-span-2">Hora del host, sin año.</dd>
          )}
        </dl>
      )}
      <OtherQueue disabled={disabled} onEnter={onEnter} />
      {disabledReason !== undefined && (
        <p className="text-muted-foreground text-xs">{disabledReason}</p>
      )}
    </div>
  )
}

/** Una cola: número, si el cursor está dentro, cuántos tiene ahora y, debajo, su actividad. */
function QueueRow({
  row,
  estimated,
  counters,
  active,
  disabled,
  disabledReason,
  onEnter,
}: {
  row: Row
  estimated: boolean
  counters?: QueueActivityCounters
  active: boolean
  disabled: boolean
  disabledReason?: string
  onEnter: (queue: string) => void
}) {
  const content = (
    <>
      <span className="flex w-full items-center gap-2">
        <span className="font-mono font-medium">
          {row.queue === "S" ? "S · mensajes" : row.queue}
        </span>
        {active && <Badge>dentro</Badge>}
        {row.named && <span className="text-xs">Q-086</span>}
        <span className="ms-auto flex items-baseline gap-1 tabular-nums">
          {estimated && (
            <span
              className="text-muted-foreground text-xs"
              title="Estimado: ajustado después de mover o sacar, hasta el siguiente ⟳"
            >
              ≈
            </span>
          )}
          <span
            className={cn(
              "text-base font-semibold",
              row.count === 0 && "text-muted-foreground font-normal"
            )}
          >
            {row.count}
          </span>
        </span>
      </span>
      <Activity counters={counters} empty={row.empty} />
    </>
  )
  const base = "flex w-full flex-col items-start gap-0.5 px-2 py-1.5"
  if (row.named) {
    return (
      <div
        className={cn(base, "text-muted-foreground")}
        title="Q-086: list y access con este nombre dan INVALID QUEUE NAME FORMAT"
      >
        {content}
      </div>
    )
  }
  return (
    <button
      type="button"
      disabled={disabled}
      aria-current={active ? "true" : undefined}
      title={disabledReason ?? `Entrar a la cola ${row.queue}`}
      onClick={() => onEnter(row.queue)}
      className={cn(
        base,
        "hover:bg-muted text-start disabled:pointer-events-none disabled:opacity-50",
        active && "bg-muted"
      )}
    >
      {content}
    </button>
  )
}

/**
 * La actividad de una cola en palabras: `37 ignorados · 7 transferidos`. Solo lo que no está
 * en cero, y sin `numMessages`, que es el número de la derecha. El título dice el nombre de
 * Sabre.
 */
function Activity({
  counters,
  empty,
}: {
  counters?: QueueActivityCounters
  empty: boolean
}) {
  const shown =
    counters === undefined
      ? []
      : ACTIVITY_COUNTERS.filter(
          ({ key }) => key !== "numMessages" && counters[key] !== 0
        )
  if (shown.length === 0 && !empty) return null
  return (
    <span className="text-muted-foreground text-xs">
      {empty && "vacía"}
      {empty && shown.length > 0 && " · "}
      {counters !== undefined &&
        shown.map(({ key, words, label }, index) => (
          <span key={key} title={label}>
            {index > 0 && " · "}
            <span className="tabular-nums">{counters[key]}</span>{" "}
            {counters[key] === 1 ? words[0] : words[1]}
          </span>
        ))}
    </span>
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
