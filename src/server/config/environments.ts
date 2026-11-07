import "server-only"

import {
  type BuildCredentialsOptions,
  buildCredentials,
  type SabreConfig,
  type SabreEnvironment,
} from "sabre-client"
import { z } from "zod"
import {
  type ConsoleEnvironmentId,
  ENVIRONMENT_IDS,
  type EnvironmentOption,
} from "@/lib/environment"

/**
 * Configuración por entorno, leída de `process.env` (`.env`).
 *
 * - CERT es el entorno por defecto.
 * - Producción solo existe si `SABRE_PROD_ENABLED=true`, y siempre queda en solo lectura.
 * - Un solo juego de credenciales por entorno, armado con `buildCredentials`: el mismo
 *   `SabreConfig` va a `Sabre` (REST) y a `SabreLegacy` (SOAP).
 * - Si faltan variables, alguna es inválida o `buildCredentials` rechaza los datos, el entorno
 *   queda deshabilitado con la razón. La app arranca igual, también sin `.env`.
 *
 * Los `SabreConfig` resultantes nunca salen del servidor. Para la UI está
 * `getEnvironmentSummary()`, que no lleva valores.
 */

export type EnvironmentId = "cert" | "prod"

export const DEFAULT_ENVIRONMENT: EnvironmentId = "cert"

export type CredentialsConfig =
  /** `pcc`: el del EPR, para los requests que lo piden en el body (el `POS` de BFM). */
  | { enabled: true; config: SabreConfig; pcc: string }
  | { enabled: false; reason: string }

export interface EnvironmentConfig {
  id: EnvironmentId
  label: string
  sdkEnvironment: SabreEnvironment
  /** Producción: sin Create ni Cancel Booking, y colas con confirmación explícita. */
  readOnly: boolean
  sabre: CredentialsConfig
}

/** Lo que puede ver el cliente: sin credenciales ni valores de variables. */
export interface EnvironmentSummary extends EnvironmentOption {
  id: EnvironmentId
}

type Env = Record<string, string | undefined>

/** Una variable vacía (como las de `.env.example`) cuenta como ausente. */
const blankToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value
const optional = z.preprocess(blankToUndefined, z.string().trim().optional())
const required = z.preprocess(
  blankToUndefined,
  z.string({ error: "falta" }).trim()
)

// Solo presencia y forma de las variables. El PCC, el domain y el par CLIENT_ID/CLIENT_SECRET
// en v2 los valida `buildCredentials`.
const base = {
  USERNAME: required,
  PCC: required,
  DOMAIN: optional,
  PASSWORD: required,
}
const credentialsSchema = z.discriminatedUnion(
  "AUTH_VERSION",
  [
    z.object({
      ...base,
      AUTH_VERSION: z.literal("v3"),
      CLIENT_ID: required,
      CLIENT_SECRET: required,
    }),
    z.object({
      ...base,
      AUTH_VERSION: z.literal("v2"),
      CLIENT_ID: optional,
      CLIENT_SECRET: optional,
    }),
  ],
  { error: "debe ser v3 o v2" }
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

/** Las variables `<prefix>_*`, sin el prefijo. */
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

function credentialsConfig(
  env: Env,
  prefix: string,
  environment: SabreEnvironment
): CredentialsConfig {
  // SABRE_PROD_ENABLED es el interruptor, no una credencial.
  const { ENABLED: _enabled, ...vars } = pick(env, prefix)
  if (Object.values(vars).every((value) => !value?.trim())) {
    return { enabled: false, reason: `sin variables ${prefix}_*` }
  }
  const parsed = credentialsSchema.safeParse({
    ...vars,
    AUTH_VERSION: vars.AUTH_VERSION?.trim() || "v3",
  })
  if (!parsed.success) {
    return { enabled: false, reason: describe(parsed.error, prefix) }
  }
  const v = parsed.data
  const parts = {
    user: v.USERNAME,
    pcc: v.PCC,
    domain: v.DOMAIN,
    password: v.PASSWORD,
  }
  const options: BuildCredentialsOptions =
    v.AUTH_VERSION === "v3"
      ? {
          ...parts,
          authVersion: "v3",
          clientId: v.CLIENT_ID,
          clientSecret: v.CLIENT_SECRET,
        }
      : {
          ...parts,
          authVersion: "v2",
          clientId: v.CLIENT_ID,
          clientSecret: v.CLIENT_SECRET,
        }
  try {
    // Sin `pcc` en la config (`@deprecated` desde 0.4.1): el PCC ya va en el username de las
    // credenciales. Tampoco `authVersion`: desde 0.4.1, `buildCredentials` lo pone en las
    // credenciales y la config lo toma de ahí. Hay que ramificar igual: con la sobrecarga de
    // unión, `BuiltCredentialsV2 | BuiltCredentialsV3` no se puede asignar a `SabreConfig`.
    const config: SabreConfig =
      options.authVersion === "v2"
        ? { environment, credentials: buildCredentials(options) }
        : { environment, credentials: buildCredentials(options) }
    return { enabled: true, config, pcc: v.PCC.toUpperCase() }
  } catch (error) {
    // `buildCredentials` valida sin red y sus mensajes no repiten secretos.
    if (error instanceof TypeError) {
      return { enabled: false, reason: `${prefix}_*: ${error.message}` }
    }
    throw error
  }
}

function environmentConfig(env: Env, id: EnvironmentId): EnvironmentConfig {
  const { prefix, label, sdkEnvironment, readOnly } = ENVIRONMENTS[id]
  return {
    id,
    label,
    sdkEnvironment,
    readOnly,
    sabre: credentialsConfig(env, prefix, sdkEnvironment),
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

export function getEnvironmentSummary(): EnvironmentSummary[] {
  return getEnvironments().map(({ id, label, readOnly, sabre }) => ({
    id,
    label,
    readOnly,
    ...(sabre.enabled
      ? { enabled: true }
      : { enabled: false, reason: sabre.reason }),
  }))
}

const FAKE_OPTION: EnvironmentOption = {
  id: "fake",
  label: "Fake",
  readOnly: false,
  enabled: true,
}

/** Los entornos del selector: CERT, producción si está habilitada, y fake. */
export function getConsoleEnvironments(): EnvironmentOption[] {
  return [...getEnvironmentSummary(), FAKE_OPTION]
}

/**
 * Valida el entorno que llega a una server action (son endpoints públicos). Devuelve el id si
 * existe y está habilitado, o la razón por la que no se puede usar.
 */
export function resolveEnvironment(
  input: unknown
): { ok: true; id: ConsoleEnvironmentId } | { ok: false; reason: string } {
  const parsed = z.enum(ENVIRONMENT_IDS).safeParse(input)
  if (!parsed.success) return { ok: false, reason: "entorno desconocido" }
  const option = getConsoleEnvironments().find((e) => e.id === parsed.data)
  if (option === undefined) {
    return { ok: false, reason: `entorno ${parsed.data} no habilitado` }
  }
  if (!option.enabled) {
    return { ok: false, reason: option.reason ?? "entorno deshabilitado" }
  }
  return { ok: true, id: parsed.data }
}
