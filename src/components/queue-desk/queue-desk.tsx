"use client"

import { HistoryIcon } from "lucide-react"
import Link from "next/link"
import { type ReactNode, useEffect, useReducer } from "react"
import { useHistory } from "@/components/history/history-provider"
import { DeskSessionBar } from "@/components/queue-desk/desk-session"
import { useSessionStatus } from "@/components/session/use-session-status"
import { initialQueueDesk, queueDeskReducer } from "@/lib/queue-desk"

/**
 * La mesa de colas (ADR-025): sesión, conteo, navegación y reserva en una sola pantalla de
 * alto fijo, sin scroll de página. Solo hacen scroll interno la lista de colas y el párrafo
 * del PNR. Compone los flujos 4, 5 y 6 con sus mismas server actions, sin agregar ninguna:
 * cada llamada pasa por `useStep` y queda en el historial.
 *
 * F9.1 arma el esqueleto y la sesión. El conteo y la navegación llegan en F9.2, mover y sacar
 * en F9.3, la hoja de reserva en F9.4, y los atajos y la barra de actividad en F9.5.
 */
export function QueueDesk() {
  const { status, error, refresh } = useSessionStatus()
  const [desk, dispatch] = useReducer(queueDeskReducer, undefined, () =>
    initialQueueDesk()
  )
  const open = status?.open === true

  // Una sesión cerrada o vencida (o un cambio de entorno) no tiene cursor.
  useEffect(() => {
    if (status !== undefined && !status.open) {
      dispatch({ type: "journey", action: { type: "sessionGone" } })
    }
  }, [status])

  // Cerrar la pestaña no cierra la sesión: queda en el registro del servidor hasta que la
  // barre (35 min) y, mientras, cuenta para el límite de 50 por PCC.
  useEffect(() => {
    if (!open) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      // Chrome antes de la 119 y algunos WebView solo miran `returnValue`.
      event.returnValue = true
    }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [open])

  return (
    // El layout de la consola deja la cabecera de 3.5rem y un padding de 1rem (1.5rem desde
    // md). Los márgenes negativos lo anulan para que la mesa ocupe justo el resto del alto.
    <div
      data-slot="queue-desk"
      className="-m-4 flex h-[calc(100dvh-3.5rem)] min-h-0 flex-col overflow-hidden md:-m-6"
    >
      <DeskSessionBar
        status={status}
        error={error}
        onDone={() => void refresh()}
      />
      <div className="grid min-h-0 flex-1 grid-cols-[14rem_minmax(0,1fr)_16rem] divide-x">
        <DeskColumn title="Colas" scroll>
          <Pending>
            El conteo de las colas y la entrada con un clic llegan en F9.2.
          </Pending>
        </DeskColumn>
        <DeskColumn
          title={
            desk.journey.queue === ""
              ? "PNR en pantalla"
              : `Cola ${desk.journey.queue}`
          }
          scroll
        >
          <Pending>
            El PNR en pantalla, con las pestañas Párrafo, Parseado y Crudo,
            llega en F9.2.
          </Pending>
        </DeskColumn>
        <DeskColumn title="Acciones">
          <Pending>
            Siguiente y salir llegan en F9.2, mover y sacar en F9.3, y la
            reserva en F9.4.
          </Pending>
        </DeskColumn>
      </div>
      <ActivityBar />
    </div>
  )
}

/** Una columna de la mesa: título fijo y cuerpo que, si `scroll`, hace scroll por dentro. */
function DeskColumn({
  title,
  scroll = false,
  children,
}: {
  title: ReactNode
  scroll?: boolean
  children: ReactNode
}) {
  return (
    <section
      aria-label={typeof title === "string" ? title : undefined}
      className="flex min-h-0 min-w-0 flex-col"
    >
      <h2 className="text-muted-foreground shrink-0 border-b px-4 py-2 text-xs font-medium tracking-wide uppercase">
        {title}
      </h2>
      <div
        className={
          scroll
            ? "min-h-0 flex-1 overflow-y-auto p-4"
            : "min-h-0 flex-1 overflow-hidden p-4"
        }
      >
        {children}
      </div>
    </section>
  )
}

function Pending({ children }: { children: ReactNode }) {
  return <p className="text-muted-foreground text-sm">{children}</p>
}

/**
 * La barra de actividad. En F9.5 muestra las últimas llamadas de la mesa con su detalle; por
 * ahora, cuántas llamadas hay en el historial del navegador y el enlace para verlas.
 */
function ActivityBar() {
  const { entries } = useHistory()
  return (
    <footer className="text-muted-foreground flex h-10 shrink-0 items-center gap-2 border-t px-4 text-sm">
      <span className="font-medium">Actividad</span>
      <span>
        {entries.length === 0
          ? "sin llamadas todavía"
          : `${entries.length} ${entries.length === 1 ? "llamada" : "llamadas"} en el historial`}
      </span>
      <Link
        href="/history"
        className="hover:text-foreground ms-auto inline-flex items-center gap-1"
      >
        <HistoryIcon className="size-4" />
        Historial
      </Link>
    </footer>
  )
}
