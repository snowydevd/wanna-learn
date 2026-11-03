import type { Guia } from "./types";

export type ParseResult = { ok: true; guia: Guia } | { ok: false; error: string };

const isStr = (v: unknown): v is string => typeof v === "string";
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isStrArr = (v: unknown) => Array.isArray(v) && v.every(isStr);

function checkPaso(p: any, i: number): string | null {
  const at = `paso ${i + 1}`;
  if (!p || typeof p !== "object") return `${at}: no es un objeto`;
  if (!isNum(p.id)) return `${at}: falta "id"`;
  if (p.tipo !== "crear-archivo" && p.tipo !== "codigo") return `${at}: "tipo" inválido`;
  for (const k of ["titulo", "archivo", "donde", "objetivo"]) if (!isStr(p[k])) return `${at}: falta "${k}"`;
  if (!Array.isArray(p.conceptos)) return `${at}: falta "conceptos"`;
  if (!isStrArr(p.criterios)) return `${at}: falta "criterios"`;
  if (!isStrArr(p.pistas)) return `${at}: falta "pistas"`;
  if (typeof p.hecho !== "boolean") return `${at}: falta "hecho"`;
  if (!isNum(p.nivelPista)) return `${at}: falta "nivelPista"`;
  return null;
}

export function parseGuide(text: string): ParseResult {
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: "guia.json no es JSON válido" };
  }
  if (!data || typeof data !== "object") return { ok: false, error: "guia.json no es un objeto" };
  if (data.version !== 1) return { ok: false, error: `versión de guía no soportada: ${String(data.version)}` };
  for (const k of ["pedido", "titulo", "panorama"]) if (!isStr(data[k])) return { ok: false, error: `falta "${k}"` };
  if (typeof data.terminada !== "boolean") return { ok: false, error: 'falta "terminada"' };
  if (!Array.isArray(data.pasos)) return { ok: false, error: 'falta "pasos"' };
  for (let i = 0; i < data.pasos.length; i++) {
    const err = checkPaso(data.pasos[i], i);
    if (err) return { ok: false, error: err };
  }
  if (!Number.isInteger(data.pasoActual) || data.pasoActual < 0 || data.pasoActual > data.pasos.length) {
    return { ok: false, error: '"pasoActual" fuera de rango' };
  }
  return { ok: true, guia: data as Guia };
}

export function serializeGuide(g: Guia): string {
  return JSON.stringify(g, null, 2) + "\n";
}
