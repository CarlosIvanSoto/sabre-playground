"use client"

import type { KeyboardEvent, ReactNode, RefObject } from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { insertAt, NO_RECALL, type Recall, recall } from "@/lib/command-line"
import {
  MAX_COMMAND_LENGTH,
  sabreCommandLength,
  toHostSeparator,
} from "@/lib/host-command-policy"

/**
 * La línea de comando (F15.2): `‡` pasa a `¥` al escribir o pegar, un botón inserta `¥`, el
 * contador sigue la regla de Sabre y ↑ / ↓ recorren los comandos de la corrida. Enter manda.
 */
export function CommandLine({
  value,
  onChange,
  sent,
  inputRef,
  disabled,
  onKeyDown,
  aside,
}: {
  value: string
  onChange: (value: string) => void
  /** Los comandos mandados en la corrida, del más viejo al más nuevo. */
  sent: readonly string[]
  inputRef: RefObject<HTMLInputElement | null>
  disabled?: boolean
  /** Teclas que el flujo maneja antes que la línea (Tab en los marcadores). */
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void
  /** Lo que va junto al contador: el tipo del comando escrito. */
  aside?: ReactNode
}) {
  const [state, setState] = useState<Recall>(NO_RECALL)
  const length = sabreCommandLength(value)
  const over = length > MAX_COMMAND_LENGTH

  const change = (next: string) => {
    setState(NO_RECALL)
    onChange(next)
  }

  const insertYen = () => {
    const input = inputRef.current
    const start = input?.selectionStart ?? value.length
    const end = input?.selectionEnd ?? value.length
    const next = insertAt(value, start, end, "¥")
    change(next.value)
    requestAnimationFrame(() => {
      input?.focus()
      input?.setSelectionRange(next.caret, next.caret)
    })
  }

  const keyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(event)
    if (event.defaultPrevented) return
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return
    const moved = recall(sent, state, value, event.key === "ArrowUp" ? -1 : 1)
    if (moved === undefined) return
    event.preventDefault()
    setState(moved.state)
    onChange(moved.value)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-2">
        <Input
          ref={inputRef}
          id="command-line"
          aria-label="Comando"
          aria-invalid={over || undefined}
          className="font-mono"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          value={value}
          onKeyDown={keyDown}
          onChange={(event) => {
            const input = event.target
            const raw = input.value
            const next = toHostSeparator(raw)
            if (next !== raw) {
              // `‡` y `¥` miden lo mismo: el cursor queda donde estaba.
              const start = input.selectionStart
              const end = input.selectionEnd
              input.value = next
              if (start !== null && end !== null) {
                input.setSelectionRange(start, end)
              }
            }
            change(next)
          }}
        />
        <Button
          type="button"
          variant="outline"
          className="font-mono"
          title="Insertar ¥ (el separador de la API; en Sabre Red es ‡)"
          disabled={disabled}
          onClick={insertYen}
        >
          ¥
        </Button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="flex items-center gap-2">{aside}</span>
        <span
          className={
            over
              ? "text-destructive font-mono"
              : "text-muted-foreground font-mono"
          }
          title="!, %, $, &, ¥ y § cuentan 2"
        >
          {length}/{MAX_COMMAND_LENGTH}
        </span>
      </div>
    </div>
  )
}
