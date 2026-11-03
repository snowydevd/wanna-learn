import { describe, it, expect } from "vitest";
import { EventEmitter } from "node:events";
import { buildArgs, parseCliOutput, runClaude, type RunOptions } from "../src/claude/runner";

const opts = (over: Partial<RunOptions> = {}): RunOptions => ({
  prompt: "P", schema: { type: "object" }, systemAppend: "REGLAS", cwd: "/w", timeoutMs: 1000, claudePath: "claude", ...over,
});

class FakeProc extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  killed = false;
  kill() { this.killed = true; return true; }
}

describe("buildArgs", () => {
  it("arma los flags fijos", () => {
    const a = buildArgs(opts());
    expect(a.slice(0, 2)).toEqual(["-p", "P"]);
    const pairs: [string, string][] = [
      ["--output-format", "json"], ["--json-schema", JSON.stringify({ type: "object" })], ["--tools", "Read,Grep,Glob"],
      ["--setting-sources", ""], ["--append-system-prompt", "REGLAS"],
    ];
    for (const [f, v] of pairs) expect(a[a.indexOf(f) + 1]).toBe(v);
    expect(a).toContain("--strict-mcp-config");
    expect(a).toContain("--no-session-persistence");
    expect(a).not.toContain("--model");
  });
  it("agrega --model si se define", () => {
    const a = buildArgs(opts({ model: "opus" }));
    expect(a[a.indexOf("--model") + 1]).toBe("opus");
    expect(buildArgs(opts({ model: "" }))).not.toContain("--model");
  });
});

describe("parseCliOutput", () => {
  it("devuelve structured_output", () => {
    expect(parseCliOutput('{"is_error":false,"structured_output":{"a":1}}')).toEqual({ ok: true, data: { a: 1 } });
  });
  it("explica cómo loguearse", () => {
    const r = parseCliOutput('{"is_error":true,"result":"Not logged in · Please run /login"}');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("claude /login");
  });
  it("falla con stdout no JSON o sin structured_output", () => {
    expect(parseCliOutput("basura").ok).toBe(false);
    expect(parseCliOutput('{"is_error":false,"result":"x"}').ok).toBe(false);
  });
});

describe("runClaude", () => {
  it("ENOENT da un error claro", async () => {
    const p = new FakeProc();
    const run = runClaude(opts(), () => p as any);
    p.emit("error", Object.assign(new Error("spawn"), { code: "ENOENT" }));
    const r = await run;
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("No encontré el comando claude");
      expect(r.error).toContain("wantToLearn.claudePath");
    }
  });
  it("timeout mata el proceso", async () => {
    const p = new FakeProc();
    const r = await runClaude(opts({ timeoutMs: 50 }), () => p as any);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("tardó demasiado");
    expect(p.killed).toBe(true);
  });
  it("parsea la salida al terminar", async () => {
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
