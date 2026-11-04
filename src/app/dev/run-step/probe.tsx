"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { probeToken, type TokenProbe } from "./actions"

export function Probe() {
  const [probe, setProbe] = useState<TokenProbe>()
  const [pending, startTransition] = useTransition()

  return (
    <div className="mt-6 space-y-4">
      <Button
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setProbe(await probeToken())
          })
        }
      >
        {pending ? "Llamando…" : "Correr booking.get"}
      </Button>
      {probe !== undefined && (
        <pre className="bg-muted overflow-auto rounded-md p-4 text-xs">
          {JSON.stringify(probe, null, 2)}
        </pre>
      )}
    </div>
  )
}
