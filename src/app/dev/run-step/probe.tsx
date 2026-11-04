"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { type ProbeResult, probeEnvironment } from "./actions"

export function Probe() {
  const [probe, setProbe] = useState<ProbeResult>()
  const [pending, startTransition] = useTransition()

  return (
    <div className="mt-6 space-y-4">
      <Button
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setProbe(await probeEnvironment())
          })
        }
      >
        {pending ? "Llamando…" : "Correr la prueba"}
      </Button>
      {probe !== undefined && (
        <pre className="bg-muted overflow-auto rounded-md p-4 text-xs">
          {JSON.stringify(probe, null, 2)}
        </pre>
      )}
    </div>
  )
}
