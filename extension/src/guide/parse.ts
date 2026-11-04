import type { Guide } from "./types";

export type ParseResult = { ok: true; guide: Guide } | { ok: false; error: string };

const isStr = (v: unknown): v is string => typeof v === "string";
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isStrArr = (v: unknown) => Array.isArray(v) && v.every(isStr);

function checkStep(s: any, i: number): string | null {
  const at = `step ${i + 1}`;
  if (!s || typeof s !== "object") return `${at}: not an object`;
  if (!isNum(s.id)) return `${at}: missing "id"`;
  if (s.kind !== "create-file" && s.kind !== "code") return `${at}: invalid "kind"`;
  for (const k of ["title", "file", "where", "goal"]) if (!isStr(s[k])) return `${at}: missing "${k}"`;
  if (!Array.isArray(s.concepts)) return `${at}: missing "concepts"`;
  if (!isStrArr(s.criteria)) return `${at}: missing "criteria"`;
  if (!isStrArr(s.hints)) return `${at}: missing "hints"`;
  if (typeof s.done !== "boolean") return `${at}: missing "done"`;
  if (!isNum(s.hintLevel)) return `${at}: missing "hintLevel"`;
  return null;
}

export function parseGuide(text: string): ParseResult {
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: "guide.json is not valid JSON" };
  }
  if (!data || typeof data !== "object") return { ok: false, error: "guide.json is not an object" };
  if (data.version !== 1) return { ok: false, error: `unsupported guide version: ${String(data.version)}` };
  for (const k of ["request", "title", "overview"]) if (!isStr(data[k])) return { ok: false, error: `missing "${k}"` };
  if (typeof data.finished !== "boolean") return { ok: false, error: 'missing "finished"' };
  if (!Array.isArray(data.steps)) return { ok: false, error: 'missing "steps"' };
  for (let i = 0; i < data.steps.length; i++) {
    const err = checkStep(data.steps[i], i);
    if (err) return { ok: false, error: err };
  }
  if (!Number.isInteger(data.currentIndex) || data.currentIndex < 0 || data.currentIndex > data.steps.length) {
    return { ok: false, error: '"currentIndex" out of range' };
  }
  return { ok: true, guide: data as Guide };
}

export function serializeGuide(g: Guide): string {
  return JSON.stringify(g, null, 2) + "\n";
}
