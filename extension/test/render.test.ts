import { describe, it, expect } from "vitest";
import { renderPanel } from "../src/webview/render";
import { guia, paso } from "./fixtures/guia";

const tres = () => guia({
  pasoActual: 1,
  pasos: [paso({ id: 1, hecho: true, titulo: "Uno", objetivo: "OBJ-1" }), paso({ id: 2, titulo: "Dos", objetivo: "OBJ-2" }), paso({ id: 3, titulo: "Tres", objetivo: "OBJ-3" })],
});

describe("renderPanel", () => {
  it("none: cuadro de pedido", () => {
    const h = renderPanel({ kind: "none" });
    expect(h).toContain("<textarea");
    expect(h).toContain('placeholder="¿Qué querés aprender a construir?"');
    expect(h).toContain('data-action="generate"');
  });
  it("no-workspace y generating", () => {
    expect(renderPanel({ kind: "no-workspace" })).toContain("Abrí una carpeta");
    expect(renderPanel({ kind: "generating", pedido: "fotos" })).toContain("fotos");
  });
  it("guide: encabezado, objetivo actual y nada privado", () => {
    const h = renderPanel({ kind: "guide", guia: tres(), busy: null });
    expect(h).toContain("Subida de fotos · 1/3");
    expect(h).toContain("OBJ-2");
    expect(h).not.toContain("OBJ-3");
    expect(h).not.toContain("CRITERIO-SECRETO");
    expect(h).not.toContain("PISTA-");
    expect(h).toContain('data-action="hint"');
    expect(h).toContain('data-action="review"');
  });
  it("clases done/cur y pendientes sin acción", () => {
    const h = renderPanel({ kind: "guide", guia: tres(), busy: null });
    expect(h).toMatch(/class="st done"[^>]*data-action="open-step"/);
    expect(h).toMatch(/class="st cur"/);
    expect(h).toMatch(/<li class="st pending">/);
  });
  it("muestra la última pista", () => {
    const g = tres();
    g.pasos[1].ultimaPista = "Empezá por el import";
    expect(renderPanel({ kind: "guide", guia: g, busy: null })).toContain("Empezá por el import");
  });
  it("crear-archivo: solo botón de crear", () => {
    const g = guia({ pasos: [paso({ id: 1, tipo: "crear-archivo" }), paso({ id: 2 })] });
    const h = renderPanel({ kind: "guide", guia: g, busy: null });
    expect(h).toContain('data-action="create-file"');
    expect(h).not.toContain('data-action="hint"');
    expect(h).not.toContain('data-action="review"');
  });
  it("revisión con problemas clicables", () => {
    const g = tres();
    g.pasos[1].ultimaRevision = { aprobado: false, mensaje: "Falta algo", problemas: [{ archivo: "convex/photos.ts", linea: 7, explicacion: "no valida" }], sugerencias: [] };
    const h = renderPanel({ kind: "guide", guia: g, busy: null });
    expect(h).toContain('data-action="open-problem"');
    expect(h).toContain('data-archivo="convex/photos.ts"');
    expect(h).toContain('data-linea="7"');
    expect(h).toContain("no valida");
  });
  it("busy deshabilita botones y error se muestra", () => {
    const h = renderPanel({ kind: "guide", guia: tres(), busy: "review", error: "falló X" });
    expect(h).toMatch(/data-action="review"[^>]*disabled/);
    expect(h).toMatch(/data-action="hint"[^>]*disabled/);
    expect(h).toContain("falló X");
  });
  it("terminada: resumen y nueva guía", () => {
    const g = guia({ terminada: true, pasoActual: 2, resumen: "Aprendiste mutations" });
    const h = renderPanel({ kind: "guide", guia: g, busy: null });
    expect(h).toContain("Aprendiste mutations");
    expect(h).toContain('data-action="new"');
  });
  it("error-guide: error y abandonar", () => {
    const h = renderPanel({ kind: "error-guide", error: "JSON roto" });
    expect(h).toContain("JSON roto");
    expect(h).toContain('data-action="abandon"');
  });
  it("escapa HTML", () => {
    const g = tres();
    g.pasos[1].objetivo = "<script>alert(1)</script>";
    const h = renderPanel({ kind: "guide", guia: g, busy: null });
    expect(h).not.toContain("<script>");
    expect(h).toContain("&lt;script&gt;");
  });
});
