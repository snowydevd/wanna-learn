import * as vscode from "vscode";
import { randomBytes } from "node:crypto";
import { renderPanel, type ViewState } from "./render";

export type PanelMessage = { action: string; [k: string]: string | undefined };

export class PanelProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private state: ViewState = { kind: "none" };

  constructor(private extensionUri: vscode.Uri, private onMessage: (m: PanelMessage) => void, private onVisible: () => void) {}

  resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;
    const media = vscode.Uri.joinPath(this.extensionUri, "media");
    view.webview.options = { enableScripts: true, localResourceRoots: [media] };
    const nonce = randomBytes(16).toString("base64");
    const css = view.webview.asWebviewUri(vscode.Uri.joinPath(media, "panel.css"));
    const js = view.webview.asWebviewUri(vscode.Uri.joinPath(media, "panel.js"));
    const csp = `default-src 'none'; style-src ${view.webview.cspSource}; script-src 'nonce-${nonce}';`;
    view.webview.html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="${css}"></head>
<body><div id="root">${renderPanel(this.state)}</div><script nonce="${nonce}" src="${js}"></script></body></html>`;
    view.webview.onDidReceiveMessage((m: PanelMessage) => this.onMessage(m));
    view.onDidChangeVisibility(() => view.visible && this.onVisible());
    this.onVisible();
  }

  render(state: ViewState): void {
    this.state = state;
    this.view?.webview.postMessage({ type: "render", html: renderPanel(state) });
  }
}
