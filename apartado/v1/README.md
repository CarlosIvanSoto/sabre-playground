# Apartado de la v1

Piezas de la v1 (tag `v1`) que se reutilizan en la v2. Están **fuera de `src/`** y excluidas de `tsconfig.json` y de ESLint: todavía importan `sabre-legacy-client`, `@/services/*` y TanStack Form, que ya no existen en la v2. No se compilan ni se adaptan aquí.

| Pieza | Se retoma en |
| - | - |
| `components/sabre/session-status.tsx` | F4.3 (el contador ya pasó a `src/components/session/session-timer.tsx`) |
| `components/sabre/queue-*-form.tsx` | F4.2 / F4.3 |
| `app/queue/**` (rutas por PCC y cola) | F4.2 / F4.3 |

Al adaptar cada pieza se mueve a `src/`, se pasa a `react-hook-form` + `zod` y se borra de aquí.
