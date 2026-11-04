import "server-only"

import type { ConsoleEnvironmentId } from "@/lib/environment"
import type { StepRun } from "@/lib/step/types"
import { resolveEnvironment } from "@/server/config/environments"

/**
 * El esqueleto de la server action de un paso: valida el entorno que mandó el cliente (las
 * actions son endpoints públicos), corre `run` en ese entorno y marca el resultado con él.
 *
 * ```ts
 * export async function getBooking(environment: unknown, input: unknown) {
 *   return inEnvironment(environment, async (id) => { … })
 * }
 * ```
 */
export async function inEnvironment<T>(
  environment: unknown,
  run: (id: ConsoleEnvironmentId) => Promise<StepRun<T>>
): Promise<StepRun<T>> {
  const resolved = resolveEnvironment(environment)
  if (!resolved.ok) return { enabled: false, reason: resolved.reason }
  return { ...(await run(resolved.id)), environment: resolved.id }
}
