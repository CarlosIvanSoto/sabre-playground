/**
 * Valida la configuración por entorno al arrancar el servidor y deja un resumen en consola,
 * con nombres de variables y nunca con sus valores. Nada falla: lo que falta queda deshabilitado.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return

  const { getEnvironmentSummary } = await import("@/server/config/environments")
  for (const environment of getEnvironmentSummary()) {
    const mode = environment.readOnly ? " (solo lectura)" : ""
    const detail = environment.enabled
      ? "habilitado (REST y SOAP)"
      : `deshabilitado: ${environment.reason}`
    console.info(`[sabre-playground] ${environment.label}${mode}: ${detail}`)
  }
}
