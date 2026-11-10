"use client"

import { PlusIcon, XIcon } from "lucide-react"
import { type ReactNode, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { FieldDescription, FieldLegend, FieldSet } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { SELECTION_CODES, type SelectionRow } from "@/lib/queues"

/**
 * El editor de `selection` (F13.1, F13.2): filas `{ function, criteria }` que se agregan y se
 * quitan, controlado desde un `Controller` de react-hook-form. No limita la cantidad ni los
 * códigos: lo valida el SDK, y su `TypeError` se ve como el error del paso.
 *
 * `codes` elige qué códigos de la ayuda se muestran; `note`, una línea más (por ejemplo, qué
 * acepta `list`). La ayuda va como chips: un clic agrega una fila con ese código, y el título
 * dice qué filtra. `hideLegend` deja la leyenda solo para lectores de pantalla (la mesa, donde
 * el popover ya tiene título).
 */
export function SelectionField({
  id,
  value,
  onChange,
  codes = SELECTION_CODES.map(({ code }) => code),
  note,
  hideLegend = false,
}: {
  id: string
  value: SelectionRow[]
  onChange: (rows: SelectionRow[]) => void
  codes?: readonly string[]
  note?: ReactNode
  hideLegend?: boolean
}) {
  // Claves estables para las filas: quitar una del medio no le pasa el foco a la siguiente.
  const next = useRef(value.length)
  const [keys, setKeys] = useState(() => value.map((_, index) => index))
  const rowKeys =
    keys.length === value.length ? keys : value.map((_, index) => index)

  const add = (code = "") => {
    setKeys([...rowKeys, next.current++])
    onChange([...value, { function: code, criteria: "" }])
  }
  const remove = (index: number) => {
    setKeys(rowKeys.filter((_, i) => i !== index))
    onChange(value.filter((_, i) => i !== index))
  }
  const edit = (index: number, row: Partial<SelectionRow>) =>
    onChange(value.map((item, i) => (i === index ? { ...item, ...row } : item)))

  const help = SELECTION_CODES.filter(({ code }) => codes.includes(code))
  return (
    <FieldSet className="gap-2">
      <FieldLegend
        variant="label"
        className={hideLegend ? "sr-only" : undefined}
      >
        selection (opcional)
      </FieldLegend>
      {value.length > 0 && (
        <ul className="flex flex-col gap-2" aria-label="Filtros">
          {value.map((row, index) => (
            <li key={rowKeys[index]} className="flex items-center gap-2">
              <Input
                id={`${id}-function-${index}`}
                aria-label={`Filtro ${index + 1}: function`}
                placeholder="QD"
                maxLength={3}
                className="w-16 font-mono uppercase"
                value={row.function}
                onChange={(event) =>
                  edit(index, { function: event.target.value })
                }
              />
              <Input
                id={`${id}-criteria-${index}`}
                aria-label={`Filtro ${index + 1}: criteria`}
                placeholder="05NOV"
                className="font-mono uppercase"
                value={row.criteria}
                onChange={(event) =>
                  edit(index, { criteria: event.target.value })
                }
              />
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label={`Quitar el filtro ${index + 1}`}
                onClick={() => remove(index)}
              >
                <XIcon />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-1">
        <Button type="button" size="xs" variant="outline" onClick={() => add()}>
          <PlusIcon />
          Filtro
        </Button>
        {help.map(({ code, meaning, example }) => (
          <Button
            key={code}
            type="button"
            size="xs"
            variant="ghost"
            className="font-mono"
            title={`${code}: ${meaning} (${example})`}
            onClick={() => add(code)}
          >
            {code}
          </Button>
        ))}
      </div>
      <FieldDescription>
        Hasta 8 según el SDK: la consola no lo limita, y el{" "}
        <code>TypeError</code> sale en el paso.
      </FieldDescription>
      {note !== undefined && <FieldDescription>{note}</FieldDescription>}
    </FieldSet>
  )
}
