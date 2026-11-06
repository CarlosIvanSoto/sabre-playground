import type { Metadata } from "next"
import { QueueDesk } from "@/components/queue-desk/queue-desk"

export const metadata: Metadata = {
  title: "Mesa de colas · sabre-playground",
}

/**
 * `/queue-desk`: la mesa de colas (ADR-025). No es un flujo de la tabla de ADR-022: compone
 * los flujos 4, 5 y 6 en una pantalla de trabajo, así que no lleva `FlowHeader`.
 */
export default function QueueDeskPage() {
  return <QueueDesk />
}
