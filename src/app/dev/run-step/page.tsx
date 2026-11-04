import { Probe } from "./probe"

/** Página de prueba de `runStep()` (F0.4). La UI de los pasos llega en la Fase 1. */
export default function RunStepPage() {
  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold">Prueba de runStep</h1>
      <p className="text-muted-foreground mt-2">
        En CERT, lee una reserva que no existe (REST) y abre y cierra una sesión
        SOAP, con el mismo juego de credenciales. La primera corrida pide el
        token y la segunda lo reutiliza: compara el log de las dos.
      </p>
      <Probe />
    </main>
  )
}
