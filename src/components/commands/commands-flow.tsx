"use client"

import { type KeyboardEvent, useRef, useState } from "react"
import { runCommand } from "@/app/(console)/commands/actions"
import { CommandLine } from "@/components/commands/command-line"
import {
  CommandType,
  HostCommandPanel,
} from "@/components/commands/host-command-panel"
import {
  type CommandEntry,
  CommandTranscript,
  ScreenResult,
} from "@/components/commands/host-screen"
import { SessionBar } from "@/components/session/session-bar"
import { CloseStep, OpenStep } from "@/components/session/session-flow"
import { useSessionStatus } from "@/components/session/use-session-status"
import { StepPanel } from "@/components/step/step-panel"
import { useStep } from "@/components/step/use-step"
import { Button } from "@/components/ui/button"
import { FieldDescription } from "@/components/ui/field"
import { nextPlaceholder, placeholders } from "@/lib/command-line"
import {
  commandToken,
  MAX_COMMAND_LENGTH,
  sabreCommandLength,
} from "@/lib/host-command-policy"
import type { HostCommand } from "@/lib/host-commands"

/**
 * Flujo 8: comandos de host con `session.command()`, dentro de la sesión registrada del
 * navegador (ADR-032). Sin sesión, el paso de abrirla queda arriba.
 *
 * La corrida (los comandos y sus pantallas) vive en el estado de este componente: no se
 * guarda al recargar, ni en el almacenamiento del navegador, ni en la URL, porque una
 * pantalla puede traer nombres, tarjetas y localizadores. Al historial de llamadas va la
 * respuesta cruda, como en el resto de los pasos, y como entrada solo el primer token del
 * comando (`*ABC123` → `*ABC`).
 */
export function CommandsFlow() {
  const { status, error, refresh } = useSessionStatus()
  const open = status?.open === true
  const done = () => void refresh()

  return (
    <>
      <SessionBar status={status} error={error} />
      {!open && <OpenStep open={open} onDone={done} />}
      <CommandConsole open={open} onDone={done} />
      {open && <CloseStep open={open} onDone={done} />}
    </>
  )
}

/** Lo que queda en el historial de llamadas: el comando cortado al primer token. */
const maskInput = (input: { command: string; confirmed?: boolean }) => ({
  ...input,
  command: commandToken(input.command),
})

function CommandConsole({
  open,
  onDone,
}: {
  open: boolean
  onDone: () => void
}) {
  const { run, pending, execute } = useStep(
    "session.command",
    runCommand,
    maskInput
  )
  const [command, setCommand] = useState("")
  const [entries, setEntries] = useState<CommandEntry[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  const sent = entries.map((entry) => entry.command)
  const text = command.trim()
  const tooLong = sabreCommandLength(text) > MAX_COMMAND_LENGTH
  const reason = !open
    ? "Abre la sesión primero."
    : text === ""
      ? undefined
      : tooLong
        ? `Pasa de ${MAX_COMMAND_LENGTH}: no se manda.`
        : undefined

  /** Selecciona `[start, end)` en la línea, después de que React pinte el valor nuevo. */
  const select = (start: number, end: number) =>
    requestAnimationFrame(() => {
      inputRef.current?.focus()
      inputRef.current?.setSelectionRange(start, end)
    })

  /** Un clic en el panel: la plantilla en la línea, con el primer marcador seleccionado. */
  const insert = (entry: HostCommand) => {
    setCommand(entry.template)
    const [first] = placeholders(entry.template)
    if (first === undefined)
      select(entry.template.length, entry.template.length)
    else select(first.start, first.end)
  }

  /** Tab y Shift+Tab saltan entre los marcadores que quedan; sin más, Tab sale de la línea. */
  const tab = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Tab") return
    const input = event.currentTarget
    const target = nextPlaceholder(
      command,
      input.selectionStart ?? 0,
      input.selectionEnd ?? 0,
      event.shiftKey ? -1 : 1
    )
    if (target === undefined) return
    event.preventDefault()
    input.setSelectionRange(target.start, target.end)
  }

  const send = (confirmed = false) => {
    if (text === "" || reason !== undefined) return
    const at = new Date().toISOString()
    execute({ command: text, confirmed }, (result) => {
      setEntries((current) => [
        ...current,
        { id: crypto.randomUUID(), command: text, at, run: result },
      ])
      onDone()
    })
    setCommand("")
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="flex min-w-0 flex-col gap-6">
        <StepPanel
          title="session.command"
          description={
            <>
              <code>SabreCommandLLSRQ</code> 2.0.0 en la sesión abierta. La
              pantalla llega sin recortar. Pega formatos de Sabre Red: el{" "}
              <code>‡</code> pasa a <code>¥</code>.
            </>
          }
          run={run}
          pending={pending}
          resultView={(result) => <ScreenResult result={result} />}
          form={
            <form
              className="flex flex-col gap-3"
              onSubmit={(event) => {
                event.preventDefault()
                send()
              }}
            >
              <CommandLine
                value={command}
                onChange={setCommand}
                sent={sent}
                inputRef={inputRef}
                disabled={!open}
                onKeyDown={tab}
                aside={<CommandType command={command} />}
              />
              <Button
                type="submit"
                disabled={pending || text === "" || reason !== undefined}
              >
                Mandar
              </Button>
              {reason !== undefined && (
                <FieldDescription>{reason}</FieldDescription>
              )}
            </form>
          }
        />
        <CommandTranscript entries={entries} onClear={() => setEntries([])} />
      </div>
      <HostCommandPanel onInsert={insert} />
    </div>
  )
}
