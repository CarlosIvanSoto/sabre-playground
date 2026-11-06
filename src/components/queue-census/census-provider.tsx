"use client"

import { createContext, type ReactNode, use, useReducer } from "react"
import { useEnvironment } from "@/components/environment/environment-provider"
import type { ConsoleEnvironmentId } from "@/lib/environment"
import {
  initialQueueCensus,
  type QueueCensus,
  type QueueCensusAction,
  queueCensusReducer,
} from "@/lib/queue-census"

type Censuses = Partial<Record<ConsoleEnvironmentId, QueueCensus>>

interface CensusContextValue {
  /** El censo del entorno elegido. */
  census: QueueCensus
  dispatch: (action: QueueCensusAction) => void
}

const CensusContext = createContext<CensusContextValue | null>(null)

function reducer(
  state: Censuses,
  {
    environment,
    action,
  }: { environment: ConsoleEnvironmentId; action: QueueCensusAction }
): Censuses {
  const current = state[environment] ?? initialQueueCensus()
  const next = queueCensusReducer(current, action)
  return next === current ? state : { ...state, [environment]: next }
}

/**
 * El censo en curso (F10.5, #99), uno por entorno, en la memoria del navegador (regla 7): nada
 * en disco ni en `localStorage`. Está en el layout para que la mesa de colas le sume PNR con
 * "Al censo" y `/queue-census` lo muestre y lo exporte. Se pierde al recargar.
 */
export function CensusProvider({ children }: { children: ReactNode }) {
  const { environment } = useEnvironment()
  const [censuses, send] = useReducer(reducer, {})
  const census = censuses[environment.id] ?? initialQueueCensus()
  const dispatch = (action: QueueCensusAction) =>
    send({ environment: environment.id, action })
  return <CensusContext value={{ census, dispatch }}>{children}</CensusContext>
}

export function useCensus(): CensusContextValue {
  const context = use(CensusContext)
  if (context === null) {
    throw new Error("useCensus va dentro de <CensusProvider>")
  }
  return context
}
