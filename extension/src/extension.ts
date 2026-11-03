import * as vscode from "vscode";
import * as path from "node:path";
import { Tutor, type Result } from "./tutor";
import { resolveClaudePath, runClaude } from "./claude/runner";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { loadRules } from "./claude/prompts";
import { currentStep, isPendingCreate, resolveInWorkspace } from "./guide/progress";
import { clampLine, resolveAnchor } from "./anchor";
import type { Guia } from "./guide/types";
import type { ViewState } from "./webview/render";
import { PanelProvider, type PanelMessage } from "./webview/provider";

type Busy = null | "hint" | "review" | "create";

export function activate(context: vscode.ExtensionContext): void {
  const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  let busy: Busy = null;
  let generating: string | null = null;
  let lastError: string | undefined;
  let guia: Guia | undefined;

  const decoration = vscode.window.createTextEditorDecorationType({
    isWholeLine: true,
    backgroundColor: new vscode.ThemeColor("editor.wordHighlightBackground"),
    after: { margin: "0 0 0 2em", color: new vscode.ThemeColor("editorCodeLens.foreground") },
  });
  context.subscriptions.push(decoration);

  const rules = (() => {
    try {
      return loadRules(path.join(context.extensionPath, "dist", "skills"));
    } catch {
      return "";
    }
  })();

  const tutor = root
    ? new Tutor(
        root,
        (req) => {
          const cfg = vscode.workspace.getConfiguration("wantToLearn");
          return runClaude({
            ...req,
            systemAppend: rules,
            cwd: root,
            model: cfg.get<string>("model") || undefined,
            timeoutMs: (cfg.get<number>("timeoutSeconds") ?? 300) * 1000,
            claudePath: resolveClaudePath(cfg.get<string>("claudePath") ?? "claude", homedir(), existsSync),
          });
        },
        async () => {
          await vscode.workspace.saveAll(false);
        },
      )
    : undefined;

  const provider = new PanelProvider(context.extensionUri, (m) => void handle(m), () => void refresh());
  context.subscriptions.push(vscode.window.registerWebviewViewProvider("wantToLearn.panel", provider));

  async function refresh(): Promise<void> {
    if (!tutor) return provider.render({ kind: "no-workspace" });
    if (generating !== null) return provider.render({ kind: "generating", pedido: generating });
    const l = await tutor.load();
    let state: ViewState;
    if (l.kind === "none") {
      guia = undefined;
      state = { kind: "none", error: lastError };
    } else if (l.kind === "error") {
      guia = undefined;
      state = { kind: "error-guide", error: l.error };
    } else {
      guia = l.guia;
      state = { kind: "guide", guia: l.guia, busy, error: lastError };
    }
    provider.render(state);
    updateDecorations();
  }

  async function run(kind: Exclude<Busy, null>, op: () => Promise<Result>): Promise<void> {
    if (!tutor || busy) return;
    busy = kind;
    lastError = undefined;
    await refresh();
    const r = await op();
    busy = null;
    if (!r.ok) lastError = r.error;
    await refresh();
    if (r.ok && kind === "create") await openStep(r.guia, r.guia.pasoActual - 1);
  }

  async function openFile(rel: string, line?: number): Promise<void> {
    if (!root) return;
    const abs = resolveInWorkspace(root, rel);
    if (!abs) return void vscode.window.showWarningMessage(`La ruta "${rel}" está fuera del proyecto.`);
    try {
      const doc = await vscode.workspace.openTextDocument(abs);
      const editor = await vscode.window.showTextDocument(doc, { preview: false });
      const lines = doc.getText().split("\n");
      const l = line ?? 0;
      const pos = new vscode.Position(Math.min(l, Math.max(lines.length - 1, 0)), 0);
      editor.selection = new vscode.Selection(pos, pos);
      editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
    } catch {
      vscode.window.showWarningMessage(`No pude abrir ${rel}. ¿Existe el archivo?`);
    }
  }

  async function openStep(g: Guia, index: number): Promise<void> {
    const p = g.pasos[index];
    if (!p || !root) return;
    const abs = resolveInWorkspace(root, p.archivo);
    let line = 0;
    if (abs) {
      try {
        const doc = await vscode.workspace.openTextDocument(abs);
        line = resolveAnchor(doc.getText().split("\n"), p.ancla);
      } catch {
        /* archivo inexistente: openFile avisa */
      }
    }
    await openFile(p.archivo, line);
  }

  async function confirm(msg: string, ok: string): Promise<boolean> {
    return (await vscode.window.showWarningMessage(msg, { modal: true }, ok)) === ok;
  }

  async function handle(m: PanelMessage): Promise<void> {
    if (!tutor) return;
    switch (m.action) {
      case "generate": {
        if (!m.pedido || busy || generating !== null) return;
        generating = m.pedido;
        lastError = undefined;
        await refresh();
        const r = await tutor.generate(m.pedido);
        generating = null;
        if (!r.ok) lastError = r.error;
        await refresh();
        if (r.ok) await openStep(r.guia, 0);
        return;
      }
      case "hint":
        return run("hint", () => tutor.hint());
      case "review":
        return run("review", () => tutor.review());
      case "create-file":
        return run("create", () => tutor.createFile());
      case "open-step":
        if (guia) await openStep(guia, Number(m.index));
        return;
      case "open-problem": {
        if (!m.archivo || !root) return;
        const abs = resolveInWorkspace(root, m.archivo);
        let line = 0;
        if (abs) {
          try {
            const doc = await vscode.workspace.openTextDocument(abs);
            line = clampLine(doc.getText().split("\n"), Number(m.linea) || 1);
          } catch {
            /* openFile avisa */
          }
        }
        return openFile(m.archivo, line);
      }
      case "abandon":
      case "new": {
        const ask = m.action === "new" ? "¿Empezar una guía nueva? Se borra la guía actual." : "¿Abandonar la guía? Se borra el progreso.";
        if (busy || !(await confirm(ask, m.action === "new" ? "Empezar otra" : "Abandonar"))) return;
        await tutor.abandon();
        lastError = undefined;
        return refresh();
      }
    }
  }

  function updateDecorations(): void {
    for (const editor of vscode.window.visibleTextEditors) {
      const p = guia && currentStep(guia);
      const abs = p && root ? resolveInWorkspace(root, p.archivo) : null;
      if (!p || p.tipo !== "codigo" || !abs || editor.document.uri.fsPath !== abs) {
        editor.setDecorations(decoration, []);
        continue;
      }
      const line = resolveAnchor(editor.document.getText().split("\n"), p.ancla);
      editor.setDecorations(decoration, [{
        range: new vscode.Range(line, 0, line, 0),
        renderOptions: { after: { contentText: `✏️ escribí acá (paso ${guia!.pasoActual + 1})` } },
      }]);
    }
  }

  if (root && tutor) {
    const guideWatcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(root, ".want-to-learn/guia.json"));
    const onGuide = () => { if (!busy && generating === null) void refresh(); };
    guideWatcher.onDidChange(onGuide);
    guideWatcher.onDidCreate(onGuide);
    guideWatcher.onDidDelete(onGuide);
    const fileWatcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(root, "**/*"), false, true, true);
    fileWatcher.onDidCreate(async (uri) => {
      if (busy || generating !== null || !isPendingCreate(guia, root, uri.fsPath)) return;
      if (await tutor.syncCreatedFile()) await refresh();
    });
    context.subscriptions.push(
      guideWatcher,
      fileWatcher,
      vscode.window.onDidChangeVisibleTextEditors(updateDecorations),
      vscode.workspace.onDidChangeTextDocument((e) => {
        if (vscode.window.visibleTextEditors.some((ed) => ed.document === e.document)) updateDecorations();
      }),
    );
  }
}

export function deactivate(): void {}
