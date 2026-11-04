import type { Guide, Step, Question, Review } from "../guide/types";

export type ViewState =
  | { kind: "no-workspace" }
  | { kind: "none"; error?: string }
  | { kind: "generating"; request: string }
  | { kind: "error-guide"; error: string }
  | { kind: "guide"; guide: Guide; busy: null | "hint" | "review" | "create" | "ask"; error?: string };

export function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const safeUrl = (u: string) => (/^https?:\/\//i.test(u) ? u : "");

/** Short content hash: a new card gets a new key and shows expanded even if the previous one was collapsed. */
function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/** Card with a header and a collapse arrow. panel.js tracks the collapsed state by `data-key`. */
function card(cls: string, key: string, title: string, body: string): string {
  return `<div class="card ${cls}" data-key="${esc(key)}"><div class="card-h"><b>${title}</b>` +
    `<button class="collapse" data-toggle aria-expanded="true" aria-label="Collapse" title="Collapse">▾</button></div>` +
    `<div class="card-b">${body}</div></div>`;
}

function errorCard(error?: string): string {
  return error ? `<div class="card error" role="alert"><b>⚠️ Something went wrong</b><p>${esc(error)}</p></div>` : "";
}

function concepts(s: Step): string {
  if (!s.concepts.length) return "";
  const items = s.concepts.map((c) => {
    const url = safeUrl(c.docs);
    const link = url ? ` <a href="${esc(url)}">Docs</a>` : "";
    return `<li><code>${esc(c.name)}</code>: ${esc(c.explanation)}${link}</li>`;
  });
  return `<div class="row"><b>📚 New concepts</b><ul>${items.join("")}</ul></div>`;
}

function reviewCard(s: Step, r: Review): string {
  const cls = r.approved ? "ok" : "ko";
  const title = r.approved ? "✅ Nice!" : "🔍 Needs changes";
  const problems = r.problems.length
    ? `<ul class="problems">${r.problems
        .map((x) => `<li><button class="link" data-action="open-problem" data-file="${esc(x.file)}" data-line="${esc(x.line)}">${esc(x.file)}:${esc(x.line)}</button> ${esc(x.explanation)}</li>`)
        .join("")}</ul>`
    : "";
  const sug = r.suggestions.length ? `<p class="muted">Suggestions: ${r.suggestions.map(esc).join(" · ")}</p>` : "";
  return card(`review ${cls}`, `review-${s.id}-${hash(JSON.stringify(r))}`, title, `<p>${esc(r.message)}</p>${problems}${sug}`);
}

function answerCard(s: Step, q: Question): string {
  return card("answer", `answer-${s.id}-${hash(q.question + q.answer)}`, "❓ Answer",
    `<p class="muted q">${esc(q.question)}</p><p>${esc(q.answer)}</p>`);
}

function askForm(busy: null | string): string {
  const dis = busy ? " disabled" : "";
  return `<div class="ask${busy === "ask" ? "" : " hidden"}" id="ask-form">
    <textarea id="question" rows="2" placeholder="What's not clicking?"${dis}></textarea>
    <button class="primary" data-action="ask"${dis}>${busy === "ask" ? "Thinking…" : "Send"}</button>
  </div>`;
}

function detail(s: Step, busy: null | string): string {
  const dis = busy ? " disabled" : "";
  const buttons =
    s.kind === "create-file"
      ? `<button class="primary" data-action="create-file"${dis}>${busy === "create" ? "Creating…" : "📄 Create file"}</button>`
      : `<button data-action="hint"${dis}>${busy === "hint" ? "Thinking…" : "💡 Hint"}</button>` +
        `<button data-action="toggle-ask"${dis}>❓ Ask</button>` +
        `<button class="primary" data-action="review"${dis}>${busy === "review" ? "Reviewing…" : "✓ Check my code"}</button>`;
  const where = `<div class="row"><b>📍 Where:</b> ${esc(s.where)}</div>`;
  const hint = s.lastHint
    ? card("hint", `hint-${s.id}-${hash(`${s.hintLevel}:${s.lastHint}`)}`, `💡 Hint ${esc(s.hintLevel)}`, `<p>${esc(s.lastHint)}</p>`)
    : "";
  const answer = s.lastQuestion ? answerCard(s, s.lastQuestion) : "";
  const review = s.lastReview && !s.done ? reviewCard(s, s.lastReview) : "";
  return `<div class="det">
    ${where}
    <div class="row"><b>🎯 Goal:</b> ${esc(s.goal)}</div>
    ${concepts(s)}
    <div class="btns">${buttons}</div>
    ${s.kind === "code" ? askForm(busy) : ""}
  </div>${hint}${answer}${review}`;
}

function step(g: Guide, s: Step, i: number, busy: null | string): string {
  const file = `<div class="f">${esc(s.file)}${s.kind === "create-file" ? ' <span class="tag">new</span>' : ""}</div>`;
  const head = `<div class="t">${esc(s.title)}</div>${file}`;
  if (s.done) return `<li class="st done" data-action="open-step" data-index="${i}">${head}</li>`;
  if (!g.finished && i === g.currentIndex) {
    return `<li class="st cur"><div data-action="open-step" data-index="${i}">${head}</div>${detail(s, busy)}</li>`;
  }
  return `<li class="st pending">${head}</li>`;
}

function guideView(s: Extract<ViewState, { kind: "guide" }>): string {
  const g = s.guide;
  const doneCount = g.steps.filter((x) => x.done).length;
  const header = `<header><div class="goal">${esc(g.title)} · ${doneCount}/${g.steps.length}</div><p class="muted">${esc(g.overview)}</p></header>`;
  const done = g.finished
    ? `<div class="card ok"><b>🎉 You finished the guide!</b><p>${esc(g.summary ?? "")}</p><button class="primary" data-action="new">Start another guide</button></div>`
    : "";
  const list = `<ol class="tl">${g.steps.map((x, i) => step(g, x, i, s.busy)).join("")}</ol>`;
  const footer = g.finished ? "" : `<footer><button class="link muted" data-action="abandon"${s.busy ? " disabled" : ""}>Abandon guide</button></footer>`;
  return `${header}${errorCard(s.error)}${done}${list}${footer}`;
}

export function renderPanel(s: ViewState): string {
  switch (s.kind) {
    case "no-workspace":
      return `<div class="empty"><p>Open a project folder to use Want to learn.</p></div>`;
    case "none":
      return `<div class="empty">
        <h3>What do you want to learn?</h3>
        <p class="muted">Claude builds a step-by-step guide and you write the code.</p>
        <textarea id="request" rows="4" placeholder="What do you want to learn to build?"></textarea>
        <button class="primary" data-action="generate">Generate guide</button>
        ${errorCard(s.error)}
      </div>`;
    case "generating":
      return `<div class="empty"><div class="spinner" aria-hidden="true"></div><p>Claude is reading the project and building the guide for:</p><p><i>${esc(s.request)}</i></p><p class="muted">This can take a minute.</p></div>`;
    case "error-guide":
      return `<div class="empty">${errorCard(`Couldn't read the guide: ${s.error}`)}<button data-action="abandon">Abandon guide</button></div>`;
    case "guide":
      return guideView(s);
  }
}
