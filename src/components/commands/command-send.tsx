"use client"

import { useRef } from "react"
import { TypeBadge } from "@/components/commands/host-command-panel"
import { Button } from "@/components/ui/button"
import { FieldDescription } from "@/components/ui/field"
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import type { CommandVerdict } from "@/lib/host-command-policy"

/**
 * El botón de mandar con las reglas por entorno del ADR-032 (F15.4), las mismas que aplica la
 * server action (`gateCommand`):
 *
 * - `blocked` (emisión, o en producción lo que no es lectura del panel): deshabilitado, con
 *   la razón.
 * - `confirm` (en CERT, escritura, emisión o un comando fuera del panel): abre un popover con
 *   el comando y su tipo; Enter o el clic confirma esa corrida. Nada queda recordado.
 * - `allowed`: manda.
 *
 * Enter en la línea hace lo mismo que el botón: con `confirm`, abre el popover.
 */
export function CommandSend({
  command,
  verdict,
  reason,
  pending,
  confirming,
  onConfirmingChange,
  onSend,
}: {
  command: string
  verdict?: CommandVerdict
  /** Por qué no se puede mandar ahora, aparte de las reglas (sesión, marcadores). */
  reason?: string
  pending: boolean
  /** El popover de confirmación está abierto. */
  confirming: boolean
  onConfirmingChange: (open: boolean) => void
  onSend: (confirmed: boolean) => void
}) {
  const confirm = useRef<HTMLButtonElement>(null)
  const why =
    reason ??
    (verdict?.kind === "blocked" || verdict?.kind === "invalid"
      ? verdict.reason
      : undefined)
  const disabled = pending || verdict === undefined || why !== undefined

  if (verdict?.kind !== "confirm" || disabled) {
    return (
      <>
        <Button type="submit" disabled={disabled}>
          Mandar
        </Button>
        {why !== undefined &&
          (command.trim() !== "" || reason !== undefined) && (
            <FieldDescription
              className={
                verdict?.kind === "blocked" ? "text-destructive" : undefined
              }
            >
              {why}
            </FieldDescription>
          )}
      </>
    )
  }

  return (
    <>
      <Popover open={confirming} onOpenChange={onConfirmingChange}>
        <PopoverTrigger render={<Button type="button" />}>
          Mandar…
        </PopoverTrigger>
        <PopoverContent side="bottom" align="start" initialFocus={confirm}>
          <PopoverHeader>
            <PopoverTitle>Confirmar el comando</PopoverTitle>
            <PopoverDescription>{verdict.reason}</PopoverDescription>
          </PopoverHeader>
          <div className="flex flex-wrap items-center gap-2">
            <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-sm break-all">
              {command.trim()}
            </code>
            {verdict.entry === undefined ? (
              <span className="text-muted-foreground text-xs">
                fuera del panel
              </span>
            ) : (
              <TypeBadge type={verdict.entry.type} />
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onConfirmingChange(false)}
            >
              Cancelar
            </Button>
            <Button
              ref={confirm}
              size="sm"
              variant="destructive"
              onClick={() => {
                onConfirmingChange(false)
                onSend(true)
              }}
            >
              Confirmar
            </Button>
          </div>
        </PopoverContent>
      </Popover>
      <FieldDescription>Pide confirmación: {verdict.reason}</FieldDescription>
    </>
  )
}
