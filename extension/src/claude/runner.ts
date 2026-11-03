import { spawn as nodeSpawn } from "node:child_process";

export interface RunOptions {
  prompt: string;
  schema: object;
  systemAppend: string;
  cwd: string;
  model?: string;
  timeoutMs: number;
  claudePath: string;
}

export type RunResult = { ok: true; data: unknown } | { ok: false; error: string };

export interface ChildProcessLike {
  stdout: { on(ev: "data", cb: (chunk: Buffer) => void): unknown } | null;
  stderr: { on(ev: "data", cb: (chunk: Buffer) => void): unknown } | null;
  on(ev: "error", cb: (err: NodeJS.ErrnoException) => void): unknown;
  on(ev: "close", cb: (code: number | null) => void): unknown;
  kill(): boolean;
}

export type SpawnFn = (cmd: string, args: string[], opts: { cwd: string }) => ChildProcessLike;

const defaultSpawn: SpawnFn = (cmd, args, opts) =>
  nodeSpawn(cmd, args, { cwd: opts.cwd, shell: false, stdio: ["ignore", "pipe", "pipe"] });

export function buildArgs(o: RunOptions): string[] {
  const args = [
    "-p", o.prompt,
    "--output-format", "json",
    "--json-schema", JSON.stringify(o.schema),
    "--tools", "Read,Grep,Glob",
    "--strict-mcp-config",
    "--setting-sources", "",
    "--no-session-persistence",
    "--append-system-prompt", o.systemAppend,
  ];
  if (o.model) args.push("--model", o.model);
  return args;
}

export function parseCliOutput(stdout: string): RunResult {
  let d: any;
  try {
    d = JSON.parse(stdout);
  } catch {
    return { ok: false, error: "Claude devolvió una respuesta que no pude leer." };
  }
  if (d?.is_error) {
    const msg = String(d.result ?? "");
    if (/log ?in/i.test(msg)) return { ok: false, error: "Claude Code no tiene sesión iniciada. Corré `claude /login` en una terminal y volvé a intentar." };
    return { ok: false, error: `Claude devolvió un error: ${msg || "desconocido"}` };
  }
  if (d?.structured_output === undefined || d.structured_output === null) {
    return { ok: false, error: "Claude no devolvió la respuesta en el formato esperado. Probá de nuevo." };
  }
  return { ok: true, data: d.structured_output };
}

export function runClaude(o: RunOptions, spawn: SpawnFn = defaultSpawn): Promise<RunResult> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (r: RunResult) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(r);
    };
    let proc: ChildProcessLike;
    try {
      proc = spawn(o.claudePath, buildArgs(o), { cwd: o.cwd });
    } catch (e: any) {
      return resolve({ ok: false, error: `No pude ejecutar claude: ${e?.message ?? e}` });
    }
    const timer = setTimeout(() => {
      proc.kill();
      finish({ ok: false, error: `Claude tardó demasiado (más de ${Math.round(o.timeoutMs / 1000)} s). Probá de nuevo.` });
    }, o.timeoutMs);
    let out = "";
    let err = "";
    proc.stdout?.on("data", (c) => (out += c.toString()));
    proc.stderr?.on("data", (c) => (err += c.toString()));
    proc.on("error", (e) => {
      if (e.code === "ENOENT") {
        finish({ ok: false, error: `No encontré el comando claude ("${o.claudePath}"). Instalá Claude Code o configurá la ruta en el setting wantToLearn.claudePath.` });
      } else {
        finish({ ok: false, error: `No pude ejecutar claude: ${e.message}` });
      }
    });
    proc.on("close", (code) => {
      if (!out.trim() && code !== 0) {
        finish({ ok: false, error: `claude terminó con código ${code}: ${err.trim().slice(0, 400) || "sin detalles"}` });
      } else {
        finish(parseCliOutput(out));
      }
    });
  });
}
