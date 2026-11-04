# CLAUDE.md — sabre-playground

Consola local que consume `sabre-client@0.3.x` y recorre sus flujos paso a paso. Cada paso
muestra el resultado tipado, la respuesta cruda, el error y el log. Es la capa 3 (smoke
manual contra sandbox real) de la estrategia de testing del SDK. Antes se llamaba voya: la
v1 está en el tag `v1`.

Repo público `CarlosIvanSoto/sabre-playground`. No es una herramienta oficial de Sabre.

## Fuente de verdad

El diseño vive en el wiki `~/Obsidian/sabre-wiki`:

- Decisión del proyecto: `wiki/proyectos/sabre-playground/decisiones/consola-visual.md`
  (ADR-022): principios, los 7 flujos, qué se rescata de la v1 y qué no.
- Plan y fases: `wiki/proyectos/sabre-playground/planes/plan-v2.md`.
- Cómo se comporta el SDK: `wiki/proyectos/sabre-client/decisiones/` (ADR) y el README de
  `sabre-client`.
- Cómo se comporta Sabre: `wiki/entities/` y `wiki/concepts/`.

Si el wiki no responde algo, no se inventa: se pregunta al usuario o se abre un issue de
tipo `decisión`.

## Reglas de la consola

1. **Solo la API pública de `sabre-client`.** Nada importado de rutas internas del paquete,
   ni llamadas directas a Sabre, ni lógica del SDK copiada. Si algo cuesta usarlo desde la
   consola, es un hallazgo sobre el SDK: se anota en el wiki, no se parcha acá.
2. **Un mismo layout para todo**: formulario a la izquierda y pestañas Resultado / Crudo /
   Error / Log a la derecha, con componentes shadcn por defecto. Nada de diseño por pantalla.
3. **Solo del lado del servidor.** Credenciales en `.env.local` (ignorado por git) y
   llamadas por server actions, en módulos `server-only`. El token nunca llega al HTML ni al
   payload del cliente.
4. **CERT por defecto.** Producción, si se habilita, queda en solo lectura: Create y Cancel
   Booking prohibidos; `remove` y `place` en colas, con confirmación explícita.
5. **Datos sintéticos.** El pasajero por defecto es `TEST/PASSENGER`. Ningún dato real de
   pasajero ni PNR entra al repo: código, fixtures, capturas o tests.
6. **Sin lógica de negocio de agencia**: nada de reglas de BX3, markups, clientes
   corporativos ni políticas.
7. **El historial vive en memoria** del navegador: nada en disco ni en `localStorage`.

## Stack

El stack base está fijado en el wiki: `wiki/proyectos/sabre-playground/decisiones/stack-base.md`
(ADR-023).

- Next.js 16.4 (App Router, server actions) con React Compiler, React 19.3, TypeScript 7 y
  Tailwind 4.
- Componentes: shadcn estilo `base-vega` sobre `@base-ui/react` (no Radix), íconos de
  `lucide-react`. La skill `shadcn` para agentes vive en `.agents/skills/shadcn/`.
- Formularios: `react-hook-form` + `zod` (un solo manejador).
- Gestor de paquetes: **pnpm** (versión en `packageManager`). No usar npm ni `package-lock.json`.
- Lint y formato: **Biome** (`biome.json`), sin ESLint. `src/components/ui/` entra al lint con
  algunas reglas apagadas para el código de shadcn. Después de `pnpm dlx shadcn add`, correr
  `pnpm format`: los componentes con íconos salen del CLI sin formatear.
- CI: GitHub Actions (`.github/workflows/ci.yml`) corre `pnpm biome ci` y `pnpm build` en cada PR.
- `apartado/v1/` guarda piezas de la v1 que se rescatan en la Fase 4 (sesión y colas).
  Está fuera del build y del lint; se borra cuando ya no quede nada por rescatar.

Comandos: `pnpm dev`, `pnpm lint`, `pnpm format`, `pnpm build`.

## Seguimiento

- Las tareas son issues de este repo (`#1`–`#28`, milestone **v2**), uno por tarea del plan,
  creados con `.github/ISSUE_TEMPLATE/tarea.md`.
- Lo que se descubra sobre Sabre o sobre el SDK vuelve al wiki, a la página de la entidad o
  del ADR afectado, con fecha y siguiendo `sabre-wiki/CLAUDE.md`. Lo que sea propio de la app
  (rutas, UI) va al README de este repo.
- Al cerrar una fase, avisar al usuario para actualizar el plan en el wiki y agregar la
  entrada `impl` al log.

## Git

- Rama de integración: `v2` hasta la tarea F7.4 (#28), en la que `v2` reemplaza a `main`.
  `main` conserva la v1 hasta entonces y nunca se usa como base.
- El flujo completo está en el skill `git-flow` (`.claude/skills/git-flow/SKILL.md`). Una
  tarea = un issue = una rama = un PR = un commit squash en `v2`.
- Commits en Conventional Commits, sin líneas `Co-Authored-By` ni ninguna atribución a IA.
- Push, creación de PR y merge requieren confirmación del usuario cada vez.
