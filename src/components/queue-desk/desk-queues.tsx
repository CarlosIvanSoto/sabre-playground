"use client"

import { CircleAlertIcon, FunnelIcon, XIcon } from "lucide-react"
import { useState } from "react"
import type { QueueActivityCounters } from "sabre-client"
import { AdditionalInfo } from "@/components/queues/queue-views"
import { SelectionField } from "@/components/queues/selection-field"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Spinner } from "@/components/ui/spinner"
import {
  type DeskActivity,
  type DeskCount,
  type DeskFilter,
  type DeskFilterScope,
  workingPcc,
} from "@/lib/queue-desk"
import {
  ACTIVITY_COUNTERS,
  PCC_PATTERN,
  parseQueueRef,
  type SelectionRow,
} from "@/lib/queues"
import { cn } from "@/lib/utils"

/** Una fila de la lista: una cola del conteo. */
type Row = DeskCount["queues"][number]

/** S y las alfabéticas primero, después las numéricas en orden, y al final las con nombre. */
function rank(queue: string, named = false): [number, number, string] {
  if (named) return [2, 0, queue]
  return /^\d+$/.test(queue) ? [1, Number(queue), queue] : [0, 0, queue]
}

function byRank<T>(key: (item: T) => [number, number, string]) {
  return (a: T, b: T) => {
    const [ga, na, ta] = key(a)
    const [gb, nb, tb] = key(b)
    return ga - gb || na - nb || ta.localeCompare(tb)
  }
}

/** Solo las colas del conteo (F13.3): las que trae solo `activity` van en su bloque. */
function rowsOf(count: DeskCount): Row[] {
  return [...count.queues].sort(byRank((row) => rank(row.queue, row.named)))
}

/** `11-09T17:34` → `11-09 17:34`. */
const hostTime = (text: string) => text.replace("T", " ")

/**
 * La columna de colas de la mesa. La lista Cola / Ahora tiene solo las colas del conteo, con
 * cuántos PNR o mensajes tiene cada una ahora (`count`).
 *
 * Con el check «Actividad» (F13.3), debajo de cada cola va, en palabras, la actividad de
 * `queue.activity` que no está en cero (F12.2), y las colas vacías que Sabre lista en
 * `activity` van en un bloque aparte, no en la lista: no tienen PNR. No se interpreta: nadie
 * sabe desde cuándo cuenta (Q-097).
 *
 * Con el filtro de la mesa (F14.1), cada cola contada con `selection` muestra su cuenta
 * filtrada al lado de la de ahora (`3 / 12`), y el error de su `count`, si falló. «Actividad de
 * la cola» deja los contadores de esa cola debajo de su fila aunque el check esté apagado.
 *
 * Un clic en una cola numérica o en la S (mensajes) entra a ella; las colas con nombre se ven
 * sin acción (Q-086). Como `count` no lista las vacías, abajo se puede escribir otra cola para
 * entrar.
 */
export function DeskQueues({
  count,
  failure,
  activity,
  activityFailure,
  queueActivity,
  queueActivityFailure,
  filter,
  filterPending = false,
  onClearFilter,
  active,
  disabledReason,
  pending,
  onEnter,
}: {
  count?: DeskCount
  failure?: string
  activity?: DeskActivity
  activityFailure?: string
  /** «Actividad de la cola» (F14.1): se ve aunque el check esté apagado. */
  queueActivity: DeskActivity["queues"]
  queueActivityFailure?: string
  /** El filtro aplicado, con sus cuentas (F14.1). */
  filter?: DeskFilter
  /** Si hay cuentas filtradas en curso. */
  filterPending?: boolean
  onClearFilter?: () => void
  /** La cola en la que está el cursor, si está dentro de una. */
  active?: string
  /** Por qué no se puede entrar ahora; `undefined` si se puede. */
  disabledReason?: string
  pending: boolean
  onEnter: (queue: string) => void
}) {
  const disabled = pending || disabledReason !== undefined
  const rows = count === undefined ? [] : rowsOf(count)
  const onlyActivity = [...(activity?.emptyWithCounters ?? [])].sort(
    byRank((queue: string) => rank(queue))
  )
  return (
    <div className="flex flex-col gap-3 text-sm">
      {failure !== undefined && (
        <p className="text-destructive break-words">{failure}</p>
      )}
      {filter !== undefined && (
        <FilterSummary
          filter={filter}
          pending={filterPending}
          onClear={() => onClearFilter?.()}
        />
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
            <span>{filter === undefined ? "Ahora" : "Filtro / Ahora"}</span>
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
                  counters={
                    activity?.queues[row.queue] ?? queueActivity[row.queue]
                  }
                  filtered={filter?.counts[row.queue]}
                  filterFailure={filter?.failures[row.queue]}
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
      {activity !== undefined && onlyActivity.length > 0 && (
        <OnlyActivity queues={onlyActivity} activity={activity} />
      )}
      {queueActivityFailure !== undefined && (
        <p className="text-destructive text-xs break-words">
          Actividad de la cola: {queueActivityFailure}
        </p>
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
      {count?.additionalInfo !== undefined &&
        count.additionalInfo.length > 0 && (
          <AdditionalInfo items={count.additionalInfo} />
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
  filtered,
  filterFailure,
  active,
  disabled,
  disabledReason,
  onEnter,
}: {
  row: Row
  estimated: boolean
  counters?: QueueActivityCounters
  /** La cuenta con el filtro de la mesa, si ya llegó. */
  filtered?: number
  /** Por qué falló el `count` filtrado de esta cola. */
  filterFailure?: string
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
          {filterFailure !== undefined && (
            <span
              className="text-destructive"
              title={`count con filtro: ${filterFailure}`}
            >
              <CircleAlertIcon className="size-3.5" aria-hidden />
              <span className="sr-only">count con filtro: {filterFailure}</span>
            </span>
          )}
          {filtered !== undefined && (
            <span
              className={cn(
                "text-base font-semibold",
                filtered === 0 && "text-muted-foreground font-normal"
              )}
              title="Con el filtro de la mesa (count con selection)"
            >
              {filtered}
            </span>
          )}
          <span
            className={cn(
              filtered === undefined
                ? "text-base font-semibold"
                : "text-muted-foreground text-xs",
              filtered === undefined &&
                row.count === 0 &&
                "text-muted-foreground font-normal"
            )}
          >
            {filtered === undefined ? row.count : `/ ${row.count}`}
          </span>
        </span>
      </span>
      <Activity counters={counters} />
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
function Activity({ counters }: { counters?: QueueActivityCounters }) {
  const shown =
    counters === undefined
      ? []
      : ACTIVITY_COUNTERS.filter(
          ({ key }) => key !== "numMessages" && counters[key] !== 0
        )
  if (counters === undefined || shown.length === 0) return null
  return (
    <span className="text-muted-foreground text-xs">
      {shown.map(({ key, words, label }, index) => (
        <span key={key} title={label}>
          {index > 0 && " · "}
          <span className="tabular-nums">{counters[key]}</span>{" "}
          {counters[key] === 1 ? words[0] : words[1]}
        </span>
      ))}
    </span>
  )
}

/**
 * Las colas que solo vienen en `activity` (F13.3): Sabre las lista porque tienen contadores,
 * pero el conteo no las trae porque no tienen PNR. Van aparte y sin acción; para entrar a una
 * igual, está «Otra cola».
 */
function OnlyActivity({
  queues,
  activity,
}: {
  queues: string[]
  activity: DeskActivity
}) {
  return (
    <div className="flex flex-col gap-1">
      <div
        className="text-muted-foreground px-2 text-xs"
        title="Colas que lista queue.activity y no están en queue.count"
      >
        Solo en actividad, sin PNR
      </div>
      <ul
        className="text-muted-foreground flex flex-col divide-y rounded-md border border-dashed"
        aria-label="Colas solo en actividad"
      >
        {queues.map((queue) => (
          <li key={queue} className="flex flex-col gap-0.5 px-2 py-1.5">
            <span className="font-mono">
              {queue === "S" ? "S · mensajes" : queue}
            </span>
            <Activity counters={activity.queues[queue]} />
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * El filtro de la mesa (F14.1): un botón con embudo en la cabecera de la columna, que abre el
 * editor de `selection` de F13.1 (compacto) y el alcance. Aplicar cuenta con `count` y
 * `selection` (uno por cola, en serie, con «Todas») y deja el filtro para `access` al entrar.
 * La consola no valida los filtros: el error de cada cola sale en su fila.
 */
export function DeskFilterButton({
  rows,
  onRowsChange,
  scope,
  onScopeChange,
  applied,
  pending,
  disabledReason,
  onApply,
  onClear,
}: {
  rows: SelectionRow[]
  onRowsChange: (rows: SelectionRow[]) => void
  scope: DeskFilterScope
  onScopeChange: (scope: DeskFilterScope) => void
  /** El filtro aplicado, si hay. */
  applied?: DeskFilter
  /** Si hay cuentas filtradas en curso. */
  pending: boolean
  disabledReason?: string
  onApply: () => void
  onClear: () => void
}) {
  const [open, setOpen] = useState(false)
  const label =
    applied === undefined
      ? "Filtrar (count con selection)"
      : `Filtro: ${filterText(applied)}`
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            size="icon-xs"
            variant={applied === undefined ? "ghost" : "secondary"}
            aria-label={label}
            title={label}
          />
        }
      >
        <FunnelIcon />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 gap-3">
        <PopoverHeader>
          <PopoverTitle>Filtro de colas</PopoverTitle>
          <PopoverDescription className="text-xs">
            <code>count</code> con <code>selection</code>, y <code>access</code>{" "}
            con el mismo filtro al entrar. Lo valida el SDK.
          </PopoverDescription>
        </PopoverHeader>
        <SelectionField
          id="desk-selection"
          value={rows}
          onChange={onRowsChange}
          hideLegend
        />
        <div className="flex flex-col gap-1">
          <div
            className="flex items-center gap-1"
            role="radiogroup"
            aria-label="Colas que se cuentan con el filtro"
          >
            {SCOPES.map((item) => (
              <Button
                key={item.value}
                type="button"
                size="xs"
                role="radio"
                aria-checked={scope === item.value}
                variant={scope === item.value ? "secondary" : "ghost"}
                onClick={() => onScopeChange(item.value)}
              >
                {item.label}
              </Button>
            ))}
          </div>
          <p className="text-muted-foreground text-xs">
            {scope === "all"
              ? "Un count por cada cola del conteo, en serie."
              : "Solo la cola en pantalla, al aplicar y al entrar."}
          </p>
        </div>
        <div className="flex items-center justify-end gap-2">
          {applied !== undefined && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                onClear()
                setOpen(false)
              }}
            >
              Quitar
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            disabled={pending || disabledReason !== undefined}
            title={disabledReason}
            onClick={() => {
              onApply()
              setOpen(false)
            }}
          >
            Aplicar
          </Button>
        </div>
        {disabledReason !== undefined && (
          <p className="text-muted-foreground text-xs">{disabledReason}</p>
        )}
      </PopoverContent>
    </Popover>
  )
}

const SCOPES: { value: DeskFilterScope; label: string }[] = [
  { value: "all", label: "Todas las colas" },
  { value: "screen", label: "Solo en pantalla" },
]

/** `QD-05NOV/AL-DL`, como en el host. */
function filterText(filter: DeskFilter): string {
  return filter.selection
    .map((row) => `${row.function}-${row.criteria}`)
    .join("/")
}

/** Una línea sobre la lista con el filtro aplicado, su alcance y cómo quitarlo. */
function FilterSummary({
  filter,
  pending,
  onClear,
}: {
  filter: DeskFilter
  pending: boolean
  onClear: () => void
}) {
  return (
    <div className="bg-muted/50 flex items-center gap-1.5 rounded-md px-2 py-1 text-xs">
      <FunnelIcon className="text-muted-foreground size-3 shrink-0" />
      <code className="min-w-0 truncate" title={filterText(filter)}>
        {filterText(filter)}
      </code>
      <span className="text-muted-foreground shrink-0">
        · {filter.scope === "all" ? "todas" : "en pantalla"}
      </span>
      {pending && <Spinner className="size-3 shrink-0" />}
      <Button
        type="button"
        size="icon-xs"
        variant="ghost"
        className="ms-auto size-5 shrink-0"
        aria-label="Quitar el filtro"
        title="Quitar el filtro"
        onClick={onClear}
      >
        <XIcon />
      </Button>
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
