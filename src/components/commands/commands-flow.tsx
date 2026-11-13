"use client"

import { useRef, useState } from "react"
import { runCommand } from "@/app/(console)/commands/actions"
import { CommandLine } from "@/components/commands/command-line"
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
import {
  commandToken,
  MAX_COMMAND_LENGTH,
  sabreCommandLength,
} from "@/lib/host-command-policy"

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
    <>
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
    </>
  )
}
