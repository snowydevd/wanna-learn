import { describe, it, expect } from "vitest";
import { renderPanel } from "../src/webview/render";
import { guide, step } from "./fixtures/guide";

const three = () => guide({
  currentIndex: 1,
  steps: [step({ id: 1, done: true, title: "One", goal: "GOAL-1" }), step({ id: 2, title: "Two", goal: "GOAL-2" }), step({ id: 3, title: "Three", goal: "GOAL-3" })],
});

describe("renderPanel", () => {
  it("none: request box", () => {
    const h = renderPanel({ kind: "none" });
    expect(h).toContain("<textarea");
    expect(h).toContain('placeholder="What do you want to learn to build?"');
    expect(h).toContain('data-action="generate"');
  });
  it("no-workspace and generating", () => {
    expect(renderPanel({ kind: "no-workspace" })).toContain("Open a project folder");
    expect(renderPanel({ kind: "generating", request: "photos" })).toContain("photos");
  });
  it("guide: header, current goal and nothing private", () => {
    const h = renderPanel({ kind: "guide", guide: three(), busy: null });
    expect(h).toContain("Photo upload · 1/3");
    expect(h).toContain("GOAL-2");
    expect(h).not.toContain("GOAL-3");
    expect(h).not.toContain("SECRET-CRITERION");
    expect(h).not.toContain("HINT-");
    expect(h).toContain('data-action="hint"');
    expect(h).toContain('data-action="review"');
  });
  it("done/cur classes and pending steps without an action", () => {
    const h = renderPanel({ kind: "guide", guide: three(), busy: null });
    expect(h).toMatch(/class="st done"[^>]*data-action="open-step"/);
    expect(h).toMatch(/class="st cur"/);
    expect(h).toMatch(/<li class="st pending">/);
  });
  it("shows the last hint", () => {
    const g = three();
    g.steps[1].lastHint = "Start with the import";
    expect(renderPanel({ kind: "guide", guide: g, busy: null })).toContain("Start with the import");
  });
  it("hint without '/3' and with a collapse arrow", () => {
    const g = three();
    g.steps[1].lastHint = "Look at the import";
    g.steps[1].hintLevel = 5;
    const h = renderPanel({ kind: "guide", guide: g, busy: null });
    expect(h).toContain("Hint 5");
    expect(h).not.toContain("Hint 5/3");
    expect(h).toMatch(/class="card hint"[^>]*data-key="hint-2-[a-z0-9]+"/);
    expect(h).toMatch(/data-toggle[^>]*aria-expanded="true"/);
  });
  it("the card key changes with its content", () => {
    const g = three();
    g.steps[1].lastHint = "one";
    const a = renderPanel({ kind: "guide", guide: g, busy: null }).match(/data-key="(hint-[^"]+)"/)![1];
    g.steps[1].lastHint = "two";
    const b = renderPanel({ kind: "guide", guide: g, busy: null }).match(/data-key="(hint-[^"]+)"/)![1];
    expect(a).not.toBe(b);
  });
  it("ask button with its form and a collapsible answer card", () => {
    const g = three();
    g.steps[1].lastQuestion = { question: "what is <v>?", answer: "The validator" };
    const h = renderPanel({ kind: "guide", guide: g, busy: null });
    expect(h).toContain('data-action="toggle-ask"');
    expect(h).toContain('id="question"');
    expect(h).toContain('data-action="ask"');
    expect(h).toContain("what is &lt;v&gt;?");
    expect(h).toContain("The validator");
    expect(h).toMatch(/class="card answer"[^>]*data-key="answer-2-/);
  });
  it("collapsible review", () => {
    const g = three();
    g.steps[1].lastReview = { approved: false, message: "Missing", problems: [], suggestions: [] };
    expect(renderPanel({ kind: "guide", guide: g, busy: null })).toMatch(/class="card review ko"[^>]*data-key="review-2-/);
  });
  it("busy ask: Thinking on the send button", () => {
    const h = renderPanel({ kind: "guide", guide: three(), busy: "ask" });
    expect(h).toMatch(/data-action="ask"[^>]*disabled[^>]*>Thinking…/);
  });
  it("create-file: only the create button", () => {
    const g = guide({ steps: [step({ id: 1, kind: "create-file" }), step({ id: 2 })] });
    const h = renderPanel({ kind: "guide", guide: g, busy: null });
    expect(h).toContain('data-action="create-file"');
    expect(h).not.toContain('data-action="hint"');
    expect(h).not.toContain('data-action="review"');
    expect(h).not.toContain('data-action="toggle-ask"');
  });
  it("review with clickable problems", () => {
    const g = three();
    g.steps[1].lastReview = { approved: false, message: "Something's missing", problems: [{ file: "convex/photos.ts", line: 7, explanation: "doesn't validate" }], suggestions: [] };
    const h = renderPanel({ kind: "guide", guide: g, busy: null });
    expect(h).toContain('data-action="open-problem"');
    expect(h).toContain('data-file="convex/photos.ts"');
    expect(h).toContain('data-line="7"');
    expect(h).toContain("doesn&#39;t validate");
  });
  it("busy disables buttons and the error is shown", () => {
    const h = renderPanel({ kind: "guide", guide: three(), busy: "review", error: "X failed" });
    expect(h).toMatch(/data-action="review"[^>]*disabled/);
    expect(h).toMatch(/data-action="hint"[^>]*disabled/);
    expect(h).toContain("X failed");
  });
  it("finished: summary and new guide", () => {
    const g = guide({ finished: true, currentIndex: 2, summary: "You learned mutations" });
    const h = renderPanel({ kind: "guide", guide: g, busy: null });
    expect(h).toContain("You learned mutations");
    expect(h).toContain('data-action="new"');
  });
  it("error-guide: error and abandon", () => {
    const h = renderPanel({ kind: "error-guide", error: "broken JSON" });
    expect(h).toContain("broken JSON");
    expect(h).toContain('data-action="abandon"');
  });
  it("escapes HTML", () => {
    const g = three();
    g.steps[1].goal = "<script>alert(1)</script>";
    const h = renderPanel({ kind: "guide", guide: g, busy: null });
    expect(h).not.toContain("<script>");
    expect(h).toContain("&lt;script&gt;");
  });
});
