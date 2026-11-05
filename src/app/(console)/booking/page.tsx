import { BookingFlow } from "@/components/booking/booking-flow"
import { FlowHeader } from "@/components/console/flow-header"
import { getFlow } from "@/lib/flows"

/**
 * Flujo 4. `/booking?confirmationId=<localizador>` prellena el formulario de `booking.get`
 * (ADR-025): así se enlaza una reserva desde la mesa de colas o desde cualquier parte. No corre
 * nada solo; un valor que no parezca localizador se ignora.
 */
export default async function BookingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { confirmationId } = await searchParams
  const flow = getFlow("booking")
  if (flow === undefined) throw new Error("falta el flujo booking en FLOWS")
  return (
    <>
      <FlowHeader flow={flow} />
      <BookingFlow initialConfirmationId={locatorParam(confirmationId)} />
    </>
  )
}

function locatorParam(value: string | string[] | undefined) {
  const text = typeof value === "string" ? value.trim().toUpperCase() : ""
  return /^[A-Z0-9]{6,}$/.test(text) ? text : undefined
}
