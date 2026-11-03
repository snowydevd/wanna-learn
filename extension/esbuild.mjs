import { build } from "esbuild";
import { cpSync, rmSync } from "node:fs";

rmSync("dist", { recursive: true, force: true });
await build({
  entryPoints: ["src/extension.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node20",
  outfile: "dist/extension.js",
  external: ["vscode"],
  sourcemap: true,
});
cpSync("../skills", "dist/skills", { recursive: true });
