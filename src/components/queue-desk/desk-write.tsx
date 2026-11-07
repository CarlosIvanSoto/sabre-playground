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
import { type DeskDestination, workingPcc } from "@/lib/queue-desk"
import {
  formatQueueRef,
  instructionCode,
  PCC_PATTERN,
  parseQueueRef,
} from "@/lib/queues"

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

/**
 * Mover: cola de destino, PCC y PIC obligatorio, sin default (ADR-018). El PCC vacío es el de
 * trabajo (F9.6): el placeholder lo muestra.
 */
export function MoveControl({
  locator,
  from,
  reason,
  pending,
  recent,
  pcc,
  sessionPcc,
  onConfirm,
}: WriteProps & {
  recent: DeskDestination[]
  /** El PCC de trabajo; vacío es el de la sesión. */
  pcc: string
  /** El PCC de la sesión, para mostrarlo y normalizar. */
  sessionPcc: string
  onConfirm: (to: DeskDestination) => void
}) {
  const [queue, setQueue] = useState("")
  const [pccText, setPccText] = useState("")
  const [pic, setPic] = useState("")
  const ref = parseQueueRef(queue)
  const code = instructionCode.safeParse(pic)
  const typedPcc = pccText.trim().toUpperCase()
  const toPcc = typedPcc === "" ? pcc : workingPcc(typedPcc, sessionPcc)
  const sameQueue = ref !== undefined && String(ref) === from && toPcc === pcc
  const invalid =
    queue.trim() === ""
      ? "Falta la cola de destino."
      : ref === undefined
        ? "Cola: 0–511 o un nombre."
        : typedPcc !== "" && !PCC_PATTERN.test(typedPcc)
          ? "PCC: 3 o 4 letras o dígitos."
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
          queue: formatQueueRef(ref),
          pcc: toPcc,
          instructionCode: String(code.data),
        }
      : undefined
  const shown = (value: string) => (value === "" ? sessionPcc : value)
  const elsewhere = to !== undefined && to.pcc !== pcc

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-[minmax(0,1fr)_4rem_3.5rem] gap-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="desk-move-queue" className="text-xs">
            <kbd className="font-mono opacity-70">M</kbd> Cola destino
          </Label>
          <Input
            id="desk-move-queue"
            className="h-8 font-mono uppercase"
            value={queue}
            onChange={(event) => setQueue(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="desk-move-pcc" className="text-xs">
            PCC
          </Label>
          <Input
            id="desk-move-pcc"
            className="h-8 font-mono uppercase"
            maxLength={4}
            placeholder={shown(pcc)}
            title="Vacío: el PCC de trabajo"
            value={pccText}
            onChange={(event) => setPccText(event.target.value)}
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
              key={`${item.queue}-${item.pcc}-${item.instructionCode}`}
              variant="outline"
              className="cursor-pointer font-mono"
              render={
                <button
                  type="button"
                  onClick={() => {
                    setQueue(item.queue)
                    setPccText(item.pcc === pcc ? "" : shown(item.pcc))
                    setPic(item.instructionCode)
                  }}
                />
              }
            >
              {item.queue}
              {item.pcc !== pcc && ` · ${shown(item.pcc)}`} · PIC{" "}
              {item.instructionCode}
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
            : `Mover ${locator ?? "el PNR"} de la ${from} a la ${to.queue}${elsewhere ? ` de ${shown(to.pcc)}` : ""}, PIC ${to.instructionCode}. Sale de la ${from} y la cola sigue con el siguiente.`
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
        shortcut="r"
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

/**
 * Un botón que abre un popover con el resumen; Enter (o el clic) confirma. Lo usan mover,
 * sacar y cancelar la reserva desde la hoja.
 */
export function Confirm({
  label,
  method,
  variant = "default",
  side = "left",
  shortcut,
  disabled,
  title,
  summary,
  onConfirm,
}: {
  label: string
  method: string
  variant?: "default" | "outline" | "destructive"
  /** Hacia dónde abre el popover. */
  side?: "left" | "bottom" | "top"
  /** La tecla del atajo de la mesa, en minúscula: abre el popover, no confirma. */
  shortcut?: string
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
            data-desk-key={shortcut}
          />
        }
      >
        <span>
          {shortcut !== undefined && (
            <kbd className="me-1.5 font-mono text-xs opacity-70">
              {shortcut.toUpperCase()}
            </kbd>
          )}
          {label}
        </span>
        <code className="text-xs opacity-70">{method}</code>
      </PopoverTrigger>
      <PopoverContent side={side} align="start" initialFocus={confirm}>
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
