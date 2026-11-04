import { HistoryView } from "@/components/history/history-view"

export default function HistoryPage() {
  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Historial</h1>
        <p className="text-muted-foreground">
          Las llamadas de esta sesión del navegador, con su método, entorno,
          hora, duración y resultado. Elige una para volver a ver su paso.
        </p>
      </header>
      <HistoryView />
    </>
  )
}
