/**
 * Base de un nombre de archivo: `booking.get`, `queue.count`… Lo que no sea letra, dígito,
 * punto o guion pasa a `-` (`openSession + close` → `openSession-close`).
 */
export function fileBase(text: string): string {
  return text.replace(/[^A-Za-z0-9.-]+/g, "-").replace(/^-|-$/g, "")
}
