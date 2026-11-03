import { describe, it, expect } from "vitest";
import * as path from "node:path";
import { extractSection, generateRequest, hintRequest, loadRules, reviewRequest } from "../src/claude/prompts";
import { guia } from "./fixtures/guia";

const skillsDir = path.resolve(__dirname, "../../skills");

describe("extractSection", () => {
  const md = "# T\n## A\nuno\ndos\n## B\ntres\n";
  it("devuelve solo la sección", () => {
    expect(extractSection(md, "A").trim()).toBe("uno\ndos");
  });
  it("heading inexistente → vacío", () => {
    expect(extractSection(md, "Z")).toBe("");
  });
});

describe("loadRules", () => {
  it("incluye las reglas del skill y la nota de modo extensión", () => {
    const r = loadRules(skillsDir);
    expect(r).toContain("No edites ni crees archivos");
    expect(r).toContain("JSON");
    expect(r).toContain("Revisar mi código");
  });
});

describe("requests", () => {
  it("generateRequest incluye el pedido y requiere pasos", () => {
    const r = generateRequest("subir fotos");
    expect(r.prompt).toContain("subir fotos");
    expect((r.schema as any).required).toContain("pasos");
    expect(r.prompt).toContain("No incluyas pasos de crear archivo");
    expect((r.schema as any).properties.pasos.items.properties.tipo.enum).toEqual(["codigo"]);
  });
  it("hintRequest solo usa el paso actual", () => {
    const g = guia();
    g.pasos[0].nivelPista = 1;
    const r = hintRequest(g);
    expect(r.prompt).toContain("OBJ-1");
    for (const p of g.pasos[0].pistas) expect(r.prompt).toContain(p);
    expect(r.prompt).toContain("nivel 2");
    expect(r.prompt).toContain("Nivel 1: no nombres funciones ni APIs");
    expect(r.prompt).not.toContain("OBJ-2");
    expect((r.schema as any).required).toEqual(["pista"]);
  });
  it("reviewRequest incluye criterios y archivo; pide resumen solo en el último paso", () => {
    const g = guia();
    const r = reviewRequest(g);
    expect(r.prompt).toContain("CRITERIO-SECRETO");
    expect(r.prompt).toContain("convex/schema.ts");
    expect(r.prompt).not.toContain("resumen");
    const last = reviewRequest({ ...g, pasoActual: 1 });
    expect(last.prompt).toContain("resumen");
    expect((last.schema as any).properties.resumen).toBeDefined();
  });
});
