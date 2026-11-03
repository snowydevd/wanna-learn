import { describe, it, expect } from "vitest";
import { applyHint, applyReview, completeCreateFile, currentStep, normalizeSteps, resolveInWorkspace } from "../src/guide/progress";
import type { Revision } from "../src/guide/types";
import { guia, paso } from "./fixtures/guia";

const ok: Revision = { aprobado: true, mensaje: "bien", problemas: [], sugerencias: [] };
const mal: Revision = { aprobado: false, mensaje: "falta", problemas: [{ archivo: "a.ts", linea: 3, explicacion: "x" }], sugerencias: [] };
const tres = () => guia({ pasos: [paso({ id: 1 }), paso({ id: 2, nivelPista: 2 }), paso({ id: 3 })] });

describe("applyReview", () => {
  it("aprobado: marca hecho, avanza y resetea nivelPista del siguiente", () => {
    const g = tres();
    const r = applyReview(g, ok);
    expect(r.pasos[0].hecho).toBe(true);
    expect(r.pasos[0].ultimaRevision).toEqual(ok);
    expect(r.pasoActual).toBe(1);
    expect(r.pasos[1].nivelPista).toBe(0);
    expect(g.pasoActual).toBe(0); // no muta
    expect(g.pasos[0].hecho).toBe(false);
  });
  it("no aprobado: no avanza y guarda problemas", () => {
    const r = applyReview(tres(), mal);
    expect(r.pasoActual).toBe(0);
    expect(r.pasos[0].hecho).toBe(false);
    expect(r.pasos[0].ultimaRevision?.problemas).toHaveLength(1);
  });
  it("aprobado en el último: termina con resumen", () => {
    const r = applyReview({ ...tres(), pasoActual: 2 }, ok, "R");
    expect(r.terminada).toBe(true);
    expect(r.resumen).toBe("R");
    expect(r.pasoActual).toBe(3);
    expect(currentStep(r)).toBeUndefined();
  });
});

describe("applyHint", () => {
  it("sube nivel hasta 3 y guarda la última pista", () => {
    let g = guia();
    for (const p of ["a", "b", "c", "d"]) g = applyHint(g, p);
    expect(g.pasos[0].nivelPista).toBe(3);
    expect(g.pasos[0].ultimaPista).toBe("d");
  });
});

describe("completeCreateFile", () => {
  it("sobre paso de código devuelve la misma guía", () => {
    const g = guia();
    expect(completeCreateFile(g)).toBe(g);
  });
  it("sobre crear-archivo marca hecho y avanza", () => {
    const g = guia({ pasos: [paso({ id: 1, tipo: "crear-archivo" }), paso({ id: 2 })] });
    const r = completeCreateFile(g);
    expect(r.pasos[0].hecho).toBe(true);
    expect(r.pasoActual).toBe(1);
  });
});

describe("normalizeSteps", () => {
  it("inserta crear-archivo antes del primer paso de un archivo nuevo y renumera", () => {
    const pasos = [paso({ archivo: "a.ts" }), paso({ archivo: "a.ts" }), paso({ archivo: "b.ts" })];
    const r = normalizeSteps(pasos, (rel) => rel === "b.ts");
    expect(r.map((p) => [p.tipo, p.archivo])).toEqual([
      ["crear-archivo", "a.ts"], ["codigo", "a.ts"], ["codigo", "a.ts"], ["codigo", "b.ts"],
    ]);
    expect(r.map((p) => p.id)).toEqual([1, 2, 3, 4]);
    expect(r[0]).toMatchObject({ titulo: "Crear archivo", conceptos: [], criterios: [], pistas: [], hecho: false, nivelPista: 0 });
    expect(r[0].objetivo).toContain("a.ts");
  });
  it("no duplica si ya hay crear-archivo", () => {
    const pasos = [paso({ tipo: "crear-archivo", archivo: "a.ts" }), paso({ archivo: "a.ts" })];
    expect(normalizeSteps(pasos, () => false)).toHaveLength(2);
  });
});

describe("resolveInWorkspace", () => {
  it("resuelve rutas internas", () => {
    expect(resolveInWorkspace("/w", "src/a.ts")).toBe("/w/src/a.ts");
  });
  it("rechaza rutas que salen del workspace", () => {
    for (const r of ["../x", "/etc/passwd", "src/../../x", ""]) expect(resolveInWorkspace("/w", r)).toBeNull();
  });
});

import { isPendingCreate } from "../src/guide/progress";
describe("isPendingCreate", () => {
  const g = guia({ pasos: [paso({ id: 1, tipo: "crear-archivo", archivo: "src/a.ts" }), paso({ id: 2, archivo: "src/a.ts" })] });
  it("true solo para el archivo del crear-archivo actual", () => {
    expect(isPendingCreate(g, "/w", "/w/src/a.ts")).toBe(true);
    expect(isPendingCreate(g, "/w", "/w/node_modules/x.js")).toBe(false);
    expect(isPendingCreate({ ...g, pasoActual: 1 }, "/w", "/w/src/a.ts")).toBe(false);
    expect(isPendingCreate(undefined, "/w", "/w/src/a.ts")).toBe(false);
  });
});
