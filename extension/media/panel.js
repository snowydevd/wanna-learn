// @ts-check
(function () {
  const vscode = acquireVsCodeApi();
  const root = document.getElementById("root");
  /** @type {{ collapsed?: string[] }} */
  const saved = vscode.getState() || {};
  const collapsed = new Set(saved.collapsed || []);
  /** Text box drafts: they survive every panel re-render. */
  const drafts = { request: "", question: "" };
  let askOpen = false;

  const $ = (/** @type {string} */ id) => /** @type {HTMLTextAreaElement|null} */ (document.getElementById(id));

  function apply() {
    document.querySelectorAll(".card[data-key]").forEach((el) => {
      const isCollapsed = collapsed.has(el.getAttribute("data-key") || "");
      el.classList.toggle("collapsed", isCollapsed);
      const b = el.querySelector("[data-toggle]");
      if (b) {
        b.setAttribute("aria-expanded", String(!isCollapsed));
        b.setAttribute("aria-label", isCollapsed ? "Expand" : "Collapse");
        b.setAttribute("title", isCollapsed ? "Expand" : "Collapse");
      }
    });
    for (const id of /** @type {const} */ (["request", "question"])) {
      const t = $(id);
      if (t && drafts[id]) t.value = drafts[id];
    }
    const form = document.getElementById("ask-form");
    if (form && askOpen) form.classList.remove("hidden");
  }

  function save() {
    // Only keys still on screen are saved, so the state doesn't grow forever.
    const visible = new Set(Array.from(document.querySelectorAll(".card[data-key]")).map((el) => el.getAttribute("data-key")));
    vscode.setState({ collapsed: [...collapsed].filter((k) => visible.has(k)) });
  }

  window.addEventListener("message", (e) => {
    if (!e.data || e.data.type !== "render" || !root) return;
    root.innerHTML = e.data.html;
    apply();
  });

  document.addEventListener("input", (e) => {
    const t = /** @type {HTMLTextAreaElement} */ (e.target);
    if (t.id === "request" || t.id === "question") drafts[t.id] = t.value;
  });

  document.addEventListener("click", (e) => {
    const target = /** @type {HTMLElement} */ (e.target);
    const toggle = target.closest("[data-toggle]");
    if (toggle) {
      const key = toggle.closest(".card")?.getAttribute("data-key");
      if (key) {
        collapsed.has(key) ? collapsed.delete(key) : collapsed.add(key);
        apply();
        save();
      }
      return;
    }
    const el = target.closest("[data-action]");
    if (!el || /** @type {HTMLButtonElement} */ (el).disabled) return;
    const action = el.getAttribute("data-action");
    if (action === "toggle-ask") {
      const form = document.getElementById("ask-form");
      if (!form) return;
      askOpen = form.classList.toggle("hidden") === false;
      if (askOpen) $("question")?.focus();
      return;
    }
    const msg = { action, ...(/** @type {HTMLElement} */ (el).dataset) };
    if (action === "generate") {
      const t = $("request");
      const request = (t && t.value.trim()) || "";
      if (!request) { t && t.focus(); return; }
      msg.request = request;
      drafts.request = "";
    }
    if (action === "ask") {
      const t = $("question");
      const question = (t && t.value.trim()) || "";
      if (!question) { t && t.focus(); return; }
      msg.question = question;
      drafts.question = "";
      askOpen = false;
    }
    vscode.postMessage(msg);
  });

  document.addEventListener("keydown", (e) => {
    const t = /** @type {HTMLElement} */ (e.target);
    if (!(e.key === "Enter" && (e.ctrlKey || e.metaKey))) return;
    const action = t.id === "request" ? "generate" : t.id === "question" ? "ask" : null;
    if (!action) return;
    const b = document.querySelector(`[data-action="${action}"]`);
    b && /** @type {HTMLElement} */ (b).click();
  });

  apply();
})();
