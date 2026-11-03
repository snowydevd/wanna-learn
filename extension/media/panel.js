// @ts-check
(function () {
  const vscode = acquireVsCodeApi();
  const root = document.getElementById("root");
  window.addEventListener("message", (e) => {
    if (e.data && e.data.type === "render" && root) root.innerHTML = e.data.html;
  });
  document.addEventListener("click", (e) => {
    const target = /** @type {HTMLElement} */ (e.target);
    const el = target.closest("[data-action]");
    if (!el || /** @type {HTMLButtonElement} */ (el).disabled) return;
    const msg = { action: el.getAttribute("data-action"), ...(/** @type {HTMLElement} */ (el).dataset) };
    if (msg.action === "generate") {
      const t = /** @type {HTMLTextAreaElement|null} */ (document.getElementById("pedido"));
      const pedido = (t && t.value.trim()) || "";
      if (!pedido) { t && t.focus(); return; }
      msg.pedido = pedido;
    }
    vscode.postMessage(msg);
  });
  document.addEventListener("keydown", (e) => {
    const t = /** @type {HTMLElement} */ (e.target);
    if (t.id === "pedido" && e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      const b = document.querySelector('[data-action="generate"]');
      b && /** @type {HTMLElement} */ (b).click();
    }
  });
})();
