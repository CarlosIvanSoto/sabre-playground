/**
 * La edición de la línea de comando (F15.2), sin React para poder probarla: insertar en el
 * cursor y recorrer los comandos de la corrida con ↑ y ↓, como en una terminal.
 *
 * Este módulo no importa nada.
 */

/** El texto con `text` en lugar de la selección `[start, end)`, y dónde queda el cursor. */
export function insertAt(
  value: string,
  start: number,
  end: number,
  text: string
): { value: string; caret: number } {
  return {
    value: value.slice(0, start) + text + value.slice(end),
    caret: start + text.length,
  }
}

/**
 * Dónde está la línea en el recorrido de la corrida: `index` es la posición en `sent` (de la
 * más vieja a la más nueva) o `undefined` si se está escribiendo uno nuevo; `draft` es lo que
 * se estaba escribiendo antes de subir, para volver a él al bajar del todo.
 */
export interface Recall {
  index?: number
  draft: string
}

export const NO_RECALL: Recall = { draft: "" }

/**
 * ↑ (`-1`) o ↓ (`+1`): el comando que queda en la línea y el estado nuevo del recorrido, o
 * `undefined` si no hay a dónde moverse.
 */
export function recall(
  sent: readonly string[],
  state: Recall,
  current: string,
  direction: -1 | 1
): { value: string; state: Recall } | undefined {
  if (sent.length === 0) return undefined
  if (state.index === undefined) {
    if (direction === 1) return undefined
    const index = sent.length - 1
    return { value: sent[index] ?? "", state: { index, draft: current } }
  }
  const index = state.index + direction
  if (index < 0) return undefined
  if (index >= sent.length) {
    return { value: state.draft, state: { draft: state.draft } }
  }
  return { value: sent[index] ?? "", state: { index, draft: state.draft } }
}
