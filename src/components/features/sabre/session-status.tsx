"use client"

import React, { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Clock, CopyIcon, FileCodeIcon, LogOut, RefreshCw } from "lucide-react"
import { motion } from "framer-motion"
import { toast } from "sonner"
import { closeSession, refreshSession } from "@/services/sabre/auth/actions"
import { useRouter } from "next/navigation"
import { Separator } from "@/components/ui/separator"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupText, InputGroupTextarea } from "@/components/ui/input-group"

interface SessionStatusProps {
  token?: string
  expiresAt?: number
}

export function SessionStatus({ token, expiresAt }: SessionStatusProps) {
  const router = useRouter()
  const [timeLeft, setTimeLeft] = useState<number>(0)
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
    if (!expiresAt) return

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

  const handleLogout = async () => {
    try {
      await closeSession()
      toast.success("Session closed successfully")
      router.refresh()
    } catch (e) {
      toast.error("Failed to close session")
    }
  }

  const handleRefresh = async () => {
    try {
      await refreshSession()
      toast.success("Session refreshed successfully")
      router.refresh()
    } catch (e) {
      toast.error("Failed to refresh session")
    }
  }

  const handleCopyToken = () => {
    navigator.clipboard.writeText(token || "")
    toast.success("Token copied to clipboard")
  }

  const minutes = Math.floor(timeLeft / 1000 / 60)
  const seconds = Math.floor((timeLeft / 1000) % 60)
  const formattedSeconds = seconds < 10 ? `0${seconds}` : seconds

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex mt-4 items-center gap-4 bg-zinc-900/50 border border-emerald-500/20 px-4 py-2 rounded-full backdrop-blur-sm"
    >
      {isClient && expiresAt && timeLeft > 0 && (
        <>
          <div className="flex items-center gap-2 text-emerald-400 font-mono text-sm">
            <Clock className="h-4 w-4" />
            <span>{minutes}:{formattedSeconds}</span>
          </div>
          <div className="h-4 w-px bg-zinc-700" />
        </>
      )}

      <HoverCard openDelay={10} closeDelay={100}>
        <HoverCardTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 hover:bg-blue-500/10 hover:text-blue-400 text-zinc-400 transition-colors" asChild>
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
            </div>
          </Button>
        </HoverCardTrigger>
        <HoverCardContent className="flex w-fit flex-col gap-4">
          <div className="flex justify-between items-center">
            <div className="font-semibold">Sabre Legacy</div>
            <span className="text-sm font-medium text-emerald-400">Session Active</span>
          </div>
          <InputGroup>
            <InputGroupTextarea
              id="block-start-textarea"
              readOnly
              value={token}
              className="font-mono text-sm w-64"
            />
            <InputGroupAddon align="block-start">
              <FileCodeIcon className="text-muted-foreground" />
              <InputGroupText className="font-mono">session token</InputGroupText>
              <InputGroupButton size="icon-xs" className="ml-auto" onClick={handleCopyToken}>
                <CopyIcon />
                <span className="sr-only">Copy</span>
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </HoverCardContent>
      </HoverCard>

      <div className="h-4 w-px bg-zinc-700" />

      <Button
        variant="ghost"
        size="sm"
        onClick={handleRefresh}
        className="h-8 hover:bg-blue-500/10 hover:text-blue-400 text-zinc-400 transition-colors"
      >
        <RefreshCw />
      </Button>

      <div className="h-4 w-px bg-zinc-700" />
      {/* <Separator orientation="vertical" className="h-4 w-px bg-zinc-700" /> */}

      <Button
        variant="ghost"
        size="sm"
        onClick={handleLogout}
        className="h-8 hover:bg-red-500/10 hover:text-red-400 text-zinc-400 transition-colors"
      >
        <LogOut />
      </Button>
    </motion.div>
  )
}
