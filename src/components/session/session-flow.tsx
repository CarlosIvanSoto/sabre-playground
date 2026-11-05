"use client"

import { useState } from "react"
import {
  closeSession,
  expireFakeSessions,
  openSession,
  pingSession,
} from "@/app/(console)/session/actions"
import { useEnvironment } from "@/components/environment/environment-provider"
import { SessionBar } from "@/components/session/session-bar"
import { useSessionStatus } from "@/components/session/use-session-status"
import { StepPanel } from "@/components/step/step-panel"
import { useStep } from "@/components/step/use-step"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"

/**
 * Flujo 5: abrir, hacer ping y cerrar la sesión SOAP del entorno. La sesión vive en el
 * registro del servidor; el estado de arriba se actualiza después de cada paso.
 */
export function SessionFlow() {
  const { environment } = useEnvironment()
  const { status, error, refresh } = useSessionStatus()
  const open = status?.open === true
  const done = () => void refresh()

  return (
    <>
      <SessionBar status={status} error={error} />
      <OpenStep open={open} onDone={done} />
      <PingStep open={open} onDone={done} />
      <CloseStep open={open} onDone={done} />
      {environment.id === "fake" && <ExpireStep open={open} onDone={done} />}
    </>
  )
}

export interface StepProps {
  open: boolean
  onDone: () => void
}

export function OpenStep({ open, onDone }: StepProps) {
  const { run, pending, execute } = useStep("legacy.openSession", openSession)
  const [keepAlive, setKeepAlive] = useState(false)

  return (
    <StepPanel
      title="legacy.openSession"
      description={
        <>
          <code>SessionCreateRQ</code>: 2.0.0 con <code>clientId</code> y{" "}
          <code>clientSecret</code>, 1.0.0 sin ellos. Una por entorno y por
          navegador; el límite es de 50 por PCC.
        </>
      }
      run={run}
      pending={pending}
      form={
        <form
          onSubmit={(event) => {
            event.preventDefault()
            execute({ keepAlive }, onDone)
          }}
          className="flex flex-col gap-4"
        >
          <Field orientation="horizontal">
            <Checkbox
              id="session-keepAlive"
              checked={keepAlive}
              onCheckedChange={(checked) => setKeepAlive(checked === true)}
            />
            <FieldLabel htmlFor="session-keepAlive">keepAlive</FieldLabel>
          </Field>
          <FieldDescription>
            Con <code>keepAlive</code>, el SDK manda un ping a los 13 min de
            inactividad. Si falla, emite{" "}
            <code>sabre.session.keepAliveFailed</code> y se apaga. Ese log sale
            en la consola del servidor, no en un paso.
          </FieldDescription>
          <Button type="submit" disabled={pending || open}>
            Abrir sesión
          </Button>
        </form>
      }
    />
  )
}

function PingStep({ open, onDone }: StepProps) {
  const { run, pending, execute } = useStep("session.ping", pingSession)
  return (
    <StepPanel
      title="session.ping"
      description={
        <>
          <code>OTA_PingRQ</code>: reinicia el contador sin tocar el AAA. Una
          sesión vencida da <code>SabreSessionError</code> <code>expired</code>{" "}
          y sale del registro.
        </>
      }
      run={run}
      pending={pending}
      form={
        <Button
          className="w-full"
          disabled={pending || !open}
          onClick={() => execute({}, onDone)}
        >
          Ping
        </Button>
      }
    />
  )
}

export function CloseStep({ open, onDone }: StepProps) {
  const { run, pending, execute } = useStep("session.close", closeSession)
  return (
    <StepPanel
      title="session.close"
      description={
        <>
          <code>SessionCloseRQ</code>: Sabre descarta el AAA. La sesión sale del
          registro aunque el cierre falle; en Sabre vence sola.
        </>
      }
      run={run}
      pending={pending}
      form={
        <Button
          variant="outline"
          className="w-full"
          disabled={pending || !open}
          onClick={() => execute({}, onDone)}
        >
          Cerrar sesión
        </Button>
      }
    />
  )
}

/** Solo en fake: vencer la sesión para ver cómo sale del registro en el siguiente uso. */
function ExpireStep({ open, onDone }: StepProps) {
  const { run, pending, execute } = useStep(
    "fake.expireSessions",
    expireFakeSessions
  )
  return (
    <StepPanel
      title="fake.expireSessions"
      description={
        <>
          Solo en fake (<code>sabre-client/testing</code>). Vence las sesiones
          del fake: el siguiente ping da <code>SabreSessionError</code>{" "}
          <code>expired</code> y la sesión sale del registro.
        </>
      }
      run={run}
      pending={pending}
      form={
        <Button
          variant="outline"
          className="w-full"
          disabled={pending || !open}
          onClick={() => execute({}, onDone)}
        >
          Vencer la sesión
        </Button>
      }
    />
  )
}
