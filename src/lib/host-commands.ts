/**
 * Los comandos de host conocidos: los datos del panel de la consola de comandos (ADR-032).
 *
 * Se copian a mano de `sabre-wiki/wiki/concepts/comandos-de-host.md`, que es la fuente: un
 * comando nuevo entra primero allá, con su fuente, y después acá. No se lee el wiki en tiempo
 * de ejecución (ADR-032, alternativas).
 *
 * El tipo decide qué se puede mandar en cada entorno (`host-command-policy.ts`):
 *
 * - `lectura`: solo muestra. Es lo único que se manda en producción.
 * - `sesion`: cambia el estado de la sesión (AAA, duty code, PNR en pantalla), no del PCC.
 * - `escritura`: cambia algo que persiste (el TJR, una impresora, un PNR, una cola).
 * - `emite`: genera un boleto o un cobro.
 *
 * Los marcadores van entre `<` y `>` (`<PCC>`, `<LNIATA>`). El separador es `¥`, como se
 * manda por la API; la consola convierte el `‡` de Sabre Red al escribir.
 *
 * Este módulo no importa nada: lo usan el cliente, el servidor y los tests.
 */

export type HostCommandType = "lectura" | "sesion" | "escritura" | "emite"

export type HostCommandGroup =
  | "sesion"
  | "tjr"
  | "pnr"
  | "colas"
  | "reportes"
  | "impresoras"
  | "emision"

export interface HostCommand {
  /** El comando, con los marcadores entre `<` y `>`. */
  template: string
  /** Qué hace. */
  description: string
  group: HostCommandGroup
  type: HostCommandType
  /** De dónde sale: la página del wiki o la prueba que lo respalda. */
  source: string
  /**
   * Cómo coincide con un comando, si no es por prefijo (ADR-032, hallazgos de implementación):
   * `exact` pide el comando completo (`I`, `E`); un `RegExp`, el comando completo con esa forma
   * (`*` y 6 letras). Un comando que no la cumple no corresponde a esta entrada.
   */
  match?: "exact" | RegExp
}

/** Los grupos, en el orden de la página del wiki. */
export const HOST_COMMAND_GROUPS: { id: HostCommandGroup; label: string }[] = [
  { id: "sesion", label: "Sesión y AAA" },
  { id: "tjr", label: "TJR (configuración del PCC)" },
  { id: "pnr", label: "PNR" },
  { id: "colas", label: "Colas" },
  { id: "reportes", label: "Reportes y utilidades" },
  { id: "impresoras", label: "Impresoras (para emitir)" },
  { id: "emision", label: "Emisión y precio" },
]

export const HOST_COMMAND_TYPE_LABELS: Record<HostCommandType, string> = {
  lectura: "lectura",
  sesion: "sesión",
  escritura: "escritura",
  emite: "emite",
}

const CONFIG = "wiki/concepts/configuracion-de-agencia.md"
const PRINTERS = "wiki/sources/impresoras-sabre-central.md"

export const HOST_COMMANDS: HostCommand[] = [
  // Sesión y AAA
  {
    template: "*S*P",
    description:
      "Muestra el agente activo y su duty code (p. ej. ACTIVE AGENT - W  WEBSERVICES).",
    group: "sesion",
    type: "lectura",
    source: `Prueba en CERT (${CONFIG})`,
  },

  // TJR
  {
    template: "W/PT¥*",
    description: "Muestra «Store Passenger Type In PNR» (PSGR TYPE - ON/OFF).",
    group: "tjr",
    type: "lectura",
    source: "Prueba en CERT y producción",
  },
  {
    template: "W/PT¥ON",
    description: "Activa «Store Passenger Type In PNR» (UPDATE OK).",
    group: "tjr",
    type: "escritura",
    source: "Prueba en CERT; en producción lo hizo el Account Manager",
  },
  {
    template: "W/TA*<PCC>",
    description:
      "Muestra el número de agencia de venta del TJR. Si falta, W* responde UNABLE - VERIFY SALES NUMBER IN LOCATION.",
    group: "tjr",
    type: "lectura",
    source: PRINTERS,
  },

  // Impresoras
  {
    template: "PE*<PCC>",
    description:
      "Lista las impresoras (PTR) y computadoras (CRT) del PCC con sus LNIATA. Da NOT AUTHORIZED si el PCC en sesión no tiene el mismo código SC ni Branch Access.",
    group: "impresoras",
    type: "lectura",
    source: PRINTERS,
  },

  // Emisión y precio
  {
    template: "W¥…",
    description:
      "Emite (formato de emisión). Ya hay API: Fulfill Flight Tickets. Bloqueado en la consola.",
    group: "emision",
    type: "emite",
    source: "wiki/concepts/emision-de-boletos.md",
  },
]
