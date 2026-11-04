import "server-only"

import type { SabreConfig, SabreEnvironment } from "sabre-client"
import { z } from "zod"

/**
 * Configuración por entorno, leída de `process.env` (`.env.local`).
 *
 * - CERT es el entorno por defecto.
 * - Producción solo existe si `SABRE_PROD_ENABLED=true`, y siempre queda en solo lectura.
 * - Si a un bloque (REST o SOAP) le faltan variables o tiene alguna inválida, ese bloque queda
 *   deshabilitado con la razón. La app arranca igual, también sin `.env.local`.
 *
 * Los `SabreConfig` resultantes nunca salen del servidor. Para la UI está
 * `getEnvironmentSummary()`, que no lleva valores.
 */

export type EnvironmentId = "cert" | "prod"

export const DEFAULT_ENVIRONMENT: EnvironmentId = "cert"

export type Api = "rest" | "soap"

export type ApiConfig =
  | { enabled: true; config: SabreConfig }
  | { enabled: false; reason: string }

export interface EnvironmentConfig {
  id: EnvironmentId
  label: string
  sdkEnvironment: SabreEnvironment
  /** Producción: sin Create ni Cancel Booking, y colas con confirmación explícita. */
  readOnly: boolean
  rest: ApiConfig
  soap: ApiConfig
}

/** Lo que puede ver el cliente: sin credenciales ni valores de variables. */
export interface EnvironmentSummary {
  id: EnvironmentId
  label: string
  readOnly: boolean
  rest: { enabled: boolean; reason?: string }
  soap: { enabled: boolean; reason?: string }
}

type Env = Record<string, string | undefined>

/** Una variable vacía (como las de `.env.example`) cuenta como ausente. */
const optional = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === "" ? undefined : value,
  z.string().trim().optional()
)
const required = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === "" ? undefined : value,
  z.string({ error: "falta" }).trim()
)

const restSchema = z.discriminatedUnion(
  "AUTH_VERSION",
  [
    z.object({
      AUTH_VERSION: z.literal("v3"),
      CLIENT_ID: required,
      CLIENT_SECRET: required,
      USERNAME: required,
      PASSWORD: required,
    }),
    z.object({
      AUTH_VERSION: z.literal("v2"),
      USERNAME: required,
      PASSWORD: required,
    }),
  ],
  { error: "debe ser v3 o v2" }
)

const soapSchema = z
  .object({
    USERNAME: required,
    PASSWORD: required,
    CLIENT_ID: optional,
    CLIENT_SECRET: optional,
  })
  .refine(
    (soap) =>
      (soap.CLIENT_ID === undefined) === (soap.CLIENT_SECRET === undefined),
    {
      error: "CLIENT_ID y CLIENT_SECRET van juntos o ninguno",
      path: ["CLIENT_ID"],
    }
  )

const flagSchema = z
  .preprocess(
    (value) => (typeof value === "string" ? value.trim().toLowerCase() : value),
    z.enum(["true", "false", ""]).optional()
  )
  .transform((value) => value === "true")

const ENVIRONMENTS: Record<
  EnvironmentId,
  {
    prefix: string
    label: string
    sdkEnvironment: SabreEnvironment
    readOnly: boolean
  }
> = {
  cert: {
    prefix: "SABRE_CERT",
    label: "CERT",
    sdkEnvironment: "sandbox",
    readOnly: false,
  },
  prod: {
    prefix: "SABRE_PROD",
    label: "Producción",
    sdkEnvironment: "production",
    readOnly: true,
  },
}

/** Las variables `<prefix>_<api>_*`, sin el prefijo. */
function pick(env: Env, prefix: string): Env {
  const out: Env = {}
  const start = `${prefix}_`
  for (const [key, value] of Object.entries(env)) {
    if (key.startsWith(start)) out[key.slice(start.length)] = value
  }
  return out
}

/** Razón legible con los nombres de las variables, nunca con sus valores. */
function describe(error: z.ZodError, prefix: string): string {
  const problems = error.issues.map((issue) => {
    const name =
      issue.path.length > 0 ? `${prefix}_${issue.path.join("_")}` : prefix
    return `${name}: ${issue.message}`
  })
  return problems.join("; ")
}

function restConfig(
  env: Env,
  prefix: string,
  environment: SabreEnvironment,
  pcc?: string
): ApiConfig {
  const vars = pick(env, `${prefix}_REST`)
  if (Object.values(vars).every((value) => !value?.trim())) {
    return { enabled: false, reason: `sin variables ${prefix}_REST_*` }
  }
  const parsed = restSchema.safeParse({
    ...vars,
    AUTH_VERSION: vars.AUTH_VERSION?.trim() || "v3",
  })
  if (!parsed.success) {
    return { enabled: false, reason: describe(parsed.error, `${prefix}_REST`) }
  }
  const rest = parsed.data
  const config: SabreConfig =
    rest.AUTH_VERSION === "v3"
      ? {
          environment,
          pcc,
          authVersion: "v3",
          credentials: {
            clientId: rest.CLIENT_ID,
            clientSecret: rest.CLIENT_SECRET,
            username: rest.USERNAME,
            password: rest.PASSWORD,
          },
        }
      : {
          environment,
          pcc,
          authVersion: "v2",
          credentials: { username: rest.USERNAME, password: rest.PASSWORD },
        }
  return { enabled: true, config }
}

function soapConfig(
  env: Env,
  prefix: string,
  environment: SabreEnvironment,
  pcc?: string
): ApiConfig {
  const vars = pick(env, `${prefix}_SOAP`)
  if (Object.values(vars).every((value) => !value?.trim())) {
    return { enabled: false, reason: `sin variables ${prefix}_SOAP_*` }
  }
  const parsed = soapSchema.safeParse(vars)
  if (!parsed.success) {
    return { enabled: false, reason: describe(parsed.error, `${prefix}_SOAP`) }
  }
  const soap = parsed.data
  // Con CLIENT_ID y CLIENT_SECRET el SDK usa SessionCreateRQ 2.0.0; sin ellos, 1.0.0.
  const config: SabreConfig =
    soap.CLIENT_ID !== undefined && soap.CLIENT_SECRET !== undefined
      ? {
          environment,
          pcc,
          authVersion: "v3",
          credentials: {
            clientId: soap.CLIENT_ID,
            clientSecret: soap.CLIENT_SECRET,
            username: soap.USERNAME,
            password: soap.PASSWORD,
          },
        }
      : {
          environment,
          pcc,
          authVersion: "v2",
          credentials: { username: soap.USERNAME, password: soap.PASSWORD },
        }
  return { enabled: true, config }
}

function environmentConfig(env: Env, id: EnvironmentId): EnvironmentConfig {
  const { prefix, label, sdkEnvironment, readOnly } = ENVIRONMENTS[id]
  const pcc = optional.parse(env[`${prefix}_PCC`])
  return {
    id,
    label,
    sdkEnvironment,
    readOnly,
    rest: restConfig(env, prefix, sdkEnvironment, pcc),
    soap: soapConfig(env, prefix, sdkEnvironment, pcc),
  }
}

/** Lee y valida la configuración. Exportada aparte para poder probarla con otro `env`. */
export function loadEnvironments(env: Env): EnvironmentConfig[] {
  const environments = [environmentConfig(env, "cert")]
  const prodFlag = flagSchema.safeParse(env.SABRE_PROD_ENABLED)
  if (prodFlag.success && prodFlag.data) {
    environments.push(environmentConfig(env, "prod"))
  }
  return environments
}

let cached: EnvironmentConfig[] | undefined

/** Entornos disponibles, en orden: CERT primero. Se leen una vez por proceso. */
export function getEnvironments(): EnvironmentConfig[] {
  cached ??= loadEnvironments(process.env)
  return cached
}

export function getEnvironment(
  id: EnvironmentId = DEFAULT_ENVIRONMENT
): EnvironmentConfig | undefined {
  return getEnvironments().find((environment) => environment.id === id)
}

function summarizeApi(api: ApiConfig): EnvironmentSummary["rest"] {
  return api.enabled
    ? { enabled: true }
    : { enabled: false, reason: api.reason }
}

export function getEnvironmentSummary(): EnvironmentSummary[] {
  return getEnvironments().map(({ id, label, readOnly, rest, soap }) => ({
    id,
    label,
    readOnly,
    rest: summarizeApi(rest),
    soap: summarizeApi(soap),
  }))
}
