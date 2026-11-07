"use client"

import { BanIcon, KeyRoundIcon } from "lucide-react"
import { usePathname } from "next/navigation"
import type { ReactNode } from "react"
import { useEnvironment } from "@/components/environment/environment-provider"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { flowOfPath, flowUnavailable } from "@/lib/flows"

/**
 * El contenido de la consola según el entorno elegido (F5.2, #22):
 *
 * - Sin ningún entorno real habilitado (por ejemplo, sin `.env`), un aviso en la portada
 *   con la razón de cada uno: solo quedan el modo fake y el parser. El selector de entorno
 *   también muestra la razón.
 * - Si el flujo de la ruta no corre en el entorno elegido (REST en fake), el flujo se ve, pero
 *   deshabilitado y con la razón. Las server actions lo rechazan igual.
 */
export function FlowGate({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const { environment, options } = useEnvironment()
  const flow = flowOfPath(pathname)
  const reason =
    flow === undefined ? undefined : flowUnavailable(flow, environment)
  const real = options.filter((option) => option.id !== "fake")
  const noCredentials =
    pathname === "/" && real.every((option) => !option.enabled)

  return (
    <>
      {noCredentials && (
        <Alert>
          <KeyRoundIcon />
          <AlertTitle>Sin credenciales: solo modo fake y parser</AlertTitle>
          <AlertDescription>
            <ul className="list-inside list-disc">
              {real.map((option) => (
                <li key={option.id}>
                  {option.label}: {option.reason ?? "deshabilitado"}
                </li>
              ))}
            </ul>
            <span>
              Corren las colas y la sesión contra el fake de{" "}
              <code>sabre-client/testing</code>, y el parser del párrafo de
              cola. Para CERT, copia <code>.env.example</code> a{" "}
              <code>.env</code> y reinicia.
            </span>
          </AlertDescription>
        </Alert>
      )}
      {reason === undefined ? (
        children
      ) : (
        <>
          <Alert variant="destructive">
            <BanIcon />
            <AlertTitle>No corre en {environment.label}</AlertTitle>
            <AlertDescription>{reason}</AlertDescription>
          </Alert>
          <fieldset
            disabled
            aria-label={`Deshabilitado en ${environment.label}`}
            className="flex min-w-0 flex-col gap-6 opacity-60"
          >
            {children}
          </fieldset>
        </>
      )}
    </>
  )
}
