"use client"

import React, { useEffect, useState } from "react"
import { Clock } from "lucide-react"

interface SessionTimerProps {
  expiresAt: number
}

export function SessionTimer({ expiresAt }: SessionTimerProps) {
  const [timeLeft, setTimeLeft] = useState<number>(0)
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
    const interval = setInterval(() => {
      const now = Date.now()
      const remaining = Math.max(0, expiresAt - now)
      setTimeLeft(remaining)

      if (remaining <= 0) {
        clearInterval(interval)
      }
    }, 1000)

    // Initial calculation
    const now = Date.now()
    const remaining = Math.max(0, expiresAt - now)
    setTimeLeft(remaining)

    return () => clearInterval(interval)
  }, [expiresAt])

  if (!isClient) {
    return null
  }

  const minutes = Math.floor(timeLeft / 1000 / 60)
  const seconds = Math.floor((timeLeft / 1000) % 60)
  const formattedSeconds = seconds < 10 ? `0${seconds}` : seconds

  if (timeLeft <= 0) {
    return (
      <div className="flex items-center gap-2 text-red-500 font-medium">
        <Clock className="h-4 w-4" />
        <span>Session Expired</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center p-3 rounded-lg bg-zinc-900/80 border border-zinc-800 text-sm">
      <span className="text-zinc-400 text-xs uppercase tracking-wider mb-1">Session Expires In</span>
      <div className="flex items-center gap-2 text-emerald-400 font-mono text-xl font-bold">
        <Clock className="h-4 w-4" />
        <span>{minutes}:{formattedSeconds}</span>
      </div>
    </div>
  )
}
