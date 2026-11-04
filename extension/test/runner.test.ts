import { describe, it, expect } from "vitest";
import { EventEmitter } from "node:events";
import { buildArgs, parseCliOutput, runClaude, type RunOptions } from "../src/claude/runner";

const opts = (over: Partial<RunOptions> = {}): RunOptions => ({
  prompt: "P", schema: { type: "object" }, systemAppend: "RULES", cwd: "/w", timeoutMs: 1000, claudePath: "claude", ...over,
});

class FakeProc extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  killed = false;
  kill() { this.killed = true; return true; }
}

describe("buildArgs", () => {
  it("builds the fixed flags", () => {
    const a = buildArgs(opts());
    expect(a.slice(0, 2)).toEqual(["-p", "P"]);
    const pairs: [string, string][] = [
      ["--output-format", "json"], ["--json-schema", JSON.stringify({ type: "object" })], ["--tools", "Read,Grep,Glob"],
      ["--setting-sources", ""], ["--append-system-prompt", "RULES"],
    ];
    for (const [f, v] of pairs) expect(a[a.indexOf(f) + 1]).toBe(v);
    expect(a).toContain("--strict-mcp-config");
    expect(a).toContain("--no-session-persistence");
    expect(a).not.toContain("--model");
  });
  it("adds --model when set", () => {
    const a = buildArgs(opts({ model: "opus" }));
    expect(a[a.indexOf("--model") + 1]).toBe("opus");
    expect(buildArgs(opts({ model: "" }))).not.toContain("--model");
  });
});

describe("parseCliOutput", () => {
  it("returns structured_output", () => {
    expect(parseCliOutput('{"is_error":false,"structured_output":{"a":1}}')).toEqual({ ok: true, data: { a: 1 } });
  });
  it("explains how to log in", () => {
    const r = parseCliOutput('{"is_error":true,"result":"Not logged in · Please run /login"}');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("claude /login");
  });
  it("fails on non-JSON stdout or missing structured_output", () => {
    expect(parseCliOutput("garbage").ok).toBe(false);
    expect(parseCliOutput('{"is_error":false,"result":"x"}').ok).toBe(false);
  });
});

describe("runClaude", () => {
  it("ENOENT gives a clear error", async () => {
    const p = new FakeProc();
    const run = runClaude(opts(), () => p as any);
    p.emit("error", Object.assign(new Error("spawn"), { code: "ENOENT" }));
    const r = await run;
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("Couldn't find the claude command");
      expect(r.error).toContain("wantToLearn.claudePath");
    }
  });
  it("timeout kills the process", async () => {
    const p = new FakeProc();
    const r = await runClaude(opts({ timeoutMs: 50 }), () => p as any);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("took too long");
    expect(p.killed).toBe(true);
  });
  it("parses the output on close", async () => {
    const p = new FakeProc();
    let seen: { cmd: string; cwd: string } | undefined;
    const run = runClaude(opts(), (cmd, _a, o) => { seen = { cmd, cwd: o.cwd }; return p as any; });
    p.stdout.emit("data", Buffer.from('{"is_error":false,'));
    p.stdout.emit("data", Buffer.from('"structured_output":{"x":2}}'));
    p.emit("close", 0);
    expect(await run).toEqual({ ok: true, data: { x: 2 } });
    expect(seen).toEqual({ cmd: "claude", cwd: "/w" });
  });
});

import { resolveClaudePath } from "../src/claude/runner";
describe("resolveClaudePath", () => {
  it("uses ~/.local/bin/claude when the setting is the default and it exists", () => {
    expect(resolveClaudePath("claude", "/h", (p) => p === "/h/.local/bin/claude")).toBe("/h/.local/bin/claude");
    expect(resolveClaudePath("claude", "/h", () => false)).toBe("claude");
    expect(resolveClaudePath("/opt/claude", "/h", () => true)).toBe("/opt/claude");
    expect(resolveClaudePath("", "/h", () => false)).toBe("claude");
  });
});
