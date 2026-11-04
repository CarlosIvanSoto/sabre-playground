"use client"

import { createContext, type ReactNode, use, useState } from "react"
import {
  type ConsoleEnvironmentId,
  DEFAULT_CONSOLE_ENVIRONMENT,
  type EnvironmentOption,
} from "@/lib/environment"

interface EnvironmentContextValue {
  /** El entorno de la siguiente llamada. */
  environment: EnvironmentOption
  options: EnvironmentOption[]
  setEnvironment: (id: ConsoleEnvironmentId) => void
}

const EnvironmentContext = createContext<EnvironmentContextValue | null>(null)

/**
 * El entorno elegido en la consola. Vive en la memoria del navegador: al recargar vuelve a
 * CERT (o al primero habilitado), nunca queda en producción por accidente. `options` llega
 * del servidor, sin credenciales.
 */
export function EnvironmentProvider({
  options,
  children,
}: {
  options: EnvironmentOption[]
  children: ReactNode
}) {
  const initial =
    options.find((o) => o.id === DEFAULT_CONSOLE_ENVIRONMENT && o.enabled) ??
    options.find((o) => o.enabled) ??
    options[0]
  const [id, setId] = useState<ConsoleEnvironmentId>(initial.id)
  const environment = options.find((o) => o.id === id) ?? initial

  return (
    <EnvironmentContext value={{ environment, options, setEnvironment: setId }}>
      {children}
    </EnvironmentContext>
  )
}

export function useEnvironment(): EnvironmentContextValue {
  const context = use(EnvironmentContext)
  if (context === null) {
    throw new Error("useEnvironment va dentro de <EnvironmentProvider>")
  }
  return context
}
