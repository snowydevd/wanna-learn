import type { Anchor } from "./guide/types";

/** Converts a 1-based line number to a 0-based index inside the file. */
export function clampLine(lines: string[], line1: number): number {
  const last = Math.max(lines.length - 1, 0);
  return Math.min(Math.max(Math.floor(line1) - 1, 0), last);
}

/** 0-based index of the line where the user should write. */
export function resolveAnchor(lines: string[], anchor?: Anchor): number {
  const last = Math.max(lines.length - 1, 0);
  const text = anchor?.text?.trim();
  if (text) {
    const i = lines.findIndex((l) => l.trim() === text || l.includes(text));
    if (i >= 0) return Math.min(i + 1, last);
  }
  if (anchor?.line !== undefined) return clampLine(lines, anchor.line);
  return last;
}
