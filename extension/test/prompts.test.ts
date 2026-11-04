import { describe, it, expect } from "vitest";
import * as path from "node:path";
import { askRequest, extractSection, generateRequest, hintRequest, loadRules, reviewRequest } from "../src/claude/prompts";
import { guide } from "./fixtures/guide";

const skillsDir = path.resolve(__dirname, "../../skills");

describe("extractSection", () => {
  const md = "# T\n## A\none\ntwo\n## B\nthree\n";
  it("returns only the section", () => {
    expect(extractSection(md, "A").trim()).toBe("one\ntwo");
  });
  it("missing heading → empty", () => {
    expect(extractSection(md, "Z")).toBe("");
  });
});

describe("loadRules", () => {
  it("includes the skill rules and the extension-mode note", () => {
    const r = loadRules(skillsDir);
    expect(r).toContain("Don't edit or create project code files");
    expect(r).toContain("JSON");
    expect(r).toContain("Check my code");
    expect(r).toContain("Ask");
  });
  it("includes the direct-tone rule", () => {
    expect(loadRules(skillsDir)).toContain("Be direct");
  });
  it("tells Claude to answer in the language of the request", () => {
    expect(loadRules(skillsDir)).toContain("same language as the user's request");
  });
});

describe("requests", () => {
  it("generateRequest includes the request and requires steps", () => {
    const r = generateRequest("upload photos");
    expect(r.prompt).toContain("upload photos");
    expect((r.schema as any).required).toContain("steps");
    expect(r.prompt).toContain("Don't include create-file steps");
    expect((r.schema as any).properties.steps.items.properties.kind.enum).toEqual(["code"]);
  });
  it("hintRequest only uses the current step", () => {
    const g = guide();
    g.steps[0].hintLevel = 1;
    const r = hintRequest(g);
    expect(r.prompt).toContain("GOAL-1");
    for (const h of g.steps[0].hints) expect(r.prompt).toContain(h);
    expect(r.prompt).toContain("level 2");
    expect(r.prompt).toContain("Level 1: don't name functions or APIs");
    expect(r.prompt).not.toContain("GOAL-2");
    expect((r.schema as any).required).toEqual(["hint"]);
  });
  it("hintRequest goes past level 3 with no cap and asks to get concrete", () => {
    const g = guide();
    g.steps[0].hintLevel = 4;
    const r = hintRequest(g);
    expect(r.prompt).toContain("level 5");
    expect(r.prompt).toContain("Level 4 or more");
  });
  it("askRequest includes the question and current step, without criteria", () => {
    const g = guide();
    const r = askRequest(g, "why internalMutation?");
    expect(r.prompt).toContain("why internalMutation?");
    expect(r.prompt).toContain("GOAL-1");
    expect(r.prompt).not.toContain("SECRET-CRITERION");
    expect((r.schema as any).required).toEqual(["answer"]);
  });
  it("reviewRequest includes criteria and file; asks for a summary only on the last step", () => {
    const g = guide();
    const r = reviewRequest(g);
    expect(r.prompt).toContain("SECRET-CRITERION");
    expect(r.prompt).toContain("convex/schema.ts");
    expect(r.prompt).not.toContain("summary");
    const last = reviewRequest({ ...g, currentIndex: 1 });
    expect(last.prompt).toContain("summary");
    expect((last.schema as any).properties.summary).toBeDefined();
  });
});
