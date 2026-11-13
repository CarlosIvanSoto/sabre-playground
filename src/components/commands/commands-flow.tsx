"use client"

import { useState } from "react"
import { runCommand } from "@/app/(console)/commands/actions"
import { SessionBar } from "@/components/session/session-bar"
import { CloseStep, OpenStep } from "@/components/session/session-flow"
import { useSessionStatus } from "@/components/session/use-session-status"
import { StepPanel } from "@/components/step/step-panel"
import { useStep } from "@/components/step/use-step"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

/**
 * Flujo 8: comandos de host con `session.command()`, dentro de la sesión registrada del
 * navegador (ADR-032). Sin sesión, el paso de abrirla queda arriba.
 */
export function CommandsFlow() {
  const { status, error, refresh } = useSessionStatus()
  const open = status?.open === true
  const done = () => void refresh()

  return (
    <>
      <SessionBar status={status} error={error} />
      {!open && <OpenStep open={open} onDone={done} />}
      <CommandStep open={open} onDone={done} />
      {open && <CloseStep open={open} onDone={done} />}
    </>
  )
}

function CommandStep({ open, onDone }: { open: boolean; onDone: () => void }) {
  const { run, pending, execute } = useStep("session.command", runCommand)
  const [command, setCommand] = useState("")

  return (
    <StepPanel
      title="session.command"
      description={
        <>
          <code>SabreCommandLLSRQ</code> 2.0.0 en la sesión abierta. La pantalla
          llega sin recortar.
        </>
      }
      run={run}
      pending={pending}
      resultView={(result) => <Screen result={result} />}
      form={
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            execute({ command }, onDone)
          }}
        >
          <Field>
            <FieldLabel htmlFor="command-line">Comando</FieldLabel>
            <Input
              id="command-line"
              className="font-mono"
              autoComplete="off"
              spellCheck={false}
              value={command}
              onChange={(event) => setCommand(event.target.value)}
            />
          </Field>
          <Button type="submit" disabled={pending || !open}>
            Mandar
          </Button>
        </form>
      }
    />
  )
}

/** La pantalla del host, sin recortar y en monoespaciado. */
function Screen({ result }: { result: unknown }) {
  const text =
    typeof result === "object" && result !== null && "text" in result
      ? String(result.text)
      : ""
  return (
    <pre className="bg-muted overflow-x-auto rounded-md p-3 font-mono text-xs leading-snug">
      {text}
    </pre>
  )
}
