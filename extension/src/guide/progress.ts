import * as path from "node:path";
import type { Guide, Step, Review } from "./types";

export function currentStep(g: Guide): Step | undefined {
  return g.finished ? undefined : g.steps[g.currentIndex];
}

function updateCurrent(g: Guide, fn: (s: Step) => Step): Step[] {
  return g.steps.map((s, i) => (i === g.currentIndex ? fn(s) : s));
}

function advance(g: Guide, steps: Step[], summary?: string): Guide {
  const next = g.currentIndex + 1;
  const finished = next >= steps.length;
  const reset = steps.map((s, i) => (i === next ? { ...s, hintLevel: 0 } : s));
  return { ...g, steps: reset, currentIndex: next, finished, ...(finished && summary !== undefined ? { summary } : {}) };
}

export function applyReview(g: Guide, r: Review, summary?: string): Guide {
  if (!currentStep(g)) return g;
  const steps = updateCurrent(g, (s) => ({ ...s, lastReview: r, ...(r.approved ? { done: true } : {}) }));
  return r.approved ? advance(g, steps, summary) : { ...g, steps };
}

export function applyHint(g: Guide, hint: string): Guide {
  if (!currentStep(g)) return g;
  return { ...g, steps: updateCurrent(g, (s) => ({ ...s, lastHint: hint, hintLevel: s.hintLevel + 1 })) };
}

export function applyAnswer(g: Guide, question: string, answer: string): Guide {
  if (!currentStep(g)) return g;
  return { ...g, steps: updateCurrent(g, (s) => ({ ...s, lastQuestion: { question, answer } })) };
}

export function completeCreateFile(g: Guide): Guide {
  if (currentStep(g)?.kind !== "create-file") return g;
  return advance(g, updateCurrent(g, (s) => ({ ...s, done: true })));
}

function createStep(file: string): Step {
  const dir = path.posix.dirname(file);
  return {
    id: 0,
    kind: "create-file",
    title: "Create file",
    file,
    where: dir === "." ? "project root" : dir,
    goal: `Create the empty file ${file}`,
    concepts: [],
    criteria: [],
    hints: [],
    done: false,
    hintLevel: 0,
  };
}

export function normalizeSteps(steps: Step[], exists: (rel: string) => boolean): Step[] {
  const seen = new Set<string>();
  const out: Step[] = [];
  for (const s of steps) {
    if (!seen.has(s.file)) {
      seen.add(s.file);
      if (s.kind === "code" && !exists(s.file)) out.push(createStep(s.file));
    }
    out.push(s);
  }
  return out.map((s, i) => ({ ...s, id: i + 1 }));
}

export function resolveInWorkspace(root: string, rel: string): string | null {
  if (!rel || path.isAbsolute(rel)) return null;
  const abs = path.resolve(root, rel);
  const fromRoot = path.relative(root, abs);
  if (!fromRoot || fromRoot.startsWith("..") || path.isAbsolute(fromRoot)) return null;
  return abs;
}

/** Is the newly created file the one the current create-file step asks for? */
export function isPendingCreate(g: Guide | undefined, root: string, absPath: string): boolean {
  const s = g && currentStep(g);
  if (!s || s.kind !== "create-file") return false;
  return resolveInWorkspace(root, s.file) === path.resolve(absPath);
}
