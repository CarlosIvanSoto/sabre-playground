"use client"

import { Clock } from "lucide-react"
import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { SESSION_IDLE_LIMIT_MS } from "@/lib/session"

/**
 * El contador de inactividad: cuánto falta para los 15 minutos desde la última respuesta de
 * Sabre. Parte de `idleMs` (tomado en `at`) y sigue en el navegador. A partir de
 * `session-timer` de la v1.
 */
export function SessionTimer({ idleMs, at }: { idleMs: number; at: string }) {
  const lastResponse = Date.parse(at) - idleMs
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  const left = Math.max(0, SESSION_IDLE_LIMIT_MS - (now - lastResponse))
  const minutes = Math.floor(left / 60_000)
  const seconds = String(Math.floor((left / 1000) % 60)).padStart(2, "0")

  return (
    <Badge
      variant={left === 0 ? "destructive" : "outline"}
      className="font-mono tabular-nums"
      title="Tiempo hasta los 15 min de inactividad. Sabre la cierra entre los 16 y los 31."
    >
      <Clock />
      {left === 0 ? "15 min sin respuesta" : `${minutes}:${seconds}`}
    </Badge>
  )
}
