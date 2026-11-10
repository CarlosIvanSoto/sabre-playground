---
name: git-flow
description: Flujo de Git de sabre-playground guiado por issues — rama ligada a un issue, commits Conventional Commits, checks locales, push y Pull Request contra la rama de integración `main` con la plantilla del repo. Usar cuando el usuario pida commitear, subir cambios, abrir un PR, empezar a trabajar en un issue o cerrar una tarea. Acepta como argumento el número de issue (ej. `/git-flow 5`).
---

# Flujo de Git guiado por issues

Una tarea = un issue = una rama = un PR = un commit en la rama de integración.

Excepción: los **ajustes de proceso** (skills, `CLAUDE.md`, plantillas de issue y de PR) no llevan
issue; siguen la vía corta de la sección 9.

## Constantes del proyecto

- **Rama de integración (base):** `main`. Todas las ramas salen de aquí y todos los PR apuntan
  aquí. Es también la **rama por defecto** del repo en GitHub, para que `Closes #N` cierre el issue
  al hacer merge.
- **`v2`** fue la rama de integración de la v2 hasta la tarea F7.4 (#28), en la que pasó a `main`
  por fast-forward. Ya no se usa como base ni recibe push. La v1 quedó en el tag `v1`.
- **Repo:** `CarlosIvanSoto/sabre-playground` · **Milestone:** `v2`.
- **Checks locales:** `pnpm lint && pnpm test && pnpm build` (`lint` es `biome check`; `test` corre
  `node:test` sobre `src/**/*.test.ts`; el build de Next también hace el typecheck). La CI corre lo
  mismo (`pnpm biome ci`, `pnpm test` y `pnpm build`) en cada PR, en el job "biome, tests y build".
  Ese nombre es el check exigido por la protección de `main`: si se renombra el job, hay que cambiar
  también el check exigido (con confirmación del usuario), o todos los PR quedan `BLOCKED`.
- **Prohibido en commits y PR:** líneas `Co-Authored-By`, `Claude-Session`, "Generated with Claude"
  o cualquier atribución a IA.

## 0. Diagnóstico (siempre, antes de tocar nada)

```bash
git status --short
git branch --show-current
git fetch origin --prune
git log --oneline -5
```

Decide en qué situación estás:

| Situación | Qué hacer |
|---|---|
| En `main` con cambios sin commitear | Ir al paso 1 (identificar issue) y crear la rama; los cambios viajan con `git switch -c`. |
| En una rama de tarea | Seguir en ella; saltar al paso 3. |
| En `v2` | Detenerse: `v2` quedó congelada en F7.4 (#28). Cambiar a `main` (los cambios viajan con `git switch`) y avisar al usuario. |
| Cambios que mezclan varias tareas | Separarlos: solo entra a la rama lo que pertenece al issue. Lo demás se queda sin commitear y se avisa al usuario. |
| Solo cambian archivos de proceso (ver sección 9) | Ir a la sección 9; no hace falta issue. |

## 1. Identificar el issue

- Si viene como argumento, úsalo. Si no, deducirlo del nombre de la rama (`feat/5-...` → #5) o
  preguntar al usuario mostrando candidatos: `gh issue list --state open --milestone v2`.
- Leerlo: `gh issue view <N> --json number,title,body,labels,milestone`.
- **Sin issue no hay rama**, salvo los ajustes de proceso de la sección 9. Si el trabajo no tiene
  issue, proponer crearlo con `.github/ISSUE_TEMPLATE/tarea.md` (título `[Fx.y] ...`, etiquetas
  `fase-N` y `tipo: ...`, milestone `v2`) y esperar confirmación del usuario.
- Revisar sus **dependencias** ("Bloqueado por #N"). Si alguna sigue abierta, o el issue tiene la
  etiqueta `bloqueado`, avisar antes de continuar.
- Los issues `tipo: decisión` y `tipo: fuente` se cierran en el wiki, no en este repo. Solo llevan
  rama si además tocan código o docs del repo.

## 2. Crear la rama

Formato: `<tipo>/<issue>-<slug-kebab-case>` (slug corto, 2–5 palabras, sin acentos).

| Tipo de cambio | Prefijo |
|---|---|
| Funcionalidad nueva (`tipo: implementación`) | `feat/` |
| Corrección de un error | `fix/` |
| Reestructuración sin cambio de comportamiento | `refactor/` |
| Solo tests | `test/` |
| Documentación (README, comentarios) | `docs/` |
| Tooling, dependencias, config | `chore/` · `ci/` · `build/` |

Ejemplos: `feat/4-run-step`, `feat/5-step-panel`, `chore/2-config-entornos`.

```bash
git switch main && git pull --ff-only   # solo si no hay cambios pendientes
git switch -c feat/4-run-step
```

Si ya hay cambios sin commitear en `main`, crear la rama directamente con `git switch -c` (no hacer
pull antes).

## 3. Commits

Agrupar por unidad lógica (un commit debe compilar y tener sentido solo). Agregar archivos
explícitamente por ruta, nunca `git add -A` / `git add .` a ciegas. Revisar `git diff --staged`
antes de cada commit; nunca incluir `.env*`, credenciales, tokens, ni respuestas reales de Sabre con
datos de pasajeros o PNR.

Formato Conventional Commits:

```
<tipo>(<scope>): <resumen en imperativo, minúscula, sin punto, ≤ 72 caracteres>

<cuerpo: qué cambia y POR QUÉ, con referencia a la página del wiki
o ADR que lo fija cuando aplique. Líneas de ≤ 72 caracteres.>

Refs #<issue>
```

- **tipo:** `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `ci`, `build`, `perf`.
- **scope:** la parte de la app afectada: `step` (`runStep`, `StepPanel`), `ui`, `auth`, `booking`,
  `air`, `session`, `queue`, `parser`, `fake`, `hallazgo`, `config`, `deps`. Omitirlo si el cambio
  es transversal.
- **Footer:** `Refs #N` en los commits intermedios. El cierre (`Closes #N`) va en el PR, no en los
  commits.
- Usar heredoc para que el formato no se rompa:

```bash
git commit -F - <<'EOF'
feat(step): runStep con respuesta cruda, error serializado y log

Junta onRawResponse, un logger en memoria y la serialización de
SabreError, como fijan consola-visual (ADR-022) y respuesta-cruda
(ADR-015).

Refs #4
EOF
```

## 4. Verificar antes de subir

```bash
pnpm lint && pnpm test && pnpm build
```

Si `pnpm lint` marca formato u orden de imports, `pnpm biome check --write` lo arregla; revisar
el diff antes de commitear.

Además, según la tarea:

- **Flujos contra Sabre:** probar en CERT con `pnpm dev` y anotar qué se corrió (sin datos de
  pasajero).
- **Modo fake:** probarlo sin `.env` cuando la tarea lo toque.
- **Token:** buscar el token en el HTML y en el payload de las server actions no debe dar
  resultados.

Si algo falla: corregir y hacer otro commit (o `git commit --amend` si la rama aún no se ha
subido). **No subir con checks en rojo.** Si el fallo no es de esta tarea, informar al usuario y no
tocarlo.

Revisar también la definición de terminado y los criterios del issue (checklists en su cuerpo) y
anotar qué queda pendiente.

## 5. Confirmar con el usuario

Antes de cualquier acción remota, mostrar un resumen corto y esperar el visto bueno:

- rama y base
- lista de commits (`git log --oneline main..HEAD`)
- resultado de los checks y de las pruebas manuales
- título del PR propuesto

## 6. Push

```bash
git push -u origin <rama>
```

- Nunca hacer push directo a `main` ni a `v2`.
- Si hay que reescribir la rama ya subida (rebase sobre la base), usar solo
  `git push --force-with-lease`, nunca `--force`.

## 7. Pull Request

Título = el mensaje del futuro squash commit, en Conventional Commits con el código de tarea:
`feat(step): helper runStep [F0.4]`

```bash
gh pr create \
  --base main \
  --head <rama> \
  --title "<tipo>(<scope>): <resumen> [Fx.y]" \
  --milestone v2 \
  --label "<las etiquetas fase-N / tipo del issue, sin 'bloqueado'>" \
  --assignee @me \
  --body-file <archivo temporal en el scratchpad>
```

El cuerpo sigue `.github/pull_request_template.md` y se llena de verdad:

- `Closes #N` en la primera línea. Comprobar que quedó enlazado:
  `gh pr view <PR> --json closingIssuesReferences`. Si sale vacío, revisar la palabra clave y que
  `main` sea la rama por defecto del repo (`gh repo view --json defaultBranchRef`); si no lo es, el
  issue se cierra a mano después del merge (paso 8).
- **Resumen:** qué problema resuelve, en 2–3 frases.
- **Cambios:** lista de lo que cambia, agrupada por parte de la app.
- **Referencias del wiki:** las mismas páginas del issue, más las que se hayan usado.
- **Cómo se probó:** los checks del paso 4 y las pruebas manuales (CERT o fake).
- **Definición de terminado:** copiar el checklist del issue y marcar lo cumplido; explicar lo que
  no.
- **Hallazgos para el wiki:** qué se anotó y en qué página, o "Sin hallazgos".
- **Notas para revisión:** decisiones discutibles, deuda que queda, por dónde empezar a leer.

Al terminar, devolver al usuario la URL del PR.

## 8. Merge y limpieza (cuando el usuario lo pida)

Estrategia: **squash merge** → un commit por issue en `main`, con el título del PR como mensaje.

Antes del merge, esperar a que la CI termine en verde:

```bash
gh pr checks <PR> --watch
gh pr merge <PR> --squash --delete-branch
git switch main && git pull --ff-only
git branch -D <rama>               # -D: Git no reconoce como mergeada una rama que entró por squash
```

Si la base avanzó mientras el PR estaba abierto: `git fetch origin && git rebase origin/main`,
repetir checks y `git push --force-with-lease`.

**PR apilados** (una rama sale de la de otra tarea y su PR apunta a esa rama). Primero ver si
GitHub los tiene en un stack nativo: `gh api repos/CarlosIvanSoto/sabre-playground/pulls/<PR> --jq .stack`.

- **Stack nativo** (`stack` no es `null`): `gh pr merge` falla con "must be merged using the
  asynchronous merge REST API". Mergear siempre el PR de `stack.position` 1, porque el merge
  incluye todos los PR abiertos que tiene debajo:

  ```bash
  gh api -X PUT repos/CarlosIvanSoto/sabre-playground/pulls/<PR>/merge-async \
    -f merge_method=squash -f merge_action=direct_merge \
    -f sha=<head del PR> -f 'commit_title=<título del PR> (#<PR>)'
  gh api repos/CarlosIvanSoto/sabre-playground/pulls/<PR>/merge-async/<uuid>   # hasta "merged"
  ```

  GitHub cambia la base del siguiente PR a `main` y rebasa solo las ramas de arriba; el PR queda
  `BLOCKED` hasta que termina la CI de ese push. Las ramas no se borran hasta mergear el último.
- **Sin stack:** no usar `--delete-branch` en el PR de abajo, porque GitHub cierra el de arriba en
  vez de cambiarle la base. Mergear, `gh pr edit <PR-de-arriba> --base main`, y sacar los commits
  originales del de abajo:
  `git rebase --onto origin/main <rama-de-abajo> <rama-de-arriba>`, con `--update-refs` si hay más
  ramas encima, repetir checks y `git push --force-with-lease` (con confirmación del usuario).
  Recién entonces borrar la rama de abajo.

Después del merge:

- Verificar que el issue quedó cerrado (`gh issue view <N> --json state`); si no, cerrarlo con
  `gh issue close <N> --comment "Cerrado por #<PR>"`.
- Si hubo hallazgos, verificar que están en la página correspondiente del wiki.
- Si era la última tarea de una fase, avisar al usuario para actualizar `plan-v2` y el log del
  wiki.

## 9. Ajustes de proceso (sin issue)

Cambios al proceso de trabajo, no a la app. No pasan por el milestone ni por el plan, así que no
necesitan issue.

**Qué entra en esta vía** (solo estas rutas):

- `.claude/` (skills, settings del proyecto)
- `CLAUDE.md`
- `.github/ISSUE_TEMPLATE/` y `.github/pull_request_template.md`

**Qué no entra**, aunque parezca tooling, porque afecta el build: `src/`, `public/`, `apartado/`,
`package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `tsconfig.json`, `next.config.ts`,
`biome.json`, `postcss.config.mjs`, `components.json`, `skills-lock.json`, `.agents/` y
`.github/workflows/`. Esos cambios llevan issue y siguen
los pasos 1–8.

**Cómo:**

1. Rama `chore/proceso-<slug>` desde `main`, por ejemplo `chore/proceso-checks-locales`. No se
   mezclan con una rama de tarea: si aparecen en medio de una tarea, se quedan sin commitear y se
   llevan a su propia rama.
2. Commit `chore(proceso): <resumen>`, con el cuerpo explicando el porqué y sin footer `Refs`.
3. Los checks del paso 4 no hacen falta (no se toca código).
4. Confirmar con el usuario (paso 5), push (paso 6) y PR contra `main` con título
   `chore(proceso): <resumen>`, sin código de tarea `[Fx.y]`, sin milestone ni etiquetas de fase.
   El cuerpo puede ser corto: qué cambia y por qué. Las secciones de la plantilla que no apliquen
   se marcan "No aplica".
5. Squash merge. No hay issue que cerrar.

## 10. Movimientos de rama hechos una sola vez (historial)

No se vuelven a usar; quedan como registro de las dos veces en que se tocó una rama protegida sin PR.

- **Arranque de `v2` (F0.1, #1).** `v2` se creó en local desde `main`, con el commit de #1 y el de
  proceso encima. Se subió con `git push -u origin v2`, pasó a ser la rama por defecto y #1 se cerró
  a mano.
- **`v2` reemplaza a `main` (F7.4, #28).** Primero, un PR contra `v2` que cambió la base en este
  skill, en `CLAUDE.md` y en la CI. Después, `git push origin v2:main`, un fast-forward porque
  `main` era ancestro de `v2`. `main` volvió a ser la rama por defecto, con la misma protección que
  tenía `v2`. La v1 sigue en el tag `v1`.

## Reglas que no se rompen

- Nada de commits sin issue asociado, salvo los ajustes de proceso (sección 9).
- Nada de push directo a `main` ni a `v2`; todo entra por PR.
- Nada de `--force` (solo `--force-with-lease`, y solo en ramas propias).
- Nada de `--no-verify` para saltarse hooks.
- Nada de `git stash` sin etiqueta. Para apartar trabajo, usar un commit WIP en la rama.
- Nada de atribución a IA en commits, PR ni comentarios.
- Push, creación de PR, cambio de rama por defecto y merge requieren confirmación del usuario en
  cada ejecución.
