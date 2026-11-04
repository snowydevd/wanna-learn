import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { GUIDE_FILE, Tutor, type Runner } from "../src/tutor";
import { parseGuide, serializeGuide } from "../src/guide/parse";
import { guide, step } from "./fixtures/guide";

let root: string;
beforeEach(() => { root = mkdtempSync(path.join(tmpdir(), "wtl-")); });

const genData = (file = "src/new.ts") => ({
  title: "T", overview: "O",
  steps: [{ kind: "code", title: "Step", file, where: "top", goal: "G", concepts: [], criteria: ["c"], hints: ["1", "2", "3"] }],
});
const okRunner = (data: unknown): Runner => async () => ({ ok: true, data });
const noSave = async () => {};
const write = (g = guide()) => { mkdirSync(path.join(root, ".want-to-learn"), { recursive: true }); writeFileSync(path.join(root, GUIDE_FILE), serializeGuide(g)); };
const read = () => parseGuide(readFileSync(path.join(root, GUIDE_FILE), "utf8"));

describe("Tutor.load", () => {
  it("no file → none; corrupt → error", async () => {
    const t = new Tutor(root, okRunner({}), noSave);
    expect(await t.load()).toEqual({ kind: "none" });
    mkdirSync(path.join(root, ".want-to-learn"));
    writeFileSync(t.guidePath, "{broken");
    expect((await t.load()).kind).toBe("error");
  });
  it("guide lives at .want-to-learn/guide.json", () => {
    expect(new Tutor(root, okRunner({}), noSave).guidePath).toBe(path.join(root, ".want-to-learn", "guide.json"));
  });
});

describe("Tutor.generate", () => {
  it("normalizes steps and writes guide.json", async () => {
    const t = new Tutor(root, okRunner(genData()), noSave);
    const r = await t.generate("upload photos");
    expect(r.ok).toBe(true);
    const g = read();
    expect(g.ok && g.guide.steps.map((s) => s.kind)).toEqual(["create-file", "code"]);
    expect(g.ok && g.guide).toMatchObject({ request: "upload photos", currentIndex: 0, finished: false, version: 1 });
  });
  it("a runner error creates no guide and releases busy", async () => {
    const t = new Tutor(root, async () => ({ ok: false, error: "boom" }), noSave);
    const r = await t.generate("x");
    expect(r).toEqual({ ok: false, error: "boom" });
    expect(existsSync(t.guidePath)).toBe(false);
    expect(t.busy).toBe(false);
  });
  it("rejects steps with paths outside the workspace", async () => {
    const t = new Tutor(root, okRunner(genData("../outside.ts")), noSave);
    const r = await t.generate("x");
    expect(r.ok).toBe(false);
    expect(existsSync(t.guidePath)).toBe(false);
  });
  it("drops Claude's create-file steps and uses the standard ones", async () => {
    const d = genData();
    d.steps.unshift({ kind: "create-file", title: "Create with imports", file: "src/new.ts", where: "x", goal: "with imports", concepts: [], criteria: ["imports X"], hints: ["1", "2", "3"] });
    const r = await new Tutor(root, okRunner(d), noSave).generate("x");
    expect(r.ok && r.guide.steps.map((s) => s.kind)).toEqual(["create-file", "code"]);
    expect(r.ok && r.guide.steps[0].criteria).toEqual([]);
    expect(r.ok && r.guide.steps[0].goal).toBe("Create the empty file src/new.ts");
  });
  it("rejects a response without steps", async () => {
    const t = new Tutor(root, okRunner({ title: "T" }), noSave);
    expect((await t.generate("x")).ok).toBe(false);
  });
});

describe("Tutor.hint / review", () => {
  it("hint stores the hint", async () => {
    write();
    const t = new Tutor(root, okRunner({ hint: "look at X" }), noSave);
    const r = await t.hint();
    expect(r.ok && r.guide.steps[0].lastHint).toBe("look at X");
    const g = read();
    expect(g.ok && g.guide.steps[0].hintLevel).toBe(1);
  });
  it("ask stores the question and answer", async () => {
    write();
    const t = new Tutor(root, okRunner({ answer: "because" }), noSave);
    const r = await t.ask("  why?  ");
    expect(r.ok && r.guide.steps[0].lastQuestion).toEqual({ question: "why?", answer: "because" });
    const g = read();
    expect(g.ok && g.guide.steps[0].lastQuestion?.answer).toBe("because");
  });
  it("an empty question errors without calling Claude", async () => {
    write();
    let called = false;
    const t = new Tutor(root, async () => { called = true; return { ok: true, data: {} }; }, noSave);
    expect((await t.ask("   ")).ok).toBe(false);
    expect(called).toBe(false);
  });
  it("review saves before calling Claude and advances when approved", async () => {
    write();
    const order: string[] = [];
    const t = new Tutor(root, async () => { order.push("runner"); return { ok: true, data: { approved: true, message: "good", problems: [], suggestions: [] } }; },
      async () => { order.push("save"); });
    const r = await t.review();
    expect(order).toEqual(["save", "runner"]);
    expect(r.ok && r.guide.currentIndex).toBe(1);
  });
  it("review with an invalid response errors", async () => {
    write();
    const t = new Tutor(root, okRunner({ foo: 1 }), noSave);
    expect((await t.review()).ok).toBe(false);
  });
  it("a second concurrent call → Already working", async () => {
    write();
    let release!: () => void;
    const t = new Tutor(root, () => new Promise((res) => { release = () => res({ ok: true, data: { hint: "h" } }); }), noSave);
    const first = t.hint();
    await new Promise((r) => setTimeout(r, 10));
    const second = await t.hint();
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error).toContain("Already working");
    release();
    expect((await first).ok).toBe(true);
  });
});

describe("Tutor.createFile / abandon", () => {
  const cf = (file: string) => guide({ steps: [step({ id: 1, kind: "create-file", file }), step({ id: 2, file })] });
  it("creates the empty file with its folders and advances", async () => {
    write(cf("a/b/c.ts"));
    const t = new Tutor(root, okRunner({}), noSave);
    const r = await t.createFile();
    expect(readFileSync(path.join(root, "a/b/c.ts"), "utf8")).toBe("");
    expect(r.ok && r.guide.currentIndex).toBe(1);
  });
  it("doesn't overwrite an existing file", async () => {
    write(cf("x.ts"));
    writeFileSync(path.join(root, "x.ts"), "hello");
    const r = await new Tutor(root, okRunner({}), noSave).createFile();
    expect(readFileSync(path.join(root, "x.ts"), "utf8")).toBe("hello");
    expect(r.ok).toBe(true);
  });
  it("rejects paths outside the workspace", async () => {
    write(cf("../outside.ts"));
    const r = await new Tutor(root, okRunner({}), noSave).createFile();
    expect(r.ok).toBe(false);
    expect(existsSync(path.join(root, "../outside.ts"))).toBe(false);
  });
  it("abandon deletes the guide", async () => {
    write();
    const t = new Tutor(root, okRunner({}), noSave);
    await t.abandon();
    expect(existsSync(t.guidePath)).toBe(false);
  });
});

describe("Tutor.syncCreatedFile", () => {
  it("completes create-file if the user created it by hand; otherwise null", async () => {
    write(guide({ steps: [step({ id: 1, kind: "create-file", file: "m.ts" }), step({ id: 2, file: "m.ts" })] }));
    const t = new Tutor(root, okRunner({}), noSave);
    expect(await t.syncCreatedFile()).toBeNull();
    writeFileSync(path.join(root, "m.ts"), "");
    const r = await t.syncCreatedFile();
    expect(r?.ok && r.guide.currentIndex).toBe(1);
  });
});
