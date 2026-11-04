import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import * as path from "node:path";
import type { Guide, Step, Review } from "./guide/types";
import { parseGuide, serializeGuide } from "./guide/parse";
import { applyAnswer, applyHint, applyReview, completeCreateFile, currentStep, normalizeSteps, resolveInWorkspace } from "./guide/progress";
import { askRequest, generateRequest, hintRequest, reviewRequest, type ClaudeRequest } from "./claude/prompts";
import type { RunResult } from "./claude/runner";

export type Runner = (req: ClaudeRequest) => Promise<RunResult>;
export type Result = { ok: true; guide: Guide } | { ok: false; error: string };
export type LoadResult = { kind: "none" } | { kind: "ok"; guide: Guide } | { kind: "error"; error: string };

export const GUIDE_FILE = ".want-to-learn/guide.json";

const isStr = (v: unknown): v is string => typeof v === "string";

function toReview(d: any): (Review & { summary?: string }) | null {
  if (!d || typeof d.approved !== "boolean" || !isStr(d.message) || !Array.isArray(d.problems)) return null;
  return {
    approved: d.approved,
    message: d.message,
    problems: d.problems.filter((p: any) => p && isStr(p.file) && isStr(p.explanation)).map((p: any) => ({
      file: p.file, line: Number.isFinite(p.line) ? p.line : 1, explanation: p.explanation,
    })),
    suggestions: Array.isArray(d.suggestions) ? d.suggestions.filter(isStr) : [],
    ...(isStr(d.summary) ? { summary: d.summary } : {}),
  };
}

export class Tutor {
  readonly guidePath: string;
  busy = false;

  constructor(private root: string, private runner: Runner, private saveAll: () => Promise<void>) {
    this.guidePath = path.join(root, GUIDE_FILE);
  }

  async load(): Promise<LoadResult> {
    let text: string;
    try {
      text = await readFile(this.guidePath, "utf8");
    } catch (e: any) {
      if (e?.code === "ENOENT") return { kind: "none" };
      return { kind: "error", error: `Couldn't read guide.json: ${e?.message ?? e}` };
    }
    const r = parseGuide(text);
    return r.ok ? { kind: "ok", guide: r.guide } : { kind: "error", error: r.error };
  }

  private async save(g: Guide): Promise<void> {
    await mkdir(path.dirname(this.guidePath), { recursive: true });
    await writeFile(this.guidePath, serializeGuide(g));
  }

  private async exclusive(fn: () => Promise<Result>): Promise<Result> {
    if (this.busy) return { ok: false, error: "Already working on something else, wait for it to finish." };
    this.busy = true;
    try {
      return await fn();
    } catch (e: any) {
      return { ok: false, error: e?.message ?? String(e) };
    } finally {
      this.busy = false;
    }
  }

  private async active(): Promise<{ ok: true; guide: Guide; step: Step } | { ok: false; error: string }> {
    const l = await this.load();
    if (l.kind === "none") return { ok: false, error: "There's no active guide." };
    if (l.kind === "error") return { ok: false, error: l.error };
    const step = currentStep(l.guide);
    if (!step) return { ok: false, error: "The guide is already finished." };
    return { ok: true, guide: l.guide, step };
  }

  generate(request: string): Promise<Result> {
    return this.exclusive(async () => {
      const r = await this.runner(generateRequest(request));
      if (!r.ok) return r;
      const d: any = r.data;
      if (!d || !isStr(d.title) || !Array.isArray(d.steps) || !d.steps.some((s: any) => s?.kind !== "create-file")) {
        return { ok: false, error: "Claude didn't return a valid guide. Try again." };
      }
      const raw: Step[] = d.steps.filter((s: any) => s?.kind !== "create-file").map((s: any) => ({
        id: 0,
        kind: "code" as const,
        title: String(s.title ?? ""),
        file: String(s.file ?? ""),
        where: String(s.where ?? ""),
        ...(s.anchor && typeof s.anchor === "object" ? { anchor: s.anchor } : {}),
        goal: String(s.goal ?? ""),
        concepts: Array.isArray(s.concepts) ? s.concepts : [],
        criteria: Array.isArray(s.criteria) ? s.criteria.filter(isStr) : [],
        hints: Array.isArray(s.hints) ? s.hints.filter(isStr) : [],
        done: false,
        hintLevel: 0,
      }));
      const bad = raw.find((s) => !resolveInWorkspace(this.root, s.file));
      if (bad) return { ok: false, error: `The guide had a path outside the project ("${bad.file}"). Try again.` };
      const steps = normalizeSteps(raw, (rel) => existsSync(resolveInWorkspace(this.root, rel)!));
      const guide: Guide = { version: 1, request, title: d.title, overview: isStr(d.overview) ? d.overview : "", currentIndex: 0, finished: false, steps };
      await this.save(guide);
      return { ok: true, guide };
    });
  }

  hint(): Promise<Result> {
    return this.exclusive(async () => {
      const a = await this.active();
      if (!a.ok) return a;
      const r = await this.runner(hintRequest(a.guide));
      if (!r.ok) return r;
      const hint = (r.data as any)?.hint;
      if (!isStr(hint)) return { ok: false, error: "Claude didn't return a valid hint. Try again." };
      const guide = applyHint(a.guide, hint);
      await this.save(guide);
      return { ok: true, guide };
    });
  }

  ask(question: string): Promise<Result> {
    const q = question.trim();
    if (!q) return Promise.resolve({ ok: false, error: "Type your question." });
    return this.exclusive(async () => {
      const a = await this.active();
      if (!a.ok) return a;
      await this.saveAll();
      const r = await this.runner(askRequest(a.guide, q));
      if (!r.ok) return r;
      const answer = (r.data as any)?.answer;
      if (!isStr(answer)) return { ok: false, error: "Claude didn't return a valid answer. Try again." };
      const guide = applyAnswer(a.guide, q, answer);
      await this.save(guide);
      return { ok: true, guide };
    });
  }

  review(): Promise<Result> {
    return this.exclusive(async () => {
      const a = await this.active();
      if (!a.ok) return a;
      await this.saveAll();
      const r = await this.runner(reviewRequest(a.guide));
      if (!r.ok) return r;
      const rev = toReview(r.data);
      if (!rev) return { ok: false, error: "Claude didn't return a valid review. Try again." };
      const { summary, ...review } = rev;
      const guide = applyReview(a.guide, review, summary);
      await this.save(guide);
      return { ok: true, guide };
    });
  }

  createFile(): Promise<Result> {
    return this.exclusive(async () => {
      const a = await this.active();
      if (!a.ok) return a;
      if (a.step.kind !== "create-file") return { ok: false, error: "The current step isn't a create-file step." };
      const abs = resolveInWorkspace(this.root, a.step.file);
      if (!abs) return { ok: false, error: `The path "${a.step.file}" is outside the project.` };
      await mkdir(path.dirname(abs), { recursive: true });
      if (!existsSync(abs)) await writeFile(abs, "", { flag: "wx" });
      const guide = completeCreateFile(a.guide);
      await this.save(guide);
      return { ok: true, guide };
    });
  }

  /** Marks the current create-file step done if its file already exists (the user created it by hand). */
  async syncCreatedFile(): Promise<Result | null> {
    if (this.busy) return null;
    const a = await this.active();
    if (!a.ok || a.step.kind !== "create-file") return null;
    const abs = resolveInWorkspace(this.root, a.step.file);
    if (!abs || !existsSync(abs)) return null;
    const guide = completeCreateFile(a.guide);
    await this.save(guide);
    return { ok: true, guide };
  }

  async abandon(): Promise<void> {
    await rm(this.guidePath, { force: true });
  }
}
