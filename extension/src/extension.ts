import * as vscode from "vscode";
import * as path from "node:path";
import { GUIDE_FILE, Tutor, type Result } from "./tutor";
import { resolveClaudePath, runClaude } from "./claude/runner";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { loadRules } from "./claude/prompts";
import { currentStep, isPendingCreate, resolveInWorkspace } from "./guide/progress";
import { clampLine, resolveAnchor } from "./anchor";
import type { Guide } from "./guide/types";
import type { ViewState } from "./webview/render";
import { PanelProvider, type PanelMessage } from "./webview/provider";

type Busy = null | "hint" | "review" | "create" | "ask";

export function activate(context: vscode.ExtensionContext): void {
  const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  let busy: Busy = null;
  let generating: string | null = null;
  let lastError: string | undefined;
  let guide: Guide | undefined;

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
    if (generating !== null) return provider.render({ kind: "generating", request: generating });
    const l = await tutor.load();
    let state: ViewState;
    if (l.kind === "none") {
      guide = undefined;
      state = { kind: "none", error: lastError };
    } else if (l.kind === "error") {
      guide = undefined;
      state = { kind: "error-guide", error: l.error };
    } else {
      guide = l.guide;
      state = { kind: "guide", guide: l.guide, busy, error: lastError };
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
    if (r.ok && kind === "create") await openStep(r.guide, r.guide.currentIndex - 1);
  }

  async function openFile(rel: string, line?: number): Promise<void> {
    if (!root) return;
    const abs = resolveInWorkspace(root, rel);
    if (!abs) return void vscode.window.showWarningMessage(`The path "${rel}" is outside the project.`);
    try {
      const doc = await vscode.workspace.openTextDocument(abs);
      const editor = await vscode.window.showTextDocument(doc, { preview: false });
      const lines = doc.getText().split("\n");
      const l = line ?? 0;
      const pos = new vscode.Position(Math.min(l, Math.max(lines.length - 1, 0)), 0);
      editor.selection = new vscode.Selection(pos, pos);
      editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
    } catch {
      vscode.window.showWarningMessage(`Couldn't open ${rel}. Does the file exist?`);
    }
  }

  async function openStep(g: Guide, index: number): Promise<void> {
    const s = g.steps[index];
    if (!s || !root) return;
    const abs = resolveInWorkspace(root, s.file);
    let line = 0;
    if (abs) {
      try {
        const doc = await vscode.workspace.openTextDocument(abs);
        line = resolveAnchor(doc.getText().split("\n"), s.anchor);
      } catch {
        /* file doesn't exist: openFile shows the warning */
      }
    }
    await openFile(s.file, line);
  }

  async function confirm(msg: string, ok: string): Promise<boolean> {
    return (await vscode.window.showWarningMessage(msg, { modal: true }, ok)) === ok;
  }

  async function handle(m: PanelMessage): Promise<void> {
    if (!tutor) return;
    switch (m.action) {
      case "generate": {
        if (!m.request || busy || generating !== null) return;
        generating = m.request;
        lastError = undefined;
        await refresh();
        const r = await tutor.generate(m.request);
        generating = null;
        if (!r.ok) lastError = r.error;
        await refresh();
        if (r.ok) await openStep(r.guide, 0);
        return;
      }
      case "hint":
        return run("hint", () => tutor.hint());
      case "review":
        return run("review", () => tutor.review());
      case "ask":
        if (!m.question?.trim()) return;
        return run("ask", () => tutor.ask(m.question!));
      case "create-file":
        return run("create", () => tutor.createFile());
      case "open-step":
        if (guide) await openStep(guide, Number(m.index));
        return;
      case "open-problem": {
        if (!m.file || !root) return;
        const abs = resolveInWorkspace(root, m.file);
        let line = 0;
        if (abs) {
          try {
            const doc = await vscode.workspace.openTextDocument(abs);
            line = clampLine(doc.getText().split("\n"), Number(m.line) || 1);
          } catch {
            /* openFile shows the warning */
          }
        }
        return openFile(m.file, line);
      }
      case "abandon":
      case "new": {
        const isNew = m.action === "new";
        const ask = isNew ? "Start a new guide? The current guide will be deleted." : "Abandon the guide? Your progress will be deleted.";
        if (busy || !(await confirm(ask, isNew ? "Start new guide" : "Abandon"))) return;
        await tutor.abandon();
        lastError = undefined;
        return refresh();
      }
    }
  }

  function updateDecorations(): void {
    for (const editor of vscode.window.visibleTextEditors) {
      const s = guide && currentStep(guide);
      const abs = s && root ? resolveInWorkspace(root, s.file) : null;
      if (!s || s.kind !== "code" || !abs || editor.document.uri.fsPath !== abs) {
        editor.setDecorations(decoration, []);
        continue;
      }
      const line = resolveAnchor(editor.document.getText().split("\n"), s.anchor);
      editor.setDecorations(decoration, [{
        range: new vscode.Range(line, 0, line, 0),
        renderOptions: { after: { contentText: `✏️ write here (step ${guide!.currentIndex + 1})` } },
      }]);
    }
  }

  if (root && tutor) {
    const guideWatcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(root, GUIDE_FILE));
    const onGuide = () => { if (!busy && generating === null) void refresh(); };
    guideWatcher.onDidChange(onGuide);
    guideWatcher.onDidCreate(onGuide);
    guideWatcher.onDidDelete(onGuide);
    const fileWatcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(root, "**/*"), false, true, true);
    fileWatcher.onDidCreate(async (uri) => {
      if (busy || generating !== null || !isPendingCreate(guide, root, uri.fsPath)) return;
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
