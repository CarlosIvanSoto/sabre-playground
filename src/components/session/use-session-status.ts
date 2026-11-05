"use client"

import { useCallback, useEffect, useState } from "react"
import { sessionStatus } from "@/app/(console)/session/actions"
import { useEnvironment } from "@/components/environment/environment-provider"
import type { SessionStatus } from "@/lib/session"

/** Con la sesión abierta, cada cuánto se pregunta el estado (el ping de keepAlive no avisa). */
const POLL_MS = 30_000

/**
 * El estado de la sesión SOAP del navegador en el entorno elegido. Se pide al montar, al
 * cambiar de entorno, cada 30 s con la sesión abierta y cuando un paso llama a `refresh`.
 */
export function useSessionStatus() {
  const { environment } = useEnvironment()
  const [status, setStatus] = useState<SessionStatus>()
  const [error, setError] = useState<string>()

  const refresh = useCallback(async () => {
    const result = await sessionStatus(environment.id)
    if ("error" in result) {
      setError(result.error)
      setStatus(undefined)
    } else {
      setError(undefined)
      setStatus(result)
    }
  }, [environment.id])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const open = status?.open === true
  useEffect(() => {
    if (!open) return
    const timer = setInterval(() => void refresh(), POLL_MS)
    return () => clearInterval(timer)
  }, [open, refresh])

  return { status, error, refresh }
}
