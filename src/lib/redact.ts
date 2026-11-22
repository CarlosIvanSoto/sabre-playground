/**
 * Redacción del hallazgo (F6.2, #24). Lo que se copia a la wiki no lleva token ni datos
 * personales: nombres, apellidos, emails, teléfonos, documentos, programas de viajero
 * frecuente, direcciones y fechas de nacimiento pasan a los valores sintéticos de
 * estrategia-de-testing (`TEST`/`PASSENGER`, `test@example.com`). Se conservan localizador,
 * segmentos, clases, tarifas, impuestos y códigos de error.
 *
 * Tres pasadas, en orden:
 *
 * 1. Por estructura: en JSON, por el nombre de la clave (`givenName`, `phones`,
 *    `identityDocuments`…); en XML (SOAP), por el nombre del elemento o del atributo
 *    (`GivenName`, `Email`, `PhoneNumber`, `DocID`…). Cada valor real que se reemplaza se
 *    guarda.
 * 2. Por valor: los valores guardados se reemplazan en todo el resto del texto (un apellido
 *    que reaparece en un remark, en el párrafo del PNR o en la entrada del paso).
 * 3. Por forma: emails en cualquier texto (también con `¤` o `‡`, como los escribe el host), y
 *    en las líneas del párrafo de host, la línea de nombre (`1.1APELLIDO/NOMBRE`) y los
 *    números de teléfono.
 *
 * En XML (SOAP), además, va una lista blanca después de la pasada 1: un atributo o un texto
 * queda tal cual solo si su nombre es de los conocidos (`Action`, `RPH`, `FlightNumber`,
 * `LocationCode`…) o su valor es un código corto. Lo demás se enmascara: letras a `X` y
 * dígitos a `9`, y el texto libre (`<Text>` de `GeneralInfo` y `Remark`, la pantalla de un
 * comando) por `maskLine` de `sabre-client/anonymize`, que deja pasar solo las líneas de su
 * propia lista blanca. Sabre mete tarjeta, vencimiento, autorización, DOCS y boleto en texto
 * libre (TravelItineraryHistoryLLSRS, 2026-11-22): una lista negra por nombre no los ve.
 *
 * Al final, sobre todo el texto (también JSON), una red por forma: secuencias de 13 a 19
 * dígitos (tarjeta, boleto) con su vencimiento, y lo que sigue a `AUTH`, `APV`, `DOCS`, `FOID`
 * o `TKNE`.
 *
 * Es una red de seguridad, no una garantía: el bloque se revisa antes de pegarlo.
 */

import { createAnonymizer } from "sabre-client/anonymize"

export const SYNTHETIC = {
  givenName: "PASSENGER",
  surname: "TEST",
  email: "test@example.com",
  phone: "5555555555",
  document: "X0000000",
  loyalty: "0000000000",
  birthDate: "1980-01-01",
  address: "TEST ADDRESS",
  fullName: "TEST/PASSENGER",
  secret: "[REDACTED]",
} as const

/** `masked` no tiene valor sintético: el dato se enmascara con su forma (`X` y `9`). */
type Kind = keyof typeof SYNTHETIC | "masked"

const SYNTHETIC_VALUES = new Set(
  Object.values(SYNTHETIC).map((value) => value.toUpperCase())
)

/** Si un valor ya salió de la redacción: un sintético o una fecha sintética. */
function isSynthetic(value: string): boolean {
  const upper = value.trim().toUpperCase()
  return (
    SYNTHETIC_VALUES.has(upper) ||
    upper === "01JAN80" ||
    upper.startsWith(SYNTHETIC.birthDate)
  )
}

/** Letras a `X` y dígitos a `9`, como `sabre-client/anonymize`. */
export const shapeMask = (text: string) =>
  text.replace(/\p{L}/gu, "X").replace(/\p{N}/gu, "9")

/** Lo que la pasada estructural encontró: valor real → tipo. */
type Learned = Map<string, Kind>

// ── Claves JSON ──────────────────────────────────────────────────────────────

/** Clave → tipo, para valores sueltos. Se compara sin mayúsculas ni `_`/`-`. */
const KEY_KIND: Record<string, Kind> = {
  givenname: "givenName",
  firstname: "givenName",
  middlename: "givenName",
  surname: "surname",
  lastname: "surname",
  familyname: "surname",
  email: "email",
  emailaddress: "email",
  phone: "phone",
  phonenumber: "phone",
  telephone: "phone",
  mobile: "phone",
  fax: "phone",
  documentnumber: "document",
  docnumber: "document",
  docid: "document",
  passportnumber: "document",
  birthdate: "birthDate",
  dateofbirth: "birthDate",
  dob: "birthDate",
  programnumber: "loyalty",
  membershipid: "loyalty",
  frequentflyernumber: "loyalty",
  loyaltynumber: "loyalty",
  accesstoken: "secret",
  token: "secret",
  authorization: "secret",
  password: "secret",
  clientsecret: "secret",
  binarysecuritytoken: "secret",
  cardnumber: "masked",
  cardsecuritycode: "masked",
  securitycode: "masked",
  cvv: "masked",
  expirationdate: "masked",
  expirydate: "masked",
  expiredate: "masked",
  ticketnumber: "masked",
  approvalcode: "masked",
  authorizationcode: "masked",
  invoicenumber: "masked",
  receivedfrom: "masked",
  customername: "fullName",
}

/**
 * Claves de texto libre: el valor entero pasa por `maskLine` (lista blanca de líneas de
 * `sabre-client/anonymize`). Ahí van remarks, SSR y mensajes de host.
 */
const FREE_TEXT_KEYS = new Set(["text", "freetext", "fulltext", "remark"])

/** SSR que llevan datos del pasajero en `message`/`text`: el texto entero se enmascara. */
const SENSITIVE_SSR = new Set([
  "DOCS",
  "DOCA",
  "DOCO",
  "FOID",
  "TKNE",
  "CTCE",
  "CTCM",
  "CTCR",
  "PCTC",
  "FQTV",
])

/**
 * Claves cuyo contenido entero es de un tipo: `emails: ["…"]`, `phones: [{ number, label }]`.
 * Adentro, solo se reemplazan los textos que parecen el dato (un email, algo con dígitos), para
 * no tocar `label: "M"` ni `type`.
 */
const CONTAINER_KIND: Record<string, Kind> = {
  emails: "email",
  phones: "phone",
  emergencyphones: "phone",
  faxes: "phone",
  address: "address",
  addresses: "address",
}

/** Dentro de estas claves, `number` es el dato: `loyaltyPrograms[].number`, documentos. */
const NUMBER_CONTAINERS: Record<string, Kind> = {
  loyaltyprograms: "loyalty",
  loyaltyprogramaccounts: "loyalty",
  identitydocuments: "document",
  phones: "phone",
  tickets: "masked",
  flighttickets: "masked",
  formsofpayment: "masked",
  payments: "masked",
}

const normalize = (key: string) => key.toLowerCase().replace(/[_-]/g, "")

const EMAIL = /[\w.+-]+[@¤‡][\w-]+(?:\.[\w-]+)+/g
const DIGITS = /\d/

/** Si el texto, dentro de un contenedor del tipo, es el dato y no una etiqueta. */
function looksLike(kind: Kind, text: string): boolean {
  if (kind === "email") return /[@¤‡]/.test(text)
  if (kind === "phone") return (text.match(/\d/g)?.length ?? 0) >= 5
  if (kind === "address") return text.trim().length > 3
  return DIGITS.test(text)
}

/** Fecha sintética con la misma forma que la real. */
function syntheticDate(real: string): string {
  if (/^\d{4}-\d{2}-\d{2}/.test(real))
    return SYNTHETIC.birthDate + real.slice(10)
  if (/^\d{2}[A-Z]{3}\d{2}$/.test(real)) return "01JAN80"
  return SYNTHETIC.birthDate
}

function synthetic(kind: Kind, real: string): string {
  if (kind === "masked") return shapeMask(real)
  return kind === "birthDate" ? syntheticDate(real) : SYNTHETIC[kind]
}

/** Tratamientos que siguen al nombre (`TESTER/UNO MR`): no se aprenden. */
const TITLES = new Set(["MR", "MRS", "MS", "MISS", "MSTR", "CHD", "INF", "SR"])

function learn(learned: Learned, kind: Kind, value: string) {
  if (kind === "fullName") {
    // `APELLIDO/NOMBRE`, `1.1APELLIDO/NOMBRE MR`: cada parte por separado, para que también
    // se reemplace donde aparece suelta.
    const [surname = "", ...given] = value
      .replace(/^\s*\d+(?:\.\d+)?/, "")
      .split("/")
    learn(learned, "surname", surname)
    for (const part of given.join(" ").split(/\s+/)) {
      if (!TITLES.has(part.toUpperCase())) learn(learned, "givenName", part)
    }
    return
  }
  const trimmed = value.trim()
  // Valores cortos ("M", "MR", "1") reemplazados por valor romperían todo el texto.
  if (trimmed.length < 3 || kind === "secret") return
  // Un valor que ya es sintético, de cualquier tipo, no se aprende: en CERT el PNR puede traer
  // `givenName: "TEST"`, y aprenderlo reemplazaría el `TEST` del apellido ya redactado.
  if (SYNTHETIC_VALUES.has(trimmed.toUpperCase())) return
  if (trimmed === synthetic(kind, trimmed)) return
  learned.set(trimmed, kind)
}

function redactValue(
  value: unknown,
  learned: Learned,
  context: { kind?: Kind; numberKind?: Kind } = {}
): unknown {
  if (typeof value === "string") {
    if (context.kind !== undefined && looksLike(context.kind, value)) {
      learn(learned, context.kind, value)
      return synthetic(context.kind, value)
    }
    return value
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, learned, context))
  }
  if (typeof value !== "object" || value === null) return value

  const out: Record<string, unknown> = {}
  // `{ code: "DOCS", message: "P/MEX/…" }`: en un SSR con datos del pasajero, todo texto que no
  // sea el código o el estado se enmascara.
  const ssr = Object.entries(value).some(
    ([key, child]) =>
      ["code", "type", "name"].includes(normalize(key)) &&
      typeof child === "string" &&
      SENSITIVE_SSR.has(child.trim().toUpperCase())
  )
  for (const [key, child] of Object.entries(value)) {
    const k = normalize(key)
    if (
      typeof child === "string" &&
      (FREE_TEXT_KEYS.has(k) ||
        (ssr && !["code", "type", "name", "status", "airlinecode"].includes(k)))
    ) {
      out[key] = maskFreeText(child)
      continue
    }
    if (Array.isArray(child) && FREE_TEXT_KEYS.has(k)) {
      out[key] = child.map((line) =>
        typeof line === "string" ? maskFreeText(line) : line
      )
      continue
    }
    const kind = KEY_KIND[k]
    if (
      kind !== undefined &&
      (typeof child === "string" || typeof child === "number")
    ) {
      const text = String(child)
      learn(learned, kind, text)
      out[key] = synthetic(kind, text)
      continue
    }
    if (k === "number" && context.numberKind !== undefined && child !== null) {
      const text = String(child)
      learn(learned, context.numberKind, text)
      out[key] = synthetic(context.numberKind, text)
      continue
    }
    out[key] = redactValue(child, learned, {
      kind: CONTAINER_KIND[k] ?? kind ?? context.kind,
      numberKind: NUMBER_CONTAINERS[k] ?? context.numberKind,
    })
  }
  return out
}

// ── XML ──────────────────────────────────────────────────────────────────────

/** Elementos y atributos (nombre local, sin prefijo) con un dato personal. */
const XML_KIND: Record<string, Kind> = {
  GivenName: "givenName",
  FirstName: "givenName",
  MiddleName: "givenName",
  Surname: "surname",
  LastName: "surname",
  Email: "email",
  EmailAddress: "email",
  PhoneNumber: "phone",
  Phone: "phone",
  Telephone: "phone",
  DocumentNumber: "document",
  DocID: "document",
  DocNumber: "document",
  BirthDate: "birthDate",
  DateOfBirth: "birthDate",
  MembershipID: "loyalty",
  AddressLine: "address",
  StreetNmbr: "address",
  BinarySecurityToken: "secret",
  CustomerName: "fullName",
  PersonName: "fullName",
  ReceivedFrom: "masked",
}

// ── Lista blanca de XML ──────────────────────────────────────────────────────

/**
 * Atributos (nombre local) que quedan tal cual: estructura, segmentos, estados, importes y
 * fechas. `ID` solo en `UniqueID` (el localizador del paso); en `SupplierRef` lleva el
 * localizador de la aerolínea. Ni PCC, ni sine, ni `Number`: en `PaymentCard` es la tarjeta y
 * en `Document`, el boleto.
 */
const SAFE_ATTRIBUTES = new Set([
  "Action",
  "RPH",
  "Type",
  "type",
  "Status",
  "status",
  "Code",
  "CodeContext",
  "TaxCode",
  "LocationCode",
  "FlightNumber",
  "ResBookDesigCode",
  "DepartureDateTime",
  "ArrivalDateTime",
  "CreateDateTime",
  "CreationAgentDutyCode",
  "CreationAgentFunctionCode",
  "NumberInParty",
  "ConnectionInd",
  "eTicket",
  "Amount",
  "CurrencyCode",
  "DecimalPlaces",
  "Ind",
  "ConjunctedCount",
  "NameNumber",
  "LinkCode",
  "SegmentNumber",
  "Version",
  "version",
  "timeStamp",
  "TimeStamp",
  "Timestamp",
  "DateTime",
  "valueType",
  "ValueType",
  "EncodingType",
  "encoding",
  "mustUnderstand",
  "isQueryStillRunning",
  "chunkNumber",
  "maxChunks",
])

/** `Elemento@Atributo` que quedan tal cual aunque el atributo no esté en la lista general. */
const SAFE_ELEMENT_ATTRIBUTES = new Set(["UniqueID@ID", "Seat@Number"])

/** Elementos cuyo texto queda tal cual: cabecera SOAP y errores. */
const SAFE_TEXT_ELEMENTS = new Set([
  "Service",
  "Action",
  "MessageId",
  "RefToMessageId",
  "ConversationId",
  "Timestamp",
  "Message",
  "ErrorCode",
  "System",
])

/**
 * Atributos que nunca pasan por la forma corta: un PCC de 3 letras, un sine de 2, un sexo de
 * una. Se enmascaran siempre que no estén en la lista blanca.
 */
const NEVER_SHORT =
  /pseudo|cpaid|agent|received|name|number|card|birth|gender|sex|expir|auth|approv|security|invoice|ticket/i

/** Un valor que se deja pasar por su forma: vacío, booleano o código de hasta 3 caracteres. */
const SAFE_SHAPE = /^(?:\s*|true|false|[A-Z0-9*]{1,3})$/

const encodeXml = (text: string) =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")

/** Texto libre: cada línea por `maskLine` (lista blanca de líneas de host del SDK). */
function maskFreeText(text: string): string {
  const { maskLine } = createAnonymizer()
  return text
    .split("\n")
    .map((line) => maskLine(line))
    .join("\n")
}

const localName = (name: string) => name.slice(name.indexOf(":") + 1)

function redactXmlAttributes(tag: string, element: string): string {
  return tag.replace(
    /(\s)([\w.:-]+)(\s*=\s*)(?:"([^"]*)"|'([^']*)')/g,
    (
      match,
      space: string,
      name: string,
      eq: string,
      double: string | undefined,
      single: string | undefined
    ) => {
      const quote = double === undefined ? "'" : '"'
      const value = double ?? single ?? ""
      const local = localName(name)
      if (
        name.startsWith("xmlns") ||
        name.startsWith("xsi:") ||
        SAFE_ATTRIBUTES.has(local) ||
        SAFE_ELEMENT_ATTRIBUTES.has(`${element}@${local}`) ||
        isSynthetic(value) ||
        (!NEVER_SHORT.test(local) && SAFE_SHAPE.test(value))
      ) {
        return match
      }
      return `${space}${name}${eq}${quote}${shapeMask(decodeXml(value))}${quote}`
    }
  )
}

function redactXmlText(text: string, element: string | undefined): string {
  if (
    text.trim() === "" ||
    (element !== undefined && SAFE_TEXT_ELEMENTS.has(element)) ||
    isSynthetic(text) ||
    SAFE_SHAPE.test(text.trim())
  ) {
    return text
  }
  return encodeXml(maskFreeText(decodeXml(text)))
}

/**
 * La lista blanca sobre un documento XML, ya con la pasada estructural. Recorre las etiquetas
 * con una pila para saber de qué elemento es cada texto.
 */
function redactXmlWhitelist(xml: string): string {
  const stack: string[] = []
  let out = ""
  let last = 0
  for (const match of xml.matchAll(
    /<!\[CDATA\[([\s\S]*?)\]\]>|<!--[\s\S]*?-->|<[^>]*>/g
  )) {
    const token = match[0]
    out += redactXmlText(xml.slice(last, match.index), stack.at(-1))
    last = match.index + token.length
    if (token.startsWith("<![CDATA[")) {
      const element = stack.at(-1)
      out +=
        element !== undefined && SAFE_TEXT_ELEMENTS.has(element)
          ? token
          : `<![CDATA[${maskFreeText(match[1] ?? "")}]]>`
    } else if (token.startsWith("<!--")) {
      // Un comentario no trae nada que haga falta, y puede traer cualquier cosa.
      out += `<!--${maskFreeText(token.slice(4, -3))}-->`
    } else if (token.startsWith("<!") || token.startsWith("<?")) {
      out += token
    } else if (token.startsWith("</")) {
      stack.pop()
      out += token
    } else {
      const name = localName(/^<\s*([\w.:-]+)/.exec(token)?.[1] ?? "")
      out += redactXmlAttributes(token, name)
      if (!token.endsWith("/>")) stack.push(name)
    }
  }
  return out + redactXmlText(xml.slice(last), stack.at(-1))
}

const decodeXml = (text: string) =>
  text
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&")

function redactXmlStructure(xml: string, learned: Learned): string {
  const names = Object.keys(XML_KIND).join("|")
  // `<ns:GivenName attr="…">texto</ns:GivenName>`: solo el texto.
  const element = new RegExp(
    `(<(?:[\\w-]+:)?(${names})\\b[^>]*>)([^<]*)(</(?:[\\w-]+:)?\\2>)`,
    "g"
  )
  // `GivenName="…"` en cualquier elemento.
  const attribute = new RegExp(`(\\s(?:[\\w-]+:)?(${names})=")([^"]*)(")`, "g")
  const replace = (
    _match: string,
    open: string,
    name: string,
    text: string,
    close: string
  ) => {
    const kind = XML_KIND[name] as Kind
    if (text.trim() === "") return `${open}${text}${close}`
    learn(learned, kind, decodeXml(text))
    return `${open}${synthetic(kind, text.trim())}${close}`
  }
  return xml.replace(element, replace).replace(attribute, replace)
}

// ── Texto ────────────────────────────────────────────────────────────────────

const escapeRegExp = (text: string) =>
  text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

/** Pasada 2: los valores reales que se aprendieron, en cualquier parte del texto. */
function replaceLearned(text: string, learned: Learned): string {
  // Los más largos primero: "MARIA JOSE" antes que "MARIA".
  const values = [...learned.keys()].sort((a, b) => b.length - a.length)
  let out = text
  for (const value of values) {
    const kind = learned.get(value) as Kind
    const pattern = new RegExp(
      `(?<![\\w])${escapeRegExp(value)}(?![\\w])`,
      "gi"
    )
    out = out.replace(pattern, synthetic(kind, value))
  }
  return out
}

/** `1.1APELLIDO/NOMBRE MR` y `1.2APELLIDO/NOMBRE` en la misma línea. */
const HOST_NAME =
  /(\b\d{1,2}\.\d{1,2})([A-Z][A-Z'-]*(?: [A-Z][A-Z'-]*)*)\/([A-Z][A-Z' ]*?[A-Z])(?=\s{2,}|\s+\d|\*|$|\s+(?:MR|MRS|MS|MISS|MSTR|CHD|INF)\b)/g
/** Un teléfono en una línea de host: 7 o más dígitos, con espacios o guiones en medio. */
const HOST_PHONE = /\d[\d -]{5,}\d/g

/** Pasada 3 en una línea del párrafo de host. */
function redactHostLine(line: string): string {
  let out = line.replace(
    HOST_NAME,
    `$1${SYNTHETIC.surname}/${SYNTHETIC.givenName}`
  )
  // Los teléfonos van en `9.XXX999 9999999-X`; una tarifa lleva punto decimal y no matchea.
  if (/^\s*\d+\.[A-Z]{3}/.test(out)) {
    out = out.replace(HOST_PHONE, SYNTHETIC.phone)
  }
  return out
}

function redactEmails(text: string): string {
  return text.replace(EMAIL, SYNTHETIC.email)
}

/**
 * Grupos de 3 o más dígitos separados por un espacio o guion (`4111 1111 1111 1111`,
 * `139-0000000001`), con el vencimiento detrás si lo hay (`/0228`, `/02/28`). Una fecha
 * (`2026-11-22`) tiene grupos de 2 y no entra.
 */
const DIGIT_RUN =
  /(?<!\d)(\d{3,}(?:[ -]\d{3,})*)(\s*\/\s*\d{2}\/?\d{2}(?!\d))?/g

/** Si los dígitos pasan el dígito verificador de Luhn, como todo número de tarjeta. */
function luhn(digits: string): boolean {
  let sum = 0
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i])
    if (i % 2 === 1) {
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
  }
  return sum % 10 === 0
}

/**
 * Solo tarjetas: 13 a 19 dígitos que pasan Luhn, con su vencimiento detrás. Es lo que se tapa
 * en el servidor antes de mandar el request y la respuesta crudos al navegador (pestaña
 * Crudo). Un boleto que por azar pase Luhn también se tapa; el resultado tipado no se toca.
 */
export function maskCardNumbers(text: string): string {
  return text.replace(DIGIT_RUN, (match, digits: string) => {
    const plain = digits.replace(/\D/g, "")
    return plain.length >= 13 && plain.length <= 19 && luhn(plain)
      ? shapeMask(match)
      : match
  })
}

/** Lo que sigue a estas palabras, hasta el fin de línea, comilla o etiqueta, se enmascara. */
const SENSITIVE_TAIL =
  /\b(AUTH|APV|APPROVAL CODE|EXP|DOCS|DOCA|DOCO|FOID|TKNE|CTCE|CTCM|FQTV)\b([^\n"<]*)/g

/**
 * La red por forma, sobre cualquier texto: tarjetas y boletos (13 a 19 dígitos) con su
 * vencimiento, y el resto de una autorización, un vencimiento o un SSR con datos del pasajero.
 */
export function redactForms(text: string): string {
  return text
    .replace(DIGIT_RUN, (match, digits: string) =>
      digits.replace(/\D/g, "").length >= 13 ? shapeMask(match) : match
    )
    .replace(
      SENSITIVE_TAIL,
      (_match, word: string, tail: string) => `${word}${shapeMask(tail)}`
    )
}

function redactStringsDeep(
  value: unknown,
  fix: (text: string) => string
): unknown {
  if (typeof value === "string") return fix(value)
  if (Array.isArray(value))
    return value.map((item) => redactStringsDeep(item, fix))
  if (typeof value !== "object" || value === null) return value
  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [
      key,
      // `paragraph: ["…", "…"]` del resultado de colas: líneas de host.
      normalize(key) === "paragraph" && Array.isArray(child)
        ? child.map((line) =>
            typeof line === "string" ? fix(redactHostLine(line)) : line
          )
        : redactStringsDeep(child, fix),
    ])
  )
}

// ── API ──────────────────────────────────────────────────────────────────────

/**
 * Un redactor para un hallazgo: todas sus partes pasan por el mismo, así un valor que se
 * aprende en la respuesta cruda también se reemplaza en la entrada y en el error. Primero
 * `learn*` con todo, después `text`/`value`.
 */
export function createRedactor() {
  const learned: Learned = new Map()

  return {
    /** Pasada 1 sobre un valor JSON. Devuelve el valor con la estructura redactada. */
    structure(value: unknown): unknown {
      return redactValue(value, learned)
    },
    /** Pasada 1 sobre un body crudo: JSON o XML. */
    body(body: string): string {
      const trimmed = body.trim()
      if (trimmed.startsWith("<")) {
        return redactXmlWhitelist(redactXmlStructure(body, learned))
      }
      try {
        return JSON.stringify(redactValue(JSON.parse(body), learned))
      } catch {
        return body
      }
    },
    /** Pasadas 2 y 3 y la red por forma sobre un texto ya estructurado. */
    text(text: string): string {
      return redactForms(redactEmails(replaceLearned(text, learned)))
    },
    /** Pasadas 2 y 3 y la red por forma sobre cada texto de un valor JSON. */
    value(value: unknown): unknown {
      return redactStringsDeep(value, (text) =>
        redactForms(redactEmails(replaceLearned(text, learned)))
      )
    },
    /** Cuántos valores reales distintos se reemplazaron por estructura. */
    get learnedCount(): number {
      return learned.size
    },
  }
}
