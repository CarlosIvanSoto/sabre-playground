"use client"

import { ClipboardList, ExternalLink } from "lucide-react"
import Link from "next/link"
import type { QueueItem } from "sabre-client"
import {
  censusBooking,
  censusClock,
  censusFromScreen,
} from "@/app/(console)/queue-census/actions"
import { useEnvironment } from "@/components/environment/environment-provider"
import { useCensus } from "@/components/queue-census/census-provider"
import { useStep } from "@/components/step/use-step"
import { Button, buttonVariants } from "@/components/ui/button"
import type { ParagraphTraits } from "@/lib/census-traits"
import { FAKE_REST_REASON } from "@/lib/flows"
import { addReason, bookingOf } from "@/lib/queue-census"

/**
 * "Al censo" en la mesa de colas (F10.5, #99; ADR-026): agrega el PNR en pantalla al censo en
 * curso del navegador, con los mismos rasgos que uno del recorrido. Los calcula el servidor a
 * partir del `QueueItem` que la mesa ya tiene, así que no llama a Sabre por SOAP ni mueve el
 * cursor; después corre el `booking.get` del censo. El censo se ve y se exporta en
 * `/queue-census`.
 */
export function DeskCensus({
  item,
  queue,
  total,
  pcc,
  reason,
}: {
  /** El PNR en pantalla, como lo devolvió `access` o `ignore`. */
  item?: QueueItem
  /** La cola del cursor, como texto. */
  queue: string
  /** El conteo de la cola al entrar. */
  total?: number
  /** El PCC de trabajo de la mesa; vacío es el de la sesión. */
  pcc: string
  /** Por qué la mesa no deja agregar (sin PNR en pantalla, fuera de la cola). */
  reason?: string
}) {
  const { environment } = useEnvironment()
  const { census, dispatch } = useCensus()
  const addStep = useStep("census.add", censusFromScreen)
  const bookingStep = useStep("booking.get", censusBooking)
  const number = Number(queue)
  const pending = addStep.pending || bookingStep.pending
  const blocked =
    reason ??
    (item === undefined
      ? "Sin PNR en pantalla."
      : addReason(census, { pcc, queue: number, pnr: item.locator }))
  const added =
    item === undefined
      ? undefined
      : census.queues
          .find((row) => row.queue === number)
          ?.items.find((row) => row.pnr === item.locator)
  const read = census.queues.reduce((sum, row) => sum + row.items.length, 0)

  const add = async () => {
    if (item === undefined || blocked !== undefined) return
    const takenAt = census.takenAt ?? (await censusClock())
    const position =
      (census.queues.find((row) => row.queue === number)?.items.length ?? 0) + 1
    const { locator, placedAt, placedBy, paragraph } = item
    addStep.execute(
      { item: { locator, placedAt, placedBy, paragraph }, pcc },
      (run) => {
        if (!run.enabled || !run.step.ok || run.step.result === undefined) {
          return
        }
        dispatch({
          type: "add",
          environment: environment.id,
          pcc,
          takenAt,
          queue: number,
          count: total ?? 0,
          item: run.step.result as ParagraphTraits,
        })
        if (environment.id === "fake") {
          dispatch({
            type: "booking",
            queue: number,
            position,
            booking: null,
            error: FAKE_REST_REASON,
          })
          return
        }
        bookingStep.execute({ pnr: locator, pcc }, (booking) => {
          const result = bookingOf(booking)
          dispatch({
            type: "booking",
            queue: number,
            position,
            booking: result.booking,
            error: result.booking === null ? result.error : undefined,
          })
        })
      }
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <Button
        variant="outline"
        className="justify-between"
        disabled={pending || blocked !== undefined}
        onClick={() => void add()}
        title="Agrega el PNR en pantalla al censo en curso, sin mover el cursor"
      >
        <span className="flex items-center gap-1.5">
          <ClipboardList />
          Al censo
        </span>
        <code className="text-xs opacity-70">census.add</code>
      </Button>
      {added !== undefined ? (
        <span className="text-muted-foreground text-xs">
          En el censo como {added.ref}.
        </span>
      ) : (
        blocked !== undefined &&
        item !== undefined && (
          <span className="text-muted-foreground text-xs">{blocked}</span>
        )
      )}
      {read > 0 && (
        <Link
          href={pcc === "" ? "/queue-census" : `/queue-census/${pcc}`}
          className={buttonVariants({
            variant: "ghost",
            size: "sm",
            className: "justify-start",
          })}
        >
          <ExternalLink />
          Abrir el censo ({read} PNR)
        </Link>
      )}
    </div>
  )
}
