import * as path from "node:path";
import type { Guia, Paso, Revision } from "./types";

export function currentStep(g: Guia): Paso | undefined {
  return g.terminada ? undefined : g.pasos[g.pasoActual];
}

function updateCurrent(g: Guia, fn: (p: Paso) => Paso): Paso[] {
  return g.pasos.map((p, i) => (i === g.pasoActual ? fn(p) : p));
}

function advance(g: Guia, pasos: Paso[], resumen?: string): Guia {
  const next = g.pasoActual + 1;
  const terminada = next >= pasos.length;
  const reset = pasos.map((p, i) => (i === next ? { ...p, nivelPista: 0 } : p));
  return { ...g, pasos: reset, pasoActual: next, terminada, ...(terminada && resumen !== undefined ? { resumen } : {}) };
}

export function applyReview(g: Guia, r: Revision, resumen?: string): Guia {
  if (!currentStep(g)) return g;
  const pasos = updateCurrent(g, (p) => ({ ...p, ultimaRevision: r, ...(r.aprobado ? { hecho: true } : {}) }));
  return r.aprobado ? advance(g, pasos, resumen) : { ...g, pasos };
}

export function applyHint(g: Guia, pista: string): Guia {
  if (!currentStep(g)) return g;
  return { ...g, pasos: updateCurrent(g, (p) => ({ ...p, ultimaPista: pista, nivelPista: Math.min(p.nivelPista + 1, 3) })) };
}

export function completeCreateFile(g: Guia): Guia {
  if (currentStep(g)?.tipo !== "crear-archivo") return g;
  return advance(g, updateCurrent(g, (p) => ({ ...p, hecho: true })));
}

function createStep(archivo: string): Paso {
  const dir = path.posix.dirname(archivo);
  return {
    id: 0,
    tipo: "crear-archivo",
    titulo: "Crear archivo",
    archivo,
    donde: dir === "." ? "raíz del proyecto" : dir,
    objetivo: `Crear el archivo vacío ${archivo}`,
    conceptos: [],
    criterios: [],
    pistas: [],
    hecho: false,
    nivelPista: 0,
  };
}

export function normalizeSteps(pasos: Paso[], exists: (rel: string) => boolean): Paso[] {
  const seen = new Set<string>();
  const out: Paso[] = [];
  for (const p of pasos) {
    if (!seen.has(p.archivo)) {
      seen.add(p.archivo);
      if (p.tipo === "codigo" && !exists(p.archivo)) out.push(createStep(p.archivo));
    }
    out.push(p);
  }
  return out.map((p, i) => ({ ...p, id: i + 1 }));
}

export function resolveInWorkspace(root: string, rel: string): string | null {
  if (!rel || path.isAbsolute(rel)) return null;
  const abs = path.resolve(root, rel);
  const fromRoot = path.relative(root, abs);
  if (!fromRoot || fromRoot.startsWith("..") || path.isAbsolute(fromRoot)) return null;
  return abs;
}

/** ¿El archivo recién creado es el que pide el paso crear-archivo actual? */
export function isPendingCreate(g: Guia | undefined, root: string, absPath: string): boolean {
  const p = g && currentStep(g);
  if (!p || p.tipo !== "crear-archivo") return false;
  return resolveInWorkspace(root, p.archivo) === path.resolve(absPath);
}
