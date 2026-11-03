import type { Ancla } from "./guide/types";

/** Convierte una línea 1-based a índice 0-based dentro del archivo. */
export function clampLine(lines: string[], linea1: number): number {
  const last = Math.max(lines.length - 1, 0);
  return Math.min(Math.max(Math.floor(linea1) - 1, 0), last);
}

/** Índice 0-based de la línea donde el usuario debe escribir. */
export function resolveAnchor(lines: string[], ancla?: Ancla): number {
  const last = Math.max(lines.length - 1, 0);
  const texto = ancla?.texto?.trim();
  if (texto) {
    const i = lines.findIndex((l) => l.trim() === texto || l.includes(texto));
    if (i >= 0) return Math.min(i + 1, last);
  }
  if (ancla?.linea !== undefined) return clampLine(lines, ancla.linea);
  return last;
}
