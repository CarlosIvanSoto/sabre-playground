"use server"

import {
  type GetBookingReturnOnly,
  parseQueueParagraph,
  type QueueParagraph,
  type QueueStep,
} from "sabre-client"
import { z } from "zod"
import { FAKE_REST_REASON } from "@/lib/flows"
import type { CensusStep } from "@/lib/queue-census"
import { optionalPcc, queueAccessSchema, queueCountSchema } from "@/lib/queues"
import type { StepRun } from "@/lib/step/types"
import { censusRun } from "@/server/census/step"
import {
  bookingTraits,
  paragraphTraits,
  type TraitContext,
} from "@/server/census/traits"
import { getEnvironment } from "@/server/config/environments"
import { getSabre } from "@/server/sabre/clients"
import { runStep } from "@/server/sabre/run-step"
import {
  getSessionStatus,
  withRegisteredSession,
} from "@/server/sabre/sessions"
import { inEnvironment } from "@/server/sabre/step-action"

/**
 * El censo de colas (F10.1, #95; F10.2, #96; ADR-026): las cuatro lecturas del recorrido dentro
 * de la sesión registrada del navegador, más `booking.get` por PNR. Este módulo no tiene
 * `place`, `remove` ni `process`: la ruta `/queue-census` no puede escribir aunque quiera.
 *
 * Son lecturas, así que corren en todos los entornos, como en el flujo 6. El desbloqueo y la
 * confirmación de producción los pide la página antes de arrancar (ADR-026, "Cómo se toma").
 *
 * Lo que sale de acá son rasgos, no respuestas de Sabre (F10.2): `access` e `ignore` devuelven
 * el PNR en pantalla como `ParagraphTraits`, sin el párrafo, y `censusBooking` devuelve
 * `BookingTraits`, sin la reserva. Las cinco pasan por `censusRun`: al crudo le falta el body
 * (que en SOAP trae el PCC en `CPAId`). Para ver el PNR entero está la mesa de colas.
 */

const INVALID = { enabled: false, reason: "entrada inválida" } as const

/** `returnOnly` sin `CONTACT_INFO` (ADR-026): lo justo, y menos llamadas downline. */
const RETURN_ONLY: GetBookingReturnOnly[] = [
  "FLIGHTS",
  "FLIGHT_PENALTY",
  "JOURNEYS",
  "HOTELS",
  "CARS",
  "TRAINS",
  "CRUISES",
  "ALL_SEGMENTS",
  "TRAVELERS",
  "TICKETS",
  "PAYMENTS",
  "PENALTIES",
  "REMARKS",
  "IS_CANCELABLE",
  "IS_TICKETED",
  "OTHER_SERVICES",
  "SPECIAL_SERVICES",
  "FARES",
  "CREATION_DETAILS",
  "ANCILLARIES",
  "FORMS_OF_PAYMENT",
  "RETENTION_DATE",
  "ACCOUNTING_ITEMS",
  "NON_ELECTRONIC_TICKETS",
  "TRAVELERS_EMPLOYERS",
  "PROFILES",
]

/** El paso de cola reducido: el PNR como rasgos, o el fin de cola sin el mensaje del host. */
function censusStepOf(step: QueueStep, context: TraitContext): CensusStep {
  const warnings = step.warnings.map((warning) => warning.code)
  if (step.done) return { done: true, reason: step.reason, warnings }
  let paragraph: QueueParagraph | undefined
  try {
    paragraph = parseQueueParagraph(step.item.paragraph, {
      referenceDate: context.now,
    })
  } catch {
    // Best-effort: solo lanza con una entrada inválida. Queda `parseOk: false`.
  }
  return {
    done: false,
    item: paragraphTraits(step.item, paragraph, context),
    warnings,
  }
}

/** El PCC de trabajo efectivo de la sesión: el elegido, o el de la sesión. */
async function sessionContext(
  id: Parameters<typeof getSessionStatus>[0],
  pcc: string | undefined
): Promise<TraitContext> {
  const status = await getSessionStatus(id)
  return {
    now: new Date(),
    workingPcc: pcc ?? (status.open ? status.pcc : ""),
  }
}

const navigationSchema = z.object({ pcc: optionalPcc })

export async function censusCount(
  environment: unknown,
  input: unknown
): Promise<StepRun> {
  return inEnvironment(environment, async (id) => {
    const parsed = queueCountSchema.safeParse(input)
    if (!parsed.success) return INVALID
    return censusRun(
      await withRegisteredSession(id, (session, options) =>
        session.queue.count(parsed.data, options)
      )
    )
  })
}

export async function censusAccess(
  environment: unknown,
  input: unknown
): Promise<StepRun> {
  return inEnvironment(environment, async (id) => {
    const parsed = queueAccessSchema.safeParse(input)
    if (!parsed.success) return INVALID
    // El censo recorre solo colas numéricas del rango 0–49.
    const { queue, pcc } = parsed.data
    if (typeof queue !== "number" || queue > 49) return INVALID
    const context = await sessionContext(id, pcc)
    return censusRun(
      await withRegisteredSession(id, async (session, options) =>
        censusStepOf(
          await session.queue.access({ queue, pcc }, options),
          context
        )
      )
    )
  })
}

export async function censusIgnore(
  environment: unknown,
  input: unknown
): Promise<StepRun> {
  return inEnvironment(environment, async (id) => {
    const parsed = navigationSchema.safeParse(input)
    if (!parsed.success) return INVALID
    const context = await sessionContext(id, parsed.data.pcc)
    return censusRun(
      await withRegisteredSession(id, async (session, options) =>
        censusStepOf(await session.queue.ignore(options), context)
      )
    )
  })
}

export async function censusExit(
  environment: unknown,
  _input: unknown
): Promise<StepRun> {
  return inEnvironment(environment, (id) =>
    withRegisteredSession(id, async (session, options) => {
      await session.queue.exit(options)
      return { state: session.queue.state }
    }).then(censusRun)
  )
}

const bookingSchema = z.object({
  pnr: z.string().regex(/^[A-Z0-9]{6}$/),
  pcc: optionalPcc,
})

/**
 * `booking.get` del PNR del censo, con `targetPcc` si hay PCC de trabajo, y nunca
 * `unmaskPaymentCardNumbers`. No mueve el cursor de la cola (ADR-025). Devuelve solo los
 * rasgos.
 */
export async function censusBooking(
  environment: unknown,
  input: unknown
): Promise<StepRun> {
  return inEnvironment(environment, async (id) => {
    const parsed = bookingSchema.safeParse(input)
    if (!parsed.success) return INVALID
    if (id === "fake") return { enabled: false, reason: FAKE_REST_REASON }
    const sabre = getSabre(id)
    if (!sabre.enabled) return { enabled: false, reason: sabre.reason }
    const { pnr, pcc } = parsed.data
    const config = getEnvironment(id)?.sabre
    const context: TraitContext = {
      now: new Date(),
      workingPcc: pcc ?? (config?.enabled ? config.pcc : ""),
    }
    const step = await runStep(async (options) =>
      bookingTraits(
        await sabre.client.booking.get(
          { confirmationId: pnr, targetPcc: pcc, returnOnly: RETURN_ONLY },
          options
        ),
        context
      )
    )
    return censusRun({ enabled: true, step })
  })
}
