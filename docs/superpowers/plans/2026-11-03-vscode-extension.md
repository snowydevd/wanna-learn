# want-to-learn: extensión VS Code/Cursor — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Panel lateral en VS Code/Cursor con un timeline de pasos donde el usuario pide una guía, escribe el código él mismo, pide pistas y hace revisar su código por Claude antes de avanzar.

**Architecture:** La extensión (TypeScript) guarda el estado en `.want-to-learn/guia.json` del workspace y lo muestra en un `WebviewView` lateral. Para generar, dar pistas y revisar invoca el CLI local `claude -p` con herramientas de solo lectura y salida JSON validada por `--json-schema`; **la extensión** escribe la guía, Claude nunca escribe archivos. La lógica (formato, progreso, armado de prompts, ancla del resaltado, render HTML) son módulos puros testeados con vitest; `extension.ts` solo cablea VS Code.

**Tech Stack:** TypeScript 5, Node 22, VS Code API `^1.90.0` (Cursor compatible), esbuild, vitest, @vscode/vsce. Sin framework en el webview (HTML string + JS vanilla).

**Spec:** `docs/superpowers/specs/2026-11-03-vscode-extension-design.md`

## Global Constraints

- Claude **no escribe archivos** desde la extensión: invocación con `--tools Read,Grep,Glob` únicamente.
- Invocación base (verificada 2026-11-03 con Claude Code 2.1.317): `claude -p <prompt> --output-format json --json-schema <schema> --tools Read,Grep,Glob --strict-mcp-config --setting-sources "" --no-session-persistence --append-system-prompt <reglas>`, cwd = raíz del workspace. Usa la sesión OAuth del usuario (no usar `--bare`: exige API key). Resultado en el campo `structured_output`; error si `is_error === true` (texto en `result`, p. ej. `"Not logged in · Please run /login"`). Sin `--strict-mcp-config --setting-sources ""` cada llamada carga ~156k tokens de plugins/MCP del usuario; con ellos ~5k.
- Fuente de verdad: `<primera carpeta del workspace>/.want-to-learn/guia.json`. **Cambio respecto del spec**: pasa de `guia.md` a `guia.json` (el spec permitía extender el formato); el plugin de terminal se actualiza en la Task 9 para usar el mismo archivo.
- UI y textos en español; nombres de código como están. Colores con variables del tema (`var(--vscode-*)`), nada hardcodeado.
- Criterios de revisión y pistas pre-generadas son privados: nunca se renderizan en el panel.
- Sin publicación: se instala como VSIX local.

## Review Focus

1. **Rutas que devuelve Claude fuera del workspace** (`../x`, `/etc/x`): el botón Crear archivo y los clics nunca deben salir del workspace → `resolveInWorkspace` rechaza (tests en Task 2 y Task 5).
2. **`guia.json` corrupto o editado a mano**: el panel muestra un estado de error con "Abandonar guía", sin crashear (tests en Task 1, 5 y 7).
3. **Fallas del CLI** (no instalado `ENOENT`, no logueado, timeout, JSON sin `structured_output`): tarjeta de error en el panel y botones rehabilitados (tests en Task 3 y Task 5).
4. **Revisión con líneas fuera de rango**: el clic abre el archivo y clampea la línea; no tira error (test en Task 6).
5. **Archivos sin guardar al revisar**: se guardan antes de invocar a Claude (test de orden en Task 5, verificación manual en Task 8).

---

## Estructura de archivos

```
want-to-learn/
  .gitignore                      # node_modules, dist, *.vsix, .superpowers/
  skills/…                        # plugin de terminal (Task 9 lo adapta)
  extension/
    package.json  tsconfig.json  esbuild.mjs  vitest.config.ts
    media/icon.svg  media/panel.css  media/panel.js
    src/
      guide/types.ts              # tipos del JSON
      guide/parse.ts              # parseGuide / serializeGuide
      guide/progress.ts           # reducers puros + normalizeSteps + resolveInWorkspace
      claude/runner.ts            # buildArgs, parseCliOutput, runClaude
      claude/prompts.ts           # prompts + JSON schemas
      tutor.ts                    # orquesta archivo + runner + progreso
      anchor.ts                   # resuelve línea del resaltado
      webview/render.ts           # renderPanel(viewState) -> HTML
      webview/provider.ts         # WebviewViewProvider + mensajes
      extension.ts                # activate: watchers, decoraciones, acciones
    test/*.test.ts
```

---

### Task 1: Scaffold + formato de la guía

**Files:**
- Create: `.gitignore`, `extension/package.json`, `extension/tsconfig.json`, `extension/esbuild.mjs`, `extension/vitest.config.ts`, `extension/src/guide/types.ts`, `extension/src/guide/parse.ts`
- Test: `extension/test/parse.test.ts`

**Interfaces:**
- Produces (`types.ts`):
  ```ts
  type StepKind = "crear-archivo" | "codigo";
  interface Concepto { nombre: string; explicacion: string; docs: string }
  interface Ancla { texto?: string; linea?: number }          // linea 1-based
  interface Problema { archivo: string; linea: number; explicacion: string }
  interface Revision { aprobado: boolean; mensaje: string; problemas: Problema[]; sugerencias: string[] }
  interface Paso {
    id: number; tipo: StepKind; titulo: string; archivo: string; donde: string;
    ancla?: Ancla; objetivo: string; conceptos: Concepto[];
    criterios: string[]; pistas: string[];                    // privados
    hecho: boolean; nivelPista: number; ultimaPista?: string; ultimaRevision?: Revision;
  }
  interface Guia { version: 1; pedido: string; titulo: string; panorama: string;
    pasoActual: number /* índice 0-based */; terminada: boolean; resumen?: string; pasos: Paso[] }
  ```
- Produces (`parse.ts`): `parseGuide(text: string): { ok: true; guia: Guia } | { ok: false; error: string }`, `serializeGuide(g: Guia): string` (JSON con 2 espacios + `\n` final).

- [ ] **Step 1:** `git init` en la raíz del repo; `.gitignore` con `node_modules/`, `extension/dist/`, `*.vsix`, `.superpowers/`. Commit inicial con lo existente (plugin, docs).
- [ ] **Step 2:** Scaffold de `extension/`: `package.json` con `"name": "want-to-learn"`, `"publisher": "local"`, `"engines": {"vscode": "^1.90.0"}`, `"main": "./dist/extension.js"`, scripts `build` (`node esbuild.mjs`), `test` (`vitest run`), `package` (`npm run build && vsce package --no-dependencies`); devDeps `typescript esbuild vitest @types/vscode@1.90 @types/node @vscode/vsce`. `esbuild.mjs` empaqueta `src/extension.ts` → `dist/extension.js` (cjs, `external: ["vscode"]`) y copia `../skills` → `dist/skills`. `npm install`.
- [ ] **Step 3: Tests que fallan** (`parse.test.ts`):
  - `parseGuide(serializeGuide(g))` devuelve `{ok:true, guia: g}` para una guía de ejemplo de 2 pasos.
  - texto `"no json"` → `ok:false`, `error` contiene `"JSON"`.
  - `version: 2` → `ok:false`, error contiene `"versión"`.
  - falta `pasos` → `ok:false`.
  - `pasoActual` fuera de `[0, pasos.length]` → `ok:false`.
- [ ] **Step 4:** `npx vitest run test/parse.test.ts` → FAIL (módulo no existe).
- [ ] **Step 5:** Implementar `types.ts` y `parse.ts` (validación manual de campos requeridos y tipos, sin dependencias).
- [ ] **Step 6:** `npx vitest run test/parse.test.ts` → PASS.
- [ ] **Step 7:** Commit `feat(extension): scaffold y formato guia.json`.

### Task 2: Progreso (reducers puros)

**Files:** Create `extension/src/guide/progress.ts` · Test `extension/test/progress.test.ts`

**Interfaces:**
- Consumes: tipos de Task 1.
- Produces:
  ```ts
  currentStep(g: Guia): Paso | undefined
  applyReview(g: Guia, r: Revision, resumen?: string): Guia   // aprobado → hecho, avanza, nivelPista 0; último → terminada + resumen
  applyHint(g: Guia, pista: string): Guia                     // ultimaPista, nivelPista = min(nivelPista+1, 3)
  completeCreateFile(g: Guia): Guia                           // solo si paso actual es "crear-archivo"; si no, devuelve g
  normalizeSteps(pasos: Paso[], exists: (rel: string) => boolean): Paso[]
  resolveInWorkspace(root: string, rel: string): string | null // absoluto si queda dentro de root, si no null
  ```
  Ningún reducer muta su entrada.

- [ ] **Step 1: Tests que fallan:**
  - `applyReview` aprobado en paso 0 de 3 → `pasos[0].hecho === true`, `pasoActual === 1`, `pasos[1].nivelPista === 0`, `ultimaRevision` guardada en paso 0.
  - `applyReview` no aprobado → `pasoActual` igual, `ultimaRevision.problemas` guardados.
  - `applyReview` aprobado en el último paso con `resumen: "R"` → `terminada === true`, `resumen === "R"`, `currentStep` → `undefined`.
  - `applyHint` 4 veces → `nivelPista === 3`, `ultimaPista` = la última.
  - `completeCreateFile` sobre paso `"codigo"` → misma referencia de guía.
  - `normalizeSteps`: pasos `[codigo a.ts (no existe), codigo a.ts, codigo b.ts (existe)]` → `[crear-archivo a.ts, codigo a.ts, codigo a.ts, codigo b.ts]`, ids renumerados 1..4; si ya hay un `crear-archivo a.ts` antes, no duplica.
  - `resolveInWorkspace("/w", "src/a.ts")` → `"/w/src/a.ts"`; `"../x"`, `"/etc/passwd"`, `"src/../../x"` → `null`.
- [ ] **Step 2:** `npx vitest run test/progress.test.ts` → FAIL.
- [ ] **Step 3:** Implementar `progress.ts`. El paso `crear-archivo` insertado: `titulo: "Crear archivo"`, `donde: "<directorio del archivo>"`, `objetivo: "Crear el archivo vacío <archivo>"`, `conceptos/criterios/pistas: []`.
- [ ] **Step 4:** → PASS.
- [ ] **Step 5:** Commit `feat(extension): reducers de progreso`.

### Task 3: Runner del CLI de Claude

**Files:** Create `extension/src/claude/runner.ts` · Test `extension/test/runner.test.ts`

**Interfaces:**
- Produces:
  ```ts
  interface RunOptions { prompt: string; schema: object; systemAppend: string; cwd: string; model?: string; timeoutMs: number; claudePath: string }
  type RunResult = { ok: true; data: unknown } | { ok: false; error: string }
  buildArgs(o: RunOptions): string[]
  parseCliOutput(stdout: string): RunResult
  type SpawnFn = (cmd: string, args: string[], opts: { cwd: string }) => ChildProcessLike
  runClaude(o: RunOptions, spawn?: SpawnFn): Promise<RunResult>
  ```
- [ ] **Step 1: Tests que fallan:**
  - `buildArgs` empieza con `-p <prompt>` y contiene los flags exactos de Global Constraints; `--json-schema` es `JSON.stringify(schema)`; `--model x` solo si `model` es no vacío.
  - `parseCliOutput('{"is_error":false,"structured_output":{"a":1}}')` → `{ok:true,data:{a:1}}`.
  - `is_error:true, result:"Not logged in · Please run /login"` → `ok:false`, error contiene `"claude /login"` (mensaje en español que explique cómo loguearse).
  - stdout no JSON → `ok:false`; JSON sin `structured_output` → `ok:false`.
  - `runClaude` con spawn falso que emite `error` con `code:"ENOENT"` → error contiene `"No encontré el comando claude"` y menciona `wantToLearn.claudePath`.
  - spawn falso que nunca termina con `timeoutMs: 50` → error contiene `"tardó demasiado"` y el proceso recibe `kill()`.
- [ ] **Step 2:** → FAIL. **Step 3:** Implementar (spawn de `node:child_process` por defecto, `shell: false`, acumula stdout). **Step 4:** → PASS.
- [ ] **Step 5:** Commit `feat(extension): runner del CLI de claude`.

### Task 4: Prompts y schemas

**Files:** Create `extension/src/claude/prompts.ts` · Test `extension/test/prompts.test.ts`

**Interfaces:**
- Produces:
  ```ts
  extractSection(md: string, heading: string): string   // contenido bajo "## heading" hasta el próximo "## "
  loadRules(skillsDir: string): string                  // sección "Reglas (valen mientras la guía esté activa)" de want-to-learn/SKILL.md + nota de modo extensión
  generateRequest(pedido: string): { prompt: string; schema: object }
  hintRequest(g: Guia): { prompt: string; schema: object }      // schema {pista: string}
  reviewRequest(g: Guia): { prompt: string; schema: object }    // schema Revision + resumen opcional
  ```
  Schema de generación: `{titulo, panorama, pasos: [{tipo, titulo, archivo, donde, ancla?, objetivo, conceptos[], criterios[], pistas (3)}]}` (sin campos de runtime). La nota de modo extensión dice: no escribas archivos, devolvé solo el JSON; rutas relativas a la raíz del workspace; leé `CLAUDE.md` si existe; cada paso toca un solo archivo; `pistas` exactamente 3, de suave a fuerte, sin código resuelto; `ancla.texto` = una línea existente del archivo junto a la que se escribe (omitir si el archivo es nuevo).
- [ ] **Step 1: Tests que fallan:**
  - `extractSection` sobre un md de ejemplo devuelve solo esa sección; heading inexistente → `""`.
  - `loadRules("../skills")` contiene `"No edites ni crees archivos"`.
  - `generateRequest("subir fotos").prompt` contiene `"subir fotos"`; `schema.required` incluye `"pasos"`.
  - `hintRequest(g).prompt` contiene objetivo, las 3 pistas y `nivelPista` del paso actual, y **no** contiene el objetivo de otros pasos.
  - `reviewRequest(g).prompt` contiene `criterios` y `archivo` del paso actual; en el último paso pide `resumen`.
- [ ] **Step 2:** → FAIL. **Step 3:** Implementar. **Step 4:** → PASS.
- [ ] **Step 5:** Commit `feat(extension): prompts y schemas`.

### Task 5: Tutor (orquestación)

**Files:** Create `extension/src/tutor.ts` · Test `extension/test/tutor.test.ts` (dir temporal + runner falso)

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces:
  ```ts
  type Runner = (req: { prompt: string; schema: object }) => Promise<RunResult>
  type Result = { ok: true; guia: Guia } | { ok: false; error: string }
  class Tutor {
    constructor(root: string, runner: Runner, saveAll: () => Promise<void>)
    readonly guidePath: string                         // <root>/.want-to-learn/guia.json
    busy: boolean
    load(): Promise<{ kind: "none" } | { kind: "ok"; guia: Guia } | { kind: "error"; error: string }>
    generate(pedido: string): Promise<Result>          // normalizeSteps + escribe guia.json
    hint(): Promise<Result>
    review(): Promise<Result>                          // saveAll() antes del runner
    createFile(): Promise<Result>                      // crea vacío (mkdir -p) y completa; no pisa si existe
    abandon(): Promise<void>                           // borra guia.json
  }
  ```
- [ ] **Step 1: Tests que fallan:**
  - sin archivo → `load()` = `{kind:"none"}`; archivo corrupto → `{kind:"error"}`.
  - `generate` con runner que devuelve 1 paso `codigo` en archivo inexistente → `guia.json` con 2 pasos, el primero `crear-archivo`.
  - runner `{ok:false}` → `generate` devuelve error, **no** crea `guia.json`, `busy` vuelve a `false`.
  - `review` llama `saveAll` antes que al runner (registrar orden).
  - `createFile` con `archivo: "../fuera.ts"` → error, nada creado fuera de root.
  - `createFile` con archivo existente con contenido → no lo pisa, igual completa el paso.
  - segunda llamada mientras `busy` → `{ok:false}` con error que contiene `"Ya estoy trabajando"`.
- [ ] **Step 2:** → FAIL. **Step 3:** Implementar. **Step 4:** → PASS.
- [ ] **Step 5:** Commit `feat(extension): tutor`.

### Task 6: Ancla del resaltado y salto a líneas

**Files:** Create `extension/src/anchor.ts` · Test `extension/test/anchor.test.ts`

**Interfaces:**
- Produces: `resolveAnchor(lines: string[], ancla?: Ancla): number` (0-based: línea siguiente a la que contiene `ancla.texto` trimmeado; si no aparece, `ancla.linea - 1` clampeado; si nada, última línea) y `clampLine(lines: string[], linea1: number): number` (1-based → 0-based dentro de rango).
- [ ] **Step 1: Tests que fallan:** texto encontrado (ignorando espacios) → índice siguiente; texto ausente con `linea: 3` → 2; sin ancla en archivo de 5 líneas → 4; archivo vacío → 0; `clampLine` con 99 en 5 líneas → 4; con 0 → 0.
- [ ] **Step 2:** → FAIL. **Step 3:** Implementar. **Step 4:** → PASS.
- [ ] **Step 5:** Commit `feat(extension): ancla del resaltado`.

### Task 7: Render del panel

**Files:** Create `extension/src/webview/render.ts` · Test `extension/test/render.test.ts`

**Interfaces:**
- Produces:
  ```ts
  type ViewState =
    | { kind: "no-workspace" } | { kind: "none" } | { kind: "generating"; pedido: string }
    | { kind: "error-guide"; error: string }
    | { kind: "guide"; guia: Guia; busy: null | "hint" | "review"; error?: string };
  renderPanel(s: ViewState): string   // HTML del <body>; acciones con data-action="generate|hint|review|create-file|open-step|open-problem|abandon|new"
  ```
  Layout = opción A del boceto (`.superpowers/brainstorm/22910-1793711802/content/panel-timeline.html`): encabezado `"<titulo> · <hechos>/<total>"`, timeline vertical, paso actual desplegado (objetivo, conceptos con link, botones **💡 Pista** y **✓ Revisar mi código**, o **Crear archivo** si es `crear-archivo`), tarjeta de pista y tarjeta de revisión separadas debajo del detalle. Pendientes sin detalle ni `data-action`. `error` en estado `guide` se muestra como tarjeta de error.
- [ ] **Step 1: Tests que fallan:**
  - `none` contiene `<textarea` con placeholder `"¿Qué querés aprender a construir?"` y `data-action="generate"`.
  - `guide` contiene el `objetivo` del paso actual y **ningún** string de `criterios` ni de `pistas`.
  - hechos con clase `done`, actual `cur`; pendientes sin `data-action`.
  - paso actual `crear-archivo` → `data-action="create-file"` y sin botones de pista/revisión.
  - revisión con problemas → cada uno con `data-action="open-problem"`, `data-archivo`, `data-linea`.
  - `busy: "review"` → botones con `disabled`.
  - `terminada` → muestra `resumen` y `data-action="new"`.
  - `error-guide` → muestra el error y `data-action="abandon"`.
  - `<script>` dentro de `objetivo` sale escapado.
- [ ] **Step 2:** → FAIL. **Step 3:** Implementar con `esc()` para todo texto. **Step 4:** → PASS.
- [ ] **Step 5:** Commit `feat(extension): render del panel`.

### Task 8: Cableado en VS Code

**Files:** Create `extension/src/webview/provider.ts`, `extension/src/extension.ts`, `extension/media/panel.js`, `extension/media/panel.css`, `extension/media/icon.svg`; Modify `extension/package.json` (contributes)

**Interfaces:**
- Consumes: `Tutor`, `renderPanel`, `resolveAnchor`, `clampLine`, `resolveInWorkspace`, `runClaude`, `loadRules`.
- `package.json` contributes: `viewsContainers.activitybar` id `wantToLearn`, título `"Want to learn"`, icono `media/icon.svg`; `views.wantToLearn` con webview id `wantToLearn.panel`; `activationEvents: ["onView:wantToLearn.panel"]`; settings `wantToLearn.claudePath` (default `"claude"`), `wantToLearn.model` (default `""` = default del CLI), `wantToLearn.timeoutSeconds` (default `300`).

- [ ] **Step 1:** `provider.ts`: `WebviewViewProvider` que envuelve `renderPanel(state)` en HTML con CSP (`default-src 'none'; style-src ${cspSource}; script-src 'nonce-…'`) y carga `panel.css`/`panel.js`. `panel.js` delega clics por `data-action` y hace `postMessage({action, ...dataset, pedido?})`.
- [ ] **Step 2:** `extension.ts`: root = primera carpeta del workspace (sin carpeta → `no-workspace`). `Tutor` con runner = `runClaude` + `loadRules(<dist>/skills)` + settings, y `saveAll = () => vscode.workspace.saveAll(false)`. `FileSystemWatcher` sobre `.want-to-learn/guia.json` → recarga y re-renderiza (sincroniza con la terminal). Watcher de creación de archivos → si coincide con el `crear-archivo` actual, `completeCreateFile`. `open-step`/`open-problem` abren el archivo vía `resolveInWorkspace` y `clampLine`. `abandon` y `new` piden confirmación modal.
- [ ] **Step 3:** Decoración: `TextEditorDecorationType` con fondo `new ThemeColor("editor.wordHighlightBackground")` y `after` `"✏️ escribí acá (paso N)"` en la línea de `resolveAnchor`, solo en el editor del archivo del paso actual; se actualiza en `onDidChangeActiveTextEditor`, `onDidChangeTextDocument` y al cambiar la guía.
- [ ] **Step 4:** `npm run build && npm test` → build sin errores, todos los tests PASS.
- [ ] **Step 5: Verificación manual.** `npm run package`, luego `code --install-extension want-to-learn-*.vsix` y `cursor --install-extension want-to-learn-*.vsix`. En `~/Documents/Projects/gridd`:
  - panel vacío → pedido "agregar subida de fotos por evento" → indicador de generando → timeline con pasos y al menos un `crear-archivo`.
  - Crear archivo → se crea vacío, se abre, avanza.
  - escribir algo incompleto **sin guardar** → Revisar → el archivo queda guardado y aparece tarjeta con problemas; clic en un problema salta a la línea.
  - Pista ×2 → la segunda es más concreta.
  - `/check` en la terminal (tras Task 9) → el panel se actualiza solo.
  - `wantToLearn.claudePath = "noexiste"` → tarjeta de error, botones rehabilitados.
  - `git status` en los repos de Gridd: ningún archivo modificado por Claude (solo los que escribió el usuario).
- [ ] **Step 6:** Commit `feat(extension): panel, decoraciones y acciones`.

### Task 9: Plugin de terminal al formato guia.json

**Files:** Modify `skills/want-to-learn/SKILL.md`, `skills/hint/SKILL.md`, `skills/check/SKILL.md`, `README.md`

- [ ] **Step 1:** En los tres skills, `guia.md` → `guia.json`, y la sección "Formato" pasa a ser el esquema de `types.ts` (mismos nombres de campo; `pasoActual` 0-based; `nivelPista`, `ultimaPista`, `ultimaRevision`, `terminada`, `resumen`). `/want-to-learn` debe incluir un paso `crear-archivo` antes del primer paso de cada archivo nuevo. No cambiar el heading "Reglas (valen mientras la guía esté activa)" (Task 4 lo extrae por nombre).
- [ ] **Step 2:** README: sección de la extensión (empaquetar, instalar VSIX en VS Code y Cursor, settings).
- [ ] **Step 3:** `claude plugin validate .` → `✔ Validation passed`; `cd extension && npx vitest run` → PASS; `claude plugin marketplace update want-to-learn-local`.
- [ ] **Step 4:** Commit `feat(plugin): guía en guia.json compartida con la extensión`.
