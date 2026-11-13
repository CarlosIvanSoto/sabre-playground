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
const IUR = "wiki/concepts/iur.md"
const BOOKING_API = "wiki/entities/booking-management-api.md"
const END_TRANSACTION = "wiki/entities/end-transaction.md"
const PRINTERS = "wiki/sources/impresoras-sabre-central.md"
const DESIGNATE = "wiki/sources/designate-printer-2-0-2.md"
const TEO = "wiki/sources/impresoras-teo-y-codigos-de-pais.md"
const SEND_COMMAND = "wiki/sources/send-sabre-command-2-0-0.md"

/** Copiado de comandos-de-host (sabre-wiki cc000e1, 2026-11-12), en el orden de la página. */
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
  {
    template: "AAA<PCC>",
    description:
      "Cambia el AAA de la sesión a otro PCC (equivale a ContextChangeLLSRQ).",
    group: "sesion",
    type: "sesion",
    source: "Account Manager, 2026-11-03",
    match: /^AAA[A-Z0-9]{3,4}$/u,
  },
  {
    template: "SI9",
    description:
      "Toma el duty code 9 en la sesión. Requiere el atributo SUBMGR en el EPR: en CERT, el EPR de la API lo tiene; en producción, sin probar (Q-066).",
    group: "sesion",
    type: "sesion",
    source: "Prueba en CERT, 2026-11-03",
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
    description:
      "Activa «Store Passenger Type In PNR» (UPDATE OK). Pide duty code 9.",
    group: "tjr",
    type: "escritura",
    source: "Prueba en CERT; en producción lo hizo el Account Manager",
  },
  {
    template: "W/IURMX¥*",
    description: "Muestra el registro MX de impuestos en el IUR.",
    group: "tjr",
    type: "lectura",
    source: IUR,
  },
  {
    template: "W/IURMX¥ON",
    description: "Activa el registro MX de impuestos en el IUR.",
    group: "tjr",
    type: "escritura",
    source: IUR,
  },
  {
    template: "W/IURMXPC¥ON",
    description: "Variante del IUR: tarjeta en MX.",
    group: "tjr",
    type: "escritura",
    source: IUR,
  },
  {
    template: "W/CCIURM2¥ON",
    description: "Variante del IUR: tarjeta en M2.",
    group: "tjr",
    type: "escritura",
    source: IUR,
  },
  {
    template: "W/IURMXED¥ON",
    description: "Variante del IUR: EMD.",
    group: "tjr",
    type: "escritura",
    source: IUR,
  },
  {
    template: "W/ALT¥ON",
    description: "Moneda alternativa en la tarifa.",
    group: "tjr",
    type: "escritura",
    source: BOOKING_API,
  },
  {
    template: "W/TA*<PCC>",
    description:
      "Muestra el número de agencia de venta del TJR. Si falta, W* responde UNABLE - VERIFY SALES NUMBER IN LOCATION.",
    group: "tjr",
    type: "lectura",
    source: PRINTERS,
  },
  {
    template: "W/LRGAMT¥*",
    description: "Montos grandes (tarifa hasta 14 dígitos).",
    group: "tjr",
    type: "lectura",
    source: BOOKING_API,
  },
  {
    template: "W/KPAD¥OFF",
    description:
      "Quita la exigencia de dirección de agencia (error 500700 de /orders/create).",
    group: "tjr",
    type: "escritura",
    source: "Catálogo de errores de Orders",
  },
  {
    template: "W/KRAD¥OFF",
    description:
      "Quita la exigencia de dirección del cliente (error 500700 de /orders/create).",
    group: "tjr",
    type: "escritura",
    source: "Catálogo de errores de Orders",
  },
  {
    template: "W/KAST¥OFF",
    description:
      "Quita la exigencia de * en el nombre (error 500700 de /orders/create).",
    group: "tjr",
    type: "escritura",
    source: "Catálogo de errores de Orders",
  },
  // PNR
  {
    template: "*<localizador>",
    description:
      "Muestra un PNR y lo deja en el AAA. Lleva un localizador: el historial de llamadas lo enmascara.",
    group: "pnr",
    type: "sesion",
    source: "Uso habitual",
    match: /^\*[A-Z]{6}$/u,
  },
  {
    template: "*R",
    description: "Vuelve a mostrar el PNR que está en el AAA.",
    group: "pnr",
    type: "lectura",
    source: "Prueba en CERT (Q-102)",
  },
  {
    template: "*H",
    description: "Historial del PNR en el AAA.",
    group: "pnr",
    type: "lectura",
    source: "wiki/entities/get-itinerary-history.md",
  },
  {
    template: "*FOP",
    description: "Formas de pago guardadas en el PNR (Sabre Wallet).",
    group: "pnr",
    type: "lectura",
    source: "wiki/concepts/formas-de-pago-en-el-pnr.md",
  },
  {
    template: "*IM",
    description:
      "Muestra los mensajes direct connect de la aerolínea. Después se puede reintentar End Transaction.",
    group: "pnr",
    type: "lectura",
    source: END_TRANSACTION,
  },
  {
    template: "I",
    description: "Ignora los cambios y saca el PNR del AAA.",
    group: "pnr",
    type: "sesion",
    source: "Uso habitual",
    match: "exact",
  },
  {
    template: "IR",
    description: "Ignora los cambios y vuelve a mostrar el PNR.",
    group: "pnr",
    type: "sesion",
    source: "Uso habitual",
    match: "exact",
  },
  {
    template: "E",
    description: "Cierra el PNR (End Transaction).",
    group: "pnr",
    type: "escritura",
    source: "Uso habitual",
    match: "exact",
  },
  {
    template: "ER",
    description: "Cierra el PNR (End Transaction) y lo vuelve a mostrar.",
    group: "pnr",
    type: "escritura",
    source: "Uso habitual",
    match: "exact",
  },
  // Colas
  {
    template: "QC/<PCC><q>",
    description: "Cuenta los PNR de una cola (p. ej. QC/IPCC19, QC/IPCC1A).",
    group: "colas",
    type: "lectura",
    source: "Design de QueueCountLLSRQ",
  },
  {
    template: "QA/<PCC><q>",
    description: "Análisis de la actividad de una cola.",
    group: "colas",
    type: "lectura",
    source: "Design de QueueAnalysisLLSRQ",
  },
  {
    template: "Q/<PCC><q>",
    description: "Entra a una cola. Ya hay API: session.queue.access.",
    group: "colas",
    type: "sesion",
    source: "Uso habitual (sin fuente de formato)",
  },
  {
    template: "QR",
    description: "Saca el PNR de la cola.",
    group: "colas",
    type: "escritura",
    source: "QueueAccessLLSRQ (el design no explica cada acción)",
  },
  {
    template: "QXI",
    description: "Navegación dentro de una cola.",
    group: "colas",
    type: "sesion",
    source: "QueueAccessLLSRQ (el design no explica cada acción)",
  },
  {
    template: "QXIR",
    description: "Navegación dentro de una cola.",
    group: "colas",
    type: "sesion",
    source: "QueueAccessLLSRQ (el design no explica cada acción)",
  },
  {
    template: "QXE",
    description: "Navegación dentro de una cola.",
    group: "colas",
    type: "sesion",
    source: "QueueAccessLLSRQ (el design no explica cada acción)",
  },
  {
    template: "QP/<PCC><q>/<pic>",
    description:
      "Coloca el PNR del AAA en una cola. Ya hay API: session.queue.place.",
    group: "colas",
    type: "escritura",
    source: "wiki/sources/sabre-legacy-client-1-0-8.md",
  },
  {
    template: "QP/YES",
    description: "Confirma una colocación pendiente por Global Security.",
    group: "colas",
    type: "escritura",
    source: "Design de QueuePlaceLLSRQ",
  },
  {
    template: "QP/NO",
    description: "Rechaza una colocación pendiente por Global Security.",
    group: "colas",
    type: "escritura",
    source: "Design de QueuePlaceLLSRQ",
  },
  // Reportes y utilidades
  {
    template: "DQB*<DDMMMYY>/<PCC>",
    description:
      "Ventas del día (el «Report»). Ya hay API: session.reporting.dailySalesSummary.",
    group: "reportes",
    type: "lectura",
    source: "wiki/sources/dqb-prueba-2026-11-12.md",
  },
  {
    template: "DC¥<moneda><monto>/<moneda>/<fecha>",
    description:
      "Conversión de moneda en una fecha (ejemplo: DC¥USD1/MXN/20MAR25).",
    group: "reportes",
    type: "lectura",
    source: "wiki/entities/send-sabre-command.md (prueba de 1.0.8)",
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
  {
    template: "PE*<PCC>/STAGE",
    description: "Como PE*<PCC>, con una LNIATA por línea.",
    group: "impresoras",
    type: "lectura",
    source: PRINTERS,
  },
  {
    template: "PP*",
    description: "Muestra el perfil de impresora (qué hay en PTR/, W*, DSIV).",
    group: "impresoras",
    type: "lectura",
    source: `Sample oficial (${DESIGNATE})`,
  },
  {
    template: "PPS<n>",
    description: "Designa el perfil de impresora n.",
    group: "impresoras",
    type: "sesion",
    source: PRINTERS,
  },
  {
    template: "PPS",
    description: "Designa el perfil de impresora predeterminado.",
    group: "impresoras",
    type: "sesion",
    source: PRINTERS,
  },
  {
    template: "PPO",
    description: "Quita el perfil de impresora.",
    group: "impresoras",
    type: "sesion",
    source: PRINTERS,
  },
  {
    template: "W*<tipo><dirección>",
    description:
      "Designa la impresora de boletos (AB ATB1, AT ATB2, o el código de tipo del país). Con dirección, exige stock de boletos asignado.",
    group: "impresoras",
    type: "sesion",
    source: PRINTERS,
  },
  {
    template: "W*<código>",
    description:
      "TEO (Total Printer Bypass): designa la impresora de boletos sin LNIATA, sin stock y sin SCN. BSP: el código del mercado (W*MX para México). ARC: W*AT (ATB2) o W*AB (ATB). E-TAT: W*1Y (genérico) o W*1R (especializado). No hay código US.",
    group: "impresoras",
    type: "sesion",
    source: TEO,
  },
  {
    template: "W*NO",
    description: "Quita la impresora de boletos.",
    group: "impresoras",
    type: "sesion",
    source: PRINTERS,
  },
  {
    template: "PTR/<dirección>",
    description:
      "Designa la impresora de copias en el área actual (/1 o /2 al final define el interlineado). Hace falta para emitir un boleto electrónico (-0370).",
    group: "impresoras",
    type: "sesion",
    source: PRINTERS,
  },
  {
    template: "PTR/<dirección>*",
    description: "Designa la impresora de copias en todas las áreas.",
    group: "impresoras",
    type: "sesion",
    source: PRINTERS,
  },
  {
    template: "PTR/END",
    description: "Quita la impresora de copias.",
    group: "impresoras",
    type: "sesion",
    source: PRINTERS,
  },
  {
    template: "DSIV<LNIATA>",
    description: "Designa la impresora de factura e itinerario.",
    group: "impresoras",
    type: "sesion",
    source: `Sample oficial (${DESIGNATE})`,
  },
  {
    template: "DSNO",
    description: "Quita la impresora de factura e itinerario.",
    group: "impresoras",
    type: "sesion",
    source: `Sample oficial (${DESIGNATE})`,
  },
  // Emisión y precio
  {
    template: "WPNI",
    description:
      "Búsqueda de tarifas (Bargain Finder Plus). Cuenta como búsqueda «Worldfare» y se cobra más caro.",
    group: "emision",
    type: "lectura",
    source: SEND_COMMAND,
  },
  {
    template: "JR",
    description:
      "Búsqueda de itinerarios (Tripsearch). Cuenta como búsqueda «Worldfare» y se cobra más caro.",
    group: "emision",
    type: "lectura",
    source: SEND_COMMAND,
  },
  {
    template: "W¥…",
    description:
      "Emite (formato de emisión). Ya hay API: Fulfill Flight Tickets. Bloqueado en la consola: en CERT se emite por Fulfill.",
    group: "emision",
    type: "emite",
    source: "wiki/concepts/emision-de-boletos.md",
  },
]
