/**
 * Indenta un documento XML para leerlo (el sobre SOAP llega en una sola línea). No valida ni
 * reescribe nada: solo parte en líneas y agrega sangría, así que el texto, los atributos y
 * el `[REDACTED]` del token quedan tal cual. Si el XML no cierra bien, devuelve el original.
 *
 * - Un elemento con solo texto (`<a>1</a>`) queda en una línea.
 * - Los comentarios, `CDATA` y `<?xml … ?>` van en su propia línea, sin tocarlos.
 * - Los espacios entre etiquetas se descartan; el texto con contenido se conserva.
 */
export function formatXml(xml: string, indent = "  "): string {
  const tokens = xml
    .split(/(<!\[CDATA\[[\s\S]*?\]\]>|<!--[\s\S]*?-->|<[^>]+>)/)
    .filter((token) => token.trim() !== "")
  const lines: string[] = []
  let depth = 0

  const push = (text: string) => lines.push(indent.repeat(depth) + text)
  const isTag = (token: string | undefined) => token?.startsWith("<") ?? false
  const isClose = (token: string | undefined) =>
    token?.startsWith("</") ?? false

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    if (!isTag(token)) {
      push(token.trim())
    } else if (isClose(token)) {
      depth--
      if (depth < 0) return xml
      push(token)
    } else if (
      token.startsWith("<?") ||
      token.startsWith("<!") ||
      token.endsWith("/>")
    ) {
      push(token)
    } else if (isClose(tokens[i + 1])) {
      // `<a></a>`
      push(token + tokens[i + 1])
      i++
    } else if (!isTag(tokens[i + 1]) && isClose(tokens[i + 2])) {
      // `<a>texto</a>`
      push(token + tokens[i + 1] + tokens[i + 2])
      i += 2
    } else {
      push(token)
      depth++
    }
  }
  return depth === 0 ? lines.join("\n") : xml
}
