"use client"

import { createContext, type ReactNode, use, useState } from "react"
import type { StepRun } from "@/lib/step/types"

/** Una llamada de la sesión del navegador. */
export interface HistoryEntry {
  id: string
  /** Lo que muestra el historial como método: `booking.get`, `openSession + close`… */
  method: string
  /** ISO 8601, cuando se lanzó la llamada. */
  at: string
  /** Lo que se le pasó a la server action, sin el entorno. */
  input?: unknown
  run: StepRun
}

/**
 * Cuántas llamadas se guardan. Un BFM ocupa cientos de KB (resultado y crudo), así que el
 * historial se recorta para no crecer sin fin en la memoria del navegador.
 */
export const HISTORY_LIMIT = 50

interface HistoryContextValue {
  /** De la más nueva a la más vieja. */
  entries: HistoryEntry[]
  record: (entry: Omit<HistoryEntry, "id">) => void
  clear: () => void
}

const HistoryContext = createContext<HistoryContextValue | null>(null)

/**
 * El historial de llamadas de la consola. Vive solo en la memoria del navegador (regla 7 del
 * CLAUDE.md): nada en disco ni en `localStorage`. Se mantiene al navegar entre páginas porque
 * el provider está en el layout, y se vacía al recargar.
 */
export function HistoryProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<HistoryEntry[]>([])

  const record = (entry: Omit<HistoryEntry, "id">) =>
    setEntries((current) =>
      [{ ...entry, id: crypto.randomUUID() }, ...current].slice(
        0,
        HISTORY_LIMIT
      )
    )

  return (
    <HistoryContext value={{ entries, record, clear: () => setEntries([]) }}>
      {children}
    </HistoryContext>
  )
}

export function useHistory(): HistoryContextValue {
  const context = use(HistoryContext)
  if (context === null) {
    throw new Error("useHistory va dentro de <HistoryProvider>")
  }
  return context
}
