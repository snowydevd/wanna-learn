import type { Guia, Paso, Revision } from "../guide/types";

export type ViewState =
  | { kind: "no-workspace" }
  | { kind: "none"; error?: string }
  | { kind: "generating"; pedido: string }
  | { kind: "error-guide"; error: string }
  | { kind: "guide"; guia: Guia; busy: null | "hint" | "review" | "create"; error?: string };

export function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const safeUrl = (u: string) => (/^https?:\/\//i.test(u) ? u : "");

function errorCard(error?: string): string {
  return error ? `<div class="card error" role="alert"><b>⚠️ Algo falló</b><p>${esc(error)}</p></div>` : "";
}

function conceptos(p: Paso): string {
  if (!p.conceptos.length) return "";
  const items = p.conceptos.map((c) => {
    const url = safeUrl(c.docs);
    const link = url ? ` <a href="${esc(url)}">Docs</a>` : "";
    return `<li><code>${esc(c.nombre)}</code>: ${esc(c.explicacion)}${link}</li>`;
  });
  return `<div class="row"><b>📚 Conceptos nuevos</b><ul>${items.join("")}</ul></div>`;
}

function reviewCard(r: Revision): string {
  const cls = r.aprobado ? "ok" : "ko";
  const title = r.aprobado ? "✅ ¡Bien!" : "🔍 Hay que corregir";
  const problemas = r.problemas.length
    ? `<ul class="problems">${r.problemas
        .map((p) => `<li><button class="link" data-action="open-problem" data-archivo="${esc(p.archivo)}" data-linea="${esc(p.linea)}">${esc(p.archivo)}:${esc(p.linea)}</button> ${esc(p.explicacion)}</li>`)
        .join("")}</ul>`
    : "";
  const sug = r.sugerencias.length ? `<p class="muted">Sugerencias: ${r.sugerencias.map(esc).join(" · ")}</p>` : "";
  return `<div class="card review ${cls}"><b>${title}</b><p>${esc(r.mensaje)}</p>${problemas}${sug}</div>`;
}

function detail(p: Paso, busy: null | string): string {
  const dis = busy ? " disabled" : "";
  const buttons =
    p.tipo === "crear-archivo"
      ? `<button class="primary" data-action="create-file"${dis}>${busy === "create" ? "Creando…" : "📄 Crear archivo"}</button>`
      : `<button data-action="hint"${dis}>${busy === "hint" ? "Pensando…" : "💡 Pista"}</button>` +
        `<button class="primary" data-action="review"${dis}>${busy === "review" ? "Revisando…" : "✓ Revisar mi código"}</button>`;
  const where = `<div class="row"><b>📍 Dónde:</b> ${esc(p.donde)}</div>`;
  const hint = p.ultimaPista ? `<div class="card hint"><b>💡 Pista ${esc(p.nivelPista)}/3</b><p>${esc(p.ultimaPista)}</p></div>` : "";
  const review = p.ultimaRevision && !p.hecho ? reviewCard(p.ultimaRevision) : "";
  return `<div class="det">
    ${where}
    <div class="row"><b>🎯 Objetivo:</b> ${esc(p.objetivo)}</div>
    ${conceptos(p)}
    <div class="btns">${buttons}</div>
  </div>${hint}${review}`;
}

function step(g: Guia, p: Paso, i: number, busy: null | string): string {
  const file = `<div class="f">${esc(p.archivo)}${p.tipo === "crear-archivo" ? ' <span class="tag">nuevo</span>' : ""}</div>`;
  const head = `<div class="t">${esc(p.titulo)}</div>${file}`;
  if (p.hecho) return `<li class="st done" data-action="open-step" data-index="${i}">${head}</li>`;
  if (!g.terminada && i === g.pasoActual) {
    return `<li class="st cur"><div data-action="open-step" data-index="${i}">${head}</div>${detail(p, busy)}</li>`;
  }
  return `<li class="st pending">${head}</li>`;
}

function guide(s: Extract<ViewState, { kind: "guide" }>): string {
  const g = s.guia;
  const hechos = g.pasos.filter((p) => p.hecho).length;
  const header = `<header><div class="goal">${esc(g.titulo)} · ${hechos}/${g.pasos.length}</div><p class="muted">${esc(g.panorama)}</p></header>`;
  const done = g.terminada
    ? `<div class="card ok"><b>🎉 ¡Terminaste la guía!</b><p>${esc(g.resumen ?? "")}</p><button class="primary" data-action="new">Empezar otra guía</button></div>`
    : "";
  const list = `<ol class="tl">${g.pasos.map((p, i) => step(g, p, i, s.busy)).join("")}</ol>`;
  const footer = g.terminada ? "" : `<footer><button class="link muted" data-action="abandon"${s.busy ? " disabled" : ""}>Abandonar guía</button></footer>`;
  return `${header}${errorCard(s.error)}${done}${list}${footer}`;
}

export function renderPanel(s: ViewState): string {
  switch (s.kind) {
    case "no-workspace":
      return `<div class="empty"><p>Abrí una carpeta de proyecto para usar Want to learn.</p></div>`;
    case "none":
      return `<div class="empty">
        <h3>¿Qué querés aprender?</h3>
        <p class="muted">Claude arma una guía paso a paso y vos escribís el código.</p>
        <textarea id="pedido" rows="4" placeholder="¿Qué querés aprender a construir?"></textarea>
        <button class="primary" data-action="generate">Generar guía</button>
        ${errorCard(s.error)}
      </div>`;
    case "generating":
      return `<div class="empty"><div class="spinner" aria-hidden="true"></div><p>Claude está leyendo el proyecto y armando la guía para:</p><p><i>${esc(s.pedido)}</i></p><p class="muted">Puede tardar un minuto.</p></div>`;
    case "error-guide":
      return `<div class="empty">${errorCard(`No pude leer la guía: ${s.error}`)}<button data-action="abandon">Abandonar guía</button></div>`;
    case "guide":
      return guide(s);
  }
}
