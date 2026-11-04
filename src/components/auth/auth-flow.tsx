"use client"

import { invalidateToken, requestToken } from "@/app/(console)/auth/actions"
import { StepPanel } from "@/components/step/step-panel"
import { useStep } from "@/components/step/use-step"
import { Button } from "@/components/ui/button"
import { PROBE_LOCATOR } from "@/lib/auth"

/**
 * Flujo 1: pedir el token y ver de dónde salió, e invalidarlo para ver el refresco reactivo
 * ante un 401. El SDK no expone el token: se ve por el log y por el `tokenStore`.
 */
export function AuthFlow() {
  const token = useStep<void>("auth.token", (environment) =>
    requestToken(environment)
  )
  const invalidate = useStep<void>("auth.invalidate", (environment) =>
    invalidateToken(environment)
  )

  return (
    <>
      <StepPanel
        title="auth.token"
        description={
          <>
            Hace que el SDK use el token con un <code>booking.get</code> de{" "}
            <code>{PROBE_LOCATOR}</code>, que no existe. Muestra la versión, el
            vencimiento y si el token salió nuevo, del archivo o de memoria.
          </>
        }
        run={token.run}
        pending={token.pending}
        form={
          <Button disabled={token.pending} onClick={() => token.execute()}>
            Correr
          </Button>
        }
      />
      <StepPanel
        title="auth.invalidate"
        description={
          <>
            Descarta el cliente REST, con su token en memoria, y deja en{" "}
            <code>.sabre-token.json</code> un token que Sabre rechaza. Después
            corre <code>auth.token</code>: el log muestra el 401, el refresco
            con <code>reason: reactive</code> y el reintento.
          </>
        }
        run={invalidate.run}
        pending={invalidate.pending}
        form={
          <Button
            variant="destructive"
            disabled={invalidate.pending}
            onClick={() => invalidate.execute()}
          >
            Invalidar token
          </Button>
        }
      />
    </>
  )
}
