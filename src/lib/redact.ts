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
 * Es una red de seguridad, no una garantía: el bloque se revisa antes de pegarlo. Este módulo
 * no importa nada, para poder probarlo suelto.
 */

export const SYNTHETIC = {
  givenName: "PASSENGER",
  surname: "TEST",
  email: "test@example.com",
  phone: "5555555555",
  document: "X0000000",
  loyalty: "0000000000",
  birthDate: "1980-01-01",
  address: "TEST ADDRESS",
  secret: "[REDACTED]",
} as const

type Kind = keyof typeof SYNTHETIC

const SYNTHETIC_VALUES = new Set(
  Object.values(SYNTHETIC).map((value) => value.toUpperCase())
)

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
}

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
  return kind === "birthDate" ? syntheticDate(real) : SYNTHETIC[kind]
}

function learn(learned: Learned, kind: Kind, value: string) {
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
  for (const [key, child] of Object.entries(value)) {
    const k = normalize(key)
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

/** El párrafo de host dentro de un sobre SOAP: cada `<Text>`. */
function redactXmlParagraph(xml: string): string {
  return xml.replace(
    /(<(?:[\w-]+:)?Text\b[^>]*>)([^<]*)(<\/(?:[\w-]+:)?Text>)/g,
    (_m, open: string, text: string, close: string) =>
      `${open}${redactHostLine(text)}${close}`
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
        return redactXmlParagraph(redactXmlStructure(body, learned))
      }
      try {
        return JSON.stringify(redactValue(JSON.parse(body), learned))
      } catch {
        return body
      }
    },
    /** Pasadas 2 y 3 sobre un texto ya estructurado. */
    text(text: string): string {
      return redactEmails(replaceLearned(text, learned))
    },
    /** Pasadas 2 y 3 sobre cada texto de un valor JSON. */
    value(value: unknown): unknown {
      return redactStringsDeep(value, (text) =>
        redactEmails(replaceLearned(text, learned))
      )
    },
    /** Cuántos valores reales distintos se reemplazaron por estructura. */
    get learnedCount(): number {
      return learned.size
    },
  }
}
