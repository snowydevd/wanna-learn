import { describe, it, expect } from "vitest";
import { parseGuide, serializeGuide } from "../src/guide/parse";
import { guia } from "./fixtures/guia";

describe("parseGuide", () => {
  it("roundtrip de una guía válida", () => {
    const g = guia();
    expect(parseGuide(serializeGuide(g))).toEqual({ ok: true, guia: g });
  });
  it("serializa con 2 espacios y salto final", () => {
    expect(serializeGuide(guia())).toMatch(/^\{\n  "version": 1,[\s\S]*\}\n$/);
  });
  it("rechaza texto que no es JSON", () => {
    const r = parseGuide("no json");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("JSON");
  });
  it("rechaza otra versión", () => {
    const r = parseGuide(JSON.stringify({ ...guia(), version: 2 }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("versión");
  });
  it("rechaza sin pasos", () => {
    const { pasos, ...sin } = guia();
    expect(parseGuide(JSON.stringify(sin)).ok).toBe(false);
  });
  it("rechaza pasoActual fuera de rango", () => {
    expect(parseGuide(JSON.stringify({ ...guia(), pasoActual: 3 })).ok).toBe(false);
    expect(parseGuide(JSON.stringify({ ...guia(), pasoActual: -1 })).ok).toBe(false);
  });
  it("acepta pasoActual == pasos.length (guía terminada)", () => {
    expect(parseGuide(JSON.stringify({ ...guia(), pasoActual: 2, terminada: true })).ok).toBe(true);
  });
  it("rechaza un paso con tipo inválido", () => {
    const g = guia();
    (g.pasos[0] as any).tipo = "otro";
    expect(parseGuide(JSON.stringify(g)).ok).toBe(false);
  });
});
