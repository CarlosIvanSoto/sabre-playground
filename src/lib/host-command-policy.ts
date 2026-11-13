import { HOST_COMMANDS, type HostCommand } from "./host-commands.ts"

/**
 * Las reglas de la consola de comandos (ADR-032): el largo, el `‡` y qué se puede mandar en
 * cada entorno. La server action (`runCommand`) las aplica antes de llamar a Sabre, y la UI
 * las usa para avisar antes de mandar. El SDK no pone reglas (ADR-021, regla 5): la consola sí,
 * porque sabe en qué entorno está.
 *
 * Este módulo no es `server-only` ni importa el SDK: lo usan el cliente, el servidor y los
 * tests.
 */

/**
 * El largo máximo de `SabreCommandLLSRQ`. `sabre-client` 0.6.0 tiene `MAX_COMMAND_LENGTH` y
 * `sabreCommandLength`, pero no los exporta: la consola usa la misma regla, y el `TypeError`
 * del SDK sigue siendo la validación final.
 */
export const MAX_COMMAND_LENGTH = 1023

/** Los caracteres que cuentan 2 en el largo de Sabre. */
const DOUBLE_WIDTH = new Set(["!", "%", "$", "&", "¥", "§"])

/** El largo según Sabre: `!`, `%`, `$`, `&`, `¥` y `§` cuentan 2. */
export function sabreCommandLength(command: string): number {
  let length = 0
  for (const char of command) length += DOUBLE_WIDTH.has(char) ? 2 : 1
  return length
}

/**
 * `‡` (el separador de Sabre Red) a `¥` (el de la API). Es una ayuda de la consola, a la vista:
 * el SDK manda el comando tal cual (ADR-021, regla 4).
 */
export function toHostSeparator(command: string): string {
  return command.replaceAll("‡", "¥")
}

/**
 * El primer token del comando, como lo deja el log del SDK (ADR-021, regla 6): lo que va antes
 * del primer `¥`, `‡` o espacio, cortado a 4 caracteres (`*ABC123` → `*ABC`).
 */
export function commandToken(command: string): string {
  return (command.trim().split(/[¥‡\s]/u)[0] ?? "").slice(0, 4)
}

/** La parte fija de una plantilla: lo que va antes del primer marcador o del `…`. */
export function templatePrefix(template: string): string {
  const cut = template.search(/[<…]/u)
  return cut === -1 ? template : template.slice(0, cut)
}

/** Para comparar: sin espacios en los bordes, en mayúsculas y con `¥`. */
function canonical(command: string): string {
  return toHostSeparator(command).trim().toUpperCase()
}

/**
 * Qué tan bien corresponde el comando (ya canónico) a la entrada: `undefined` si no
 * corresponde. Por prefijo, el largo de la parte fija; con `match` (`exact` o un `RegExp`), el
 * comando completo, que le gana a cualquier prefijo.
 */
function matchScore(text: string, entry: HostCommand): number | undefined {
  if (entry.match === "exact") {
    return text === entry.template.toUpperCase() ? Infinity : undefined
  }
  if (entry.match instanceof RegExp) {
    return entry.match.test(text) ? Infinity : undefined
  }
  const prefix = templatePrefix(entry.template).toUpperCase()
  if (prefix === "" || !text.startsWith(prefix)) return undefined
  return prefix.length
}

/**
 * La entrada del panel que corresponde al comando (ADR-032): por coincidencia de prefijo, el
 * comando empieza con la parte fija de la plantilla, y si hay varias gana la más larga
 * (`W/PT¥ON` es escritura aunque `W/PT¥*` sea lectura). Las entradas con `match` piden el
 * comando completo (`I`, `*<localizador>`) y les ganan a los prefijos. Un comando con `§`
 * (varios en uno) no corresponde a ninguna: cada parte podría ser otra cosa.
 */
export function matchHostCommand(
  command: string,
  commands: readonly HostCommand[] = HOST_COMMANDS
): HostCommand | undefined {
  const text = canonical(command)
  if (text === "" || text.includes("§")) return undefined
  let best: HostCommand | undefined
  let bestScore = 0
  for (const entry of commands) {
    const score = matchScore(text, entry)
    if (score !== undefined && score > bestScore) {
      best = entry
      bestScore = score
    }
  }
  return best
}

/**
 * Mientras se escribe: las entradas cuya parte fija empieza con lo escrito (`PE` → `PE*<PCC>`),
 * si lo escrito todavía no corresponde a ninguna. Sirve para mostrar el tipo junto a la línea.
 */
export function suggestHostCommands(
  command: string,
  commands: readonly HostCommand[] = HOST_COMMANDS
): HostCommand[] {
  const text = canonical(command)
  if (text === "" || text.includes("§")) return []
  return commands.filter((entry) =>
    templatePrefix(entry.template).toUpperCase().startsWith(text)
  )
}

/** Por qué no se emite por comando (ADR-032, regla 3). */
export const ISSUE_BLOCKED_REASON =
  "Emitir por comando está bloqueado en todos los entornos: en CERT se emite por Fulfill."

/** Por qué la consola no corre en fake. */
export const FAKE_COMMAND_REASON =
  "el fake de sabre-client 0.6.0 no simula session.command()"

/** Si alguna parte del comando (separadas por `§`) es un formato de emisión (`W¥…`). */
export function isIssueCommand(command: string): boolean {
  return canonical(command)
    .split("§")
    .some((part) => part.trim().startsWith("W¥"))
}

/**
 * Qué pasa con un comando en un entorno:
 *
 * - `invalid`: vacío, más largo que el máximo o con un marcador sin llenar (`<PCC>`). No se
 *   manda.
 * - `blocked`: emisión, en cualquier entorno, o en producción todo lo que no sea lectura del
 *   panel. No se manda, ni con confirmación.
 * - `confirm`: en CERT, escritura o emisión del panel, o un comando que no está en el panel.
 *   Se manda solo con la confirmación de esa corrida.
 * - `allowed`: se manda sin preguntar.
 */
export type CommandVerdict =
  | { kind: "invalid"; reason: string }
  | { kind: "blocked"; reason: string; entry?: HostCommand }
  | { kind: "confirm"; reason: string; entry?: HostCommand }
  | { kind: "allowed"; entry: HostCommand }

/** `readOnly` es producción (`EnvironmentOption.readOnly`). */
export function commandVerdict(
  command: string,
  readOnly: boolean
): CommandVerdict {
  const text = toHostSeparator(command).trim()
  if (text === "") return { kind: "invalid", reason: "Falta el comando." }
  const length = sabreCommandLength(text)
  if (length > MAX_COMMAND_LENGTH) {
    return {
      kind: "invalid",
      reason: `Mide ${length} y el máximo es ${MAX_COMMAND_LENGTH} (!, %, $, &, ¥ y § cuentan 2).`,
    }
  }
  // Una plantilla sin llenar no se manda en ningún entorno (ADR-032, hallazgo 5).
  const unfilled = text.match(/<[^<>]+>/u)
  if (unfilled !== null) {
    return { kind: "invalid", reason: `Falta llenar ${unfilled[0]}.` }
  }
  const entry = matchHostCommand(text)
  if (isIssueCommand(text)) {
    return { kind: "blocked", reason: ISSUE_BLOCKED_REASON, entry }
  }
  if (readOnly) {
    if (entry?.type === "lectura") return { kind: "allowed", entry }
    return {
      kind: "blocked",
      entry,
      reason:
        entry === undefined
          ? "Producción: solo se mandan los comandos de lectura del panel, y este no está en el panel."
          : `Producción: solo se mandan los comandos de lectura del panel, y ${entry.template} es de tipo ${entry.type}.`,
    }
  }
  if (entry === undefined) {
    return {
      kind: "confirm",
      reason: text.includes("§")
        ? "Son varios comandos en uno (§): no corresponde a ninguno del panel."
        : "No está en el panel: no se sabe si lee o escribe.",
    }
  }
  if (entry.type === "escritura" || entry.type === "emite") {
    return {
      kind: "confirm",
      entry,
      reason: `${entry.template} es de tipo ${entry.type}.`,
    }
  }
  return { kind: "allowed", entry }
}

/**
 * Lo que decide la server action antes de llamar a Sabre: el comando que se manda (con `¥` y
 * sin espacios en los bordes) o por qué no. `confirmed` es la confirmación de esa corrida (el
 * popover de la UI); sin ella, lo que pide confirmación no se manda.
 */
export function gateCommand(
  command: string,
  confirmed: boolean,
  readOnly: boolean
): { ok: true; command: string } | { ok: false; reason: string } {
  const verdict = commandVerdict(command, readOnly)
  switch (verdict.kind) {
    case "invalid":
    case "blocked":
      return { ok: false, reason: verdict.reason }
    case "confirm":
      if (!confirmed) {
        return {
          ok: false,
          reason: `Pide confirmación: ${verdict.reason}`,
        }
      }
      break
    case "allowed":
      break
  }
  return { ok: true, command: toHostSeparator(command).trim() }
}
