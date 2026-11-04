import {
  BookingGetProbe,
  QueueCountProbe,
  SearchProbe,
  SessionProbe,
} from "./probe"

/**
 * Página de prueba de `runStep()` (F0.4), vista con el `StepPanel` (F1.1), más un BFM y un
 * sobre de cola para el visor de Crudo (F1.2). Corre en el entorno elegido arriba (F1.3).
 */
export default function RunStepPage() {
  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Prueba de runStep</h1>
        <p className="text-muted-foreground">
          Cada paso corre en el entorno elegido arriba. En CERT, la primera
          corrida de <code>booking.get</code> pide el token y la segunda lo
          reutiliza: compara el log de las dos. En fake, REST queda
          deshabilitado y la sesión y las colas corren sin red.
        </p>
      </header>
      <BookingGetProbe />
      <SessionProbe />
      <SearchProbe />
      <QueueCountProbe />
    </>
  )
}
