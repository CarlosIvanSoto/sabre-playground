import { BookingFlow } from "@/components/booking/booking-flow"
import { FlowHeader } from "@/components/console/flow-header"
import { getFlow } from "@/lib/flows"
import { PCC_PATTERN } from "@/lib/queues"

/**
 * Flujo 4. `/booking?confirmationId=<localizador>` prellena el formulario de `booking.get`
 * (ADR-025): así se enlaza una reserva desde la mesa de colas o desde cualquier parte.
 * `&targetPcc=<PCC>` prellena el PCC (F9.6). No corre nada solo; un valor que no tenga la forma
 * esperada se ignora.
 */
export default async function BookingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { confirmationId, targetPcc } = await searchParams
  const flow = getFlow("booking")
  if (flow === undefined) throw new Error("falta el flujo booking en FLOWS")
  return (
    <>
      <FlowHeader flow={flow} />
      <BookingFlow
        initialConfirmationId={locatorParam(confirmationId)}
        initialTargetPcc={pccParam(targetPcc)}
      />
    </>
  )
}

function locatorParam(value: string | string[] | undefined) {
  const text = typeof value === "string" ? value.trim().toUpperCase() : ""
  return /^[A-Z0-9]{6,}$/.test(text) ? text : undefined
}

function pccParam(value: string | string[] | undefined) {
  const text = typeof value === "string" ? value.trim().toUpperCase() : ""
  return PCC_PATTERN.test(text) ? text : undefined
}
