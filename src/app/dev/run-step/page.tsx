import {
  BookingGetProbe,
  FakeQueueProbe,
  SearchProbe,
  SessionProbe,
} from "./probe"

/** Página de prueba de `runStep()` (F0.4), vista con el `StepPanel` (F1.1), más
 * un BFM y un sobre de cola para el visor de Crudo (F1.2). */
export default function RunStepPage() {
  return (
    <main className="container mx-auto flex flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold">Prueba de runStep</h1>
        <p className="text-muted-foreground mt-2">
          En CERT, con el mismo juego de credenciales. La primera corrida de{" "}
          <code>booking.get</code> pide el token y la segunda lo reutiliza:
          compara el log de las dos.
        </p>
      </div>
      <BookingGetProbe />
      <SessionProbe />
      <SearchProbe />
      <FakeQueueProbe />
    </main>
  )
}
