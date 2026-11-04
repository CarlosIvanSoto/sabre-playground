"use client"

import { EnvironmentBadge } from "@/components/environment/environment-badge"
import { useEnvironment } from "@/components/environment/environment-provider"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { ConsoleEnvironmentId } from "@/lib/environment"

/**
 * El indicador de entorno, siempre visible en la barra de la consola, y el selector para
 * cambiarlo. Los deshabilitados se ven con su razón y no se pueden elegir.
 */
export function EnvironmentSwitcher() {
  const { environment, options, setEnvironment } = useEnvironment()
  const items = options.map((option) => ({
    value: option.id,
    label: option.label,
  }))

  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground hidden text-sm sm:inline">
        Entorno
      </span>
      <Select
        items={items}
        value={environment.id}
        onValueChange={(value) => {
          if (value !== null) setEnvironment(value as ConsoleEnvironmentId)
        }}
      >
        <SelectTrigger size="sm" aria-label="Entorno de las llamadas">
          <SelectValue>
            {(value: ConsoleEnvironmentId) => (
              <EnvironmentBadge environment={value} />
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {options.map((option) => (
              <SelectItem
                key={option.id}
                value={option.id}
                disabled={!option.enabled}
              >
                <div className="flex flex-col">
                  <span>{option.label}</span>
                  {option.reason !== undefined && (
                    <span className="text-muted-foreground text-xs">
                      {option.reason}
                    </span>
                  )}
                  {option.readOnly && option.enabled && (
                    <span className="text-muted-foreground text-xs">
                      solo lectura
                    </span>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      {environment.readOnly && (
        <span className="text-destructive text-xs">solo lectura</span>
      )}
    </div>
  )
}
