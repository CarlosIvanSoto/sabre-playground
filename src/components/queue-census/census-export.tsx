"use client"

import { CircleAlert, CircleCheck, Copy, DownloadIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  ALIAS_PATTERN,
  buildCensusExport,
  censusFileName,
  distinctPicTexts,
  validateCensusExport,
} from "@/lib/census-export"
import type { QueueCensus } from "@/lib/queue-census"

/** Cuántos problemas se listan; los demás se cuentan. */
const SHOWN_ISSUES = 20

/**
 * Exportar el censo (F10.3, #97; ADR-026): `queue-census/1`, solo si pasa el validador que falla
 * cerrado y después de revisar los textos PIC distintos. Se descarga o se copia desde el
 * navegador: nada se escribe en disco del lado del servidor, y el archivo nunca va al repo.
 */
export function CensusExport({
  census,
  pccs,
}: {
  census: QueueCensus
  /** Los PCC reales (de la sesión y de trabajo), que no pueden aparecer en el JSON. */
  pccs: string[]
}) {
  const [alias, setAlias] = useState("P1")
  const [reviewed, setReviewed] = useState(false)
  const normalized = alias.trim().toUpperCase()
  const doc = buildCensusExport(census, normalized)
  if (doc === undefined) return null

  const locators = new Set(
    census.queues.flatMap((queue) => queue.items.map((item) => item.pnr))
  )
  const issues = validateCensusExport(doc, { locators, pccs })
  const pics = distinctPicTexts(doc)
  const ok = issues.length === 0
  const ready = ok && reviewed
  const json = `${JSON.stringify(doc, null, 2)}\n`
  const filename = censusFileName(doc)
  const flagged = doc.annex.paragraphs.length

  const download = () => {
    const url = URL.createObjectURL(
      new Blob([json], { type: "application/json" })
    )
    const link = document.createElement("a")
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(json)
      toast.success("Censo copiado")
    } catch {
      toast.error(
        "No se pudo copiar: el navegador no dio acceso al portapapeles"
      )
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Exportar censo</CardTitle>
        <CardDescription>
          <code>queue-census/1</code>, con el localizador real en{" "}
          <code>pnr</code>. Va a <code>raw/sources/</code> del wiki, que es
          privado; nunca a este repo. Se descarga o se copia desde el navegador.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        <Field>
          <FieldLabel htmlFor="census-alias">Alias del PCC</FieldLabel>
          <Input
            id="census-alias"
            className="w-24 font-mono uppercase"
            maxLength={3}
            aria-invalid={!ALIAS_PATTERN.test(normalized)}
            value={alias}
            onChange={(event) => setAlias(event.target.value)}
          />
          <FieldDescription>
            <code>P1</code>, <code>P2</code>…: el censo nunca lleva el PCC real.
          </FieldDescription>
        </Field>

        <div className="flex flex-col gap-2">
          <p className="font-medium">
            Textos PIC distintos ({pics.length}): revísalos antes de exportar
          </p>
          <p className="text-muted-foreground text-xs">
            Es el único texto que viene del host, y lo programa la agencia. Si
            alguno trae un dato de pasajero o de la agencia, no exportes.
          </p>
          {pics.length === 0 ? (
            <p className="text-muted-foreground">Ningún PIC en el censo.</p>
          ) : (
            <ul className="flex flex-col gap-0.5 font-mono text-xs">
              {pics.map((pic) => (
                <li key={`${pic.code}-${pic.text ?? ""}`}>
                  {String(pic.code).padStart(3, "0")}{" "}
                  {pic.text ?? (
                    <span className="text-muted-foreground">
                      (texto descartado: no pasa la expresión)
                    </span>
                  )}{" "}
                  <span className="text-muted-foreground">×{pic.count}</span>
                </li>
              ))}
            </ul>
          )}
          <Field orientation="horizontal">
            <Checkbox
              id="census-reviewed"
              checked={reviewed}
              onCheckedChange={(checked) => setReviewed(checked === true)}
            />
            <FieldLabel htmlFor="census-reviewed" className="font-normal">
              Revisé los textos PIC
            </FieldLabel>
          </Field>
        </div>

        {ok ? (
          <Alert>
            <CircleCheck />
            <AlertTitle>El censo pasa el validador</AlertTitle>
            <AlertDescription>
              {doc.queues.length} colas,{" "}
              {doc.queues.reduce((sum, queue) => sum + queue.items.length, 0)}{" "}
              PNR
              {flagged > 0 &&
                `, ${flagged} con el párrafo enmascarado en el anexo`}
              {!doc.complete && ". Censo parado o cortado: complete es false"}.
            </AlertDescription>
          </Alert>
        ) : (
          <Alert variant="destructive">
            <CircleAlert />
            <AlertTitle>
              No se exporta: {issues.length}{" "}
              {issues.length === 1 ? "problema" : "problemas"}
            </AlertTitle>
            <AlertDescription>
              <ul className="flex flex-col gap-0.5 font-mono text-xs">
                {issues.slice(0, SHOWN_ISSUES).map((issue) => (
                  <li key={`${issue.path}-${issue.message}`}>
                    {issue.ref !== undefined && (
                      <Badge variant="outline" className="me-1">
                        {issue.ref}
                      </Badge>
                    )}
                    {issue.path || "(raíz)"}: {issue.message}
                  </li>
                ))}
              </ul>
              {issues.length > SHOWN_ISSUES && (
                <p>y {issues.length - SHOWN_ISSUES} más.</p>
              )}
            </AlertDescription>
          </Alert>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button disabled={!ready} onClick={download}>
            <DownloadIcon />
            Descargar {filename}
          </Button>
          <Button
            variant="outline"
            disabled={!ready}
            onClick={() => void copy()}
          >
            <Copy />
            Copiar JSON
          </Button>
          {ok && !reviewed && (
            <span className="text-muted-foreground text-xs">
              Primero revisa los textos PIC.
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
