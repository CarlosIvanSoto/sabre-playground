"use client"

import { type ReactNode, useRef, useState } from "react"
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
import type { DeskDestination } from "@/lib/queue-desk"
import { instructionCode, parseQueueRef } from "@/lib/queues"

/**
 * Las escrituras de la mesa (F9.3): mover el PNR en pantalla a otra cola (`place` dentro de la
 * cola, que lo saca de la cola en curso y devuelve el siguiente) y sacarlo (`remove`). Cada
 * corrida se confirma en un popover que resume la operación y se acepta con Enter; no queda
 * nada recordado entre corridas. En producción, además, hace falta el desbloqueo.
 */

interface WriteProps {
  /** El PNR en pantalla. */
  locator?: string
  /** La cola en curso. */
  from: string
  /** Por qué no se puede correr ahora (sesión, cursor o producción sin desbloqueo). */
  reason?: string
  pending: boolean
}

/** Mover: cola de destino y PIC obligatorio, sin default (ADR-018). */
export function MoveControl({
  locator,
  from,
  reason,
  pending,
  recent,
  onConfirm,
}: WriteProps & {
  recent: DeskDestination[]
  onConfirm: (to: DeskDestination) => void
}) {
  const [queue, setQueue] = useState("")
  const [pic, setPic] = useState("")
  const ref = parseQueueRef(queue)
  const code = instructionCode.safeParse(pic)
  const sameQueue = ref !== undefined && String(ref) === from
  const invalid =
    queue.trim() === ""
      ? "Falta la cola de destino."
      : ref === undefined
        ? "Cola: 0–511 o un nombre."
        : sameQueue
          ? "El destino es la misma cola."
          : pic.trim() === ""
            ? "Falta el PIC: es obligatorio y no tiene default."
            : !code.success
              ? "PIC: 0–191 o 200–254."
              : undefined
  const to: DeskDestination | undefined =
    invalid === undefined && ref !== undefined && code.success
      ? {
          queue: typeof ref === "number" ? String(ref) : ref.name,
          instructionCode: String(code.data),
        }
      : undefined

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-[minmax(0,1fr)_4.5rem] gap-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="desk-move-queue" className="text-xs">
            Cola destino
          </Label>
          <Input
            id="desk-move-queue"
            className="h-8 font-mono uppercase"
            value={queue}
            onChange={(event) => setQueue(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="desk-move-pic" className="text-xs">
            PIC
          </Label>
          <Input
            id="desk-move-pic"
            inputMode="numeric"
            className="h-8 font-mono"
            value={pic}
            onChange={(event) => setPic(event.target.value)}
          />
        </div>
      </div>
      {recent.length > 0 && (
        <fieldset className="flex flex-wrap gap-1">
          <legend className="sr-only">Destinos recientes</legend>
          {recent.map((item) => (
            <Badge
              key={`${item.queue}-${item.instructionCode}`}
              variant="outline"
              className="cursor-pointer font-mono"
              render={
                <button
                  type="button"
                  onClick={() => {
                    setQueue(item.queue)
                    setPic(item.instructionCode)
                  }}
                />
              }
            >
              {item.queue} · PIC {item.instructionCode}
            </Badge>
          ))}
        </fieldset>
      )}
      <Confirm
        label="Mover"
        method="queue.place"
        disabled={pending || reason !== undefined || to === undefined}
        title={`Mover ${locator ?? "el PNR"}`}
        summary={
          to === undefined
            ? ""
            : `Mover ${locator ?? "el PNR"} de la ${from} a la ${to.queue}, PIC ${to.instructionCode}. Sale de la ${from} y la cola sigue con el siguiente.`
        }
        onConfirm={() => to !== undefined && onConfirm(to)}
      />
      <Reason>
        {reason ?? (queue !== "" || pic !== "" ? invalid : undefined)}
      </Reason>
    </div>
  )
}

/** Sacar: `remove` del PNR en pantalla de la cola en curso. */
export function RemoveControl({
  locator,
  from,
  reason,
  pending,
  onConfirm,
}: WriteProps & { onConfirm: () => void }) {
  return (
    <div className="flex flex-col gap-1">
      <Confirm
        label="Sacar de la cola"
        method="queue.remove"
        variant="outline"
        disabled={pending || reason !== undefined}
        title={`Sacar ${locator ?? "el PNR"}`}
        summary={`Sacar ${locator ?? "el PNR"} de la cola ${from}. La cola sigue con el siguiente.`}
        onConfirm={onConfirm}
      />
      <Reason>{reason}</Reason>
    </div>
  )
}

/** Un botón que abre un popover con el resumen; Enter (o el clic) confirma. */
function Confirm({
  label,
  method,
  variant = "default",
  disabled,
  title,
  summary,
  onConfirm,
}: {
  label: string
  method: string
  variant?: "default" | "outline"
  disabled: boolean
  title: string
  summary: string
  onConfirm: () => void
}) {
  const [open, setOpen] = useState(false)
  const confirm = useRef<HTMLButtonElement>(null)
  return (
    <Popover open={open && !disabled} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant={variant}
            disabled={disabled}
            className="justify-between"
          />
        }
      >
        {label}
        <code className="text-xs opacity-70">{method}</code>
      </PopoverTrigger>
      <PopoverContent side="left" align="start" initialFocus={confirm}>
        <PopoverHeader>
          <PopoverTitle>{title}</PopoverTitle>
          <PopoverDescription>{summary}</PopoverDescription>
        </PopoverHeader>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            ref={confirm}
            size="sm"
            variant="destructive"
            onClick={() => {
              setOpen(false)
              onConfirm()
            }}
          >
            Confirmar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function Reason({ children }: { children?: ReactNode }) {
  if (children === undefined || children === "") return null
  return <span className="text-muted-foreground text-xs">{children}</span>
}
