import { describe, it, expect } from "vitest";
import { applyAnswer, applyHint, applyReview, completeCreateFile, currentStep, isPendingCreate, normalizeSteps, resolveInWorkspace } from "../src/guide/progress";
import type { Review } from "../src/guide/types";
import { guide, step } from "./fixtures/guide";

const ok: Review = { approved: true, message: "good", problems: [], suggestions: [] };
const bad: Review = { approved: false, message: "missing", problems: [{ file: "a.ts", line: 3, explanation: "x" }], suggestions: [] };
const three = () => guide({ steps: [step({ id: 1 }), step({ id: 2, hintLevel: 2 }), step({ id: 3 })] });

describe("applyReview", () => {
  it("approved: marks done, advances and resets the next step's hintLevel", () => {
    const g = three();
    const r = applyReview(g, ok);
    expect(r.steps[0].done).toBe(true);
    expect(r.steps[0].lastReview).toEqual(ok);
    expect(r.currentIndex).toBe(1);
    expect(r.steps[1].hintLevel).toBe(0);
    expect(g.currentIndex).toBe(0); // doesn't mutate
    expect(g.steps[0].done).toBe(false);
  });
  it("not approved: doesn't advance and keeps the problems", () => {
    const r = applyReview(three(), bad);
    expect(r.currentIndex).toBe(0);
    expect(r.steps[0].done).toBe(false);
    expect(r.steps[0].lastReview?.problems).toHaveLength(1);
  });
  it("approved on the last step: finishes with a summary", () => {
    const r = applyReview({ ...three(), currentIndex: 2 }, ok, "S");
    expect(r.finished).toBe(true);
    expect(r.summary).toBe("S");
    expect(r.currentIndex).toBe(3);
    expect(currentStep(r)).toBeUndefined();
  });
});

describe("applyHint", () => {
  it("raises the level with no cap and keeps the last hint", () => {
    let g = guide();
    for (const h of ["a", "b", "c", "d", "e"]) g = applyHint(g, h);
    expect(g.steps[0].hintLevel).toBe(5);
    expect(g.steps[0].lastHint).toBe("e");
  });
});

describe("applyAnswer", () => {
  it("stores the question and answer on the current step", () => {
    const g = applyAnswer(guide(), "what is v?", "The validator");
    expect(g.steps[0].lastQuestion).toEqual({ question: "what is v?", answer: "The validator" });
    expect(g.steps[1].lastQuestion).toBeUndefined();
  });
});

describe("completeCreateFile", () => {
  it("returns the same guide on a code step", () => {
    const g = guide();
    expect(completeCreateFile(g)).toBe(g);
  });
  it("on create-file marks it done and advances", () => {
    const g = guide({ steps: [step({ id: 1, kind: "create-file" }), step({ id: 2 })] });
    const r = completeCreateFile(g);
    expect(r.steps[0].done).toBe(true);
    expect(r.currentIndex).toBe(1);
  });
});

describe("normalizeSteps", () => {
  it("inserts create-file before the first step of a new file and renumbers", () => {
    const steps = [step({ file: "a.ts" }), step({ file: "a.ts" }), step({ file: "b.ts" })];
    const r = normalizeSteps(steps, (rel) => rel === "b.ts");
    expect(r.map((s) => [s.kind, s.file])).toEqual([
      ["create-file", "a.ts"], ["code", "a.ts"], ["code", "a.ts"], ["code", "b.ts"],
    ]);
    expect(r.map((s) => s.id)).toEqual([1, 2, 3, 4]);
    expect(r[0]).toMatchObject({ title: "Create file", concepts: [], criteria: [], hints: [], done: false, hintLevel: 0 });
    expect(r[0].goal).toContain("a.ts");
  });
  it("doesn't duplicate an existing create-file", () => {
    const steps = [step({ kind: "create-file", file: "a.ts" }), step({ file: "a.ts" })];
    expect(normalizeSteps(steps, () => false)).toHaveLength(2);
  });
});

describe("resolveInWorkspace", () => {
  it("resolves paths inside the workspace", () => {
    expect(resolveInWorkspace("/w", "src/a.ts")).toBe("/w/src/a.ts");
  });
  it("rejects paths that leave the workspace", () => {
    for (const r of ["../x", "/etc/passwd", "src/../../x", ""]) expect(resolveInWorkspace("/w", r)).toBeNull();
  });
});

describe("isPendingCreate", () => {
  const g = guide({ steps: [step({ id: 1, kind: "create-file", file: "src/a.ts" }), step({ id: 2, file: "src/a.ts" })] });
  it("true only for the current create-file step's file", () => {
    expect(isPendingCreate(g, "/w", "/w/src/a.ts")).toBe(true);
    expect(isPendingCreate(g, "/w", "/w/node_modules/x.js")).toBe(false);
    expect(isPendingCreate({ ...g, currentIndex: 1 }, "/w", "/w/src/a.ts")).toBe(false);
    expect(isPendingCreate(undefined, "/w", "/w/src/a.ts")).toBe(false);
  });
});
