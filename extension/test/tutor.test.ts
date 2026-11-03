import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { Tutor, type Runner } from "../src/tutor";
import { parseGuide, serializeGuide } from "../src/guide/parse";
import { guia, paso } from "./fixtures/guia";

let root: string;
beforeEach(() => { root = mkdtempSync(path.join(tmpdir(), "wtl-")); });

const genData = (archivo = "src/nuevo.ts") => ({
  titulo: "T", panorama: "P",
  pasos: [{ tipo: "codigo", titulo: "Paso", archivo, donde: "arriba", objetivo: "O", conceptos: [], criterios: ["c"], pistas: ["1", "2", "3"] }],
});
const okRunner = (data: unknown): Runner => async () => ({ ok: true, data });
const noSave = async () => {};
const write = (g = guia()) => { mkdirSync(path.join(root, ".want-to-learn"), { recursive: true }); writeFileSync(path.join(root, ".want-to-learn/guia.json"), serializeGuide(g)); };
const read = () => parseGuide(readFileSync(path.join(root, ".want-to-learn/guia.json"), "utf8"));

describe("Tutor.load", () => {
  it("sin archivo → none; corrupto → error", async () => {
    const t = new Tutor(root, okRunner({}), noSave);
    expect(await t.load()).toEqual({ kind: "none" });
    mkdirSync(path.join(root, ".want-to-learn"));
    writeFileSync(t.guidePath, "{roto");
    expect((await t.load()).kind).toBe("error");
  });
});

describe("Tutor.generate", () => {
  it("normaliza pasos y escribe guia.json", async () => {
    const t = new Tutor(root, okRunner(genData()), noSave);
    const r = await t.generate("subir fotos");
    expect(r.ok).toBe(true);
    const g = read();
    expect(g.ok && g.guia.pasos.map((p) => p.tipo)).toEqual(["crear-archivo", "codigo"]);
    expect(g.ok && g.guia).toMatchObject({ pedido: "subir fotos", pasoActual: 0, terminada: false, version: 1 });
  });
  it("error del runner no crea guía y libera busy", async () => {
    const t = new Tutor(root, async () => ({ ok: false, error: "boom" }), noSave);
    const r = await t.generate("x");
    expect(r).toEqual({ ok: false, error: "boom" });
    expect(existsSync(t.guidePath)).toBe(false);
    expect(t.busy).toBe(false);
  });
  it("rechaza pasos con rutas fuera del workspace", async () => {
    const t = new Tutor(root, okRunner(genData("../fuera.ts")), noSave);
    const r = await t.generate("x");
    expect(r.ok).toBe(false);
    expect(existsSync(t.guidePath)).toBe(false);
  });
  it("descarta los crear-archivo de Claude y usa los estándar", async () => {
    const d = genData();
    d.pasos.unshift({ tipo: "crear-archivo", titulo: "Crear con imports", archivo: "src/nuevo.ts", donde: "x", objetivo: "con imports", conceptos: [], criterios: ["importa X"], pistas: ["1", "2", "3"] });
    const r = await new Tutor(root, okRunner(d), noSave).generate("x");
    expect(r.ok && r.guia.pasos.map((p) => p.tipo)).toEqual(["crear-archivo", "codigo"]);
    expect(r.ok && r.guia.pasos[0].criterios).toEqual([]);
    expect(r.ok && r.guia.pasos[0].objetivo).toBe("Crear el archivo vacío src/nuevo.ts");
  });
  it("rechaza respuesta sin pasos", async () => {
    const t = new Tutor(root, okRunner({ titulo: "T" }), noSave);
    expect((await t.generate("x")).ok).toBe(false);
  });
});

describe("Tutor.hint / review", () => {
  it("hint guarda la pista", async () => {
    write();
    const t = new Tutor(root, okRunner({ pista: "mirá X" }), noSave);
    const r = await t.hint();
    expect(r.ok && r.guia.pasos[0].ultimaPista).toBe("mirá X");
    const g = read();
    expect(g.ok && g.guia.pasos[0].nivelPista).toBe(1);
  });
  it("review guarda antes de llamar a Claude y avanza si aprueba", async () => {
    write();
    const order: string[] = [];
    const t = new Tutor(root, async () => { order.push("runner"); return { ok: true, data: { aprobado: true, mensaje: "bien", problemas: [], sugerencias: [] } }; },
      async () => { order.push("save"); });
    const r = await t.review();
    expect(order).toEqual(["save", "runner"]);
    expect(r.ok && r.guia.pasoActual).toBe(1);
  });
  it("review con respuesta inválida da error", async () => {
    write();
    const t = new Tutor(root, okRunner({ foo: 1 }), noSave);
    expect((await t.review()).ok).toBe(false);
  });
  it("segunda llamada concurrente → Ya estoy trabajando", async () => {
    write();
    let release!: () => void;
    const t = new Tutor(root, () => new Promise((res) => { release = () => res({ ok: true, data: { pista: "p" } }); }), noSave);
    const first = t.hint();
    await new Promise((r) => setTimeout(r, 10));
    const second = await t.hint();
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error).toContain("Ya estoy trabajando");
    release();
    expect((await first).ok).toBe(true);
  });
});

describe("Tutor.createFile / abandon", () => {
  const cf = (archivo: string) => guia({ pasos: [paso({ id: 1, tipo: "crear-archivo", archivo }), paso({ id: 2, archivo })] });
  it("crea el archivo vacío con carpetas y avanza", async () => {
    write(cf("a/b/c.ts"));
    const t = new Tutor(root, okRunner({}), noSave);
    const r = await t.createFile();
    expect(readFileSync(path.join(root, "a/b/c.ts"), "utf8")).toBe("");
    expect(r.ok && r.guia.pasoActual).toBe(1);
  });
  it("no pisa un archivo existente", async () => {
    write(cf("x.ts"));
    writeFileSync(path.join(root, "x.ts"), "hola");
    const r = await new Tutor(root, okRunner({}), noSave).createFile();
    expect(readFileSync(path.join(root, "x.ts"), "utf8")).toBe("hola");
    expect(r.ok).toBe(true);
  });
  it("rechaza rutas fuera del workspace", async () => {
    write(cf("../fuera.ts"));
    const r = await new Tutor(root, okRunner({}), noSave).createFile();
    expect(r.ok).toBe(false);
    expect(existsSync(path.join(root, "../fuera.ts"))).toBe(false);
  });
  it("abandon borra la guía", async () => {
    write();
    const t = new Tutor(root, okRunner({}), noSave);
    await t.abandon();
    expect(existsSync(t.guidePath)).toBe(false);
  });
});

describe("Tutor.syncCreatedFile", () => {
  it("completa el crear-archivo si el usuario lo creó a mano; si no, null", async () => {
    write(guia({ pasos: [paso({ id: 1, tipo: "crear-archivo", archivo: "m.ts" }), paso({ id: 2, archivo: "m.ts" })] }));
    const t = new Tutor(root, okRunner({}), noSave);
    expect(await t.syncCreatedFile()).toBeNull();
    writeFileSync(path.join(root, "m.ts"), "");
    const r = await t.syncCreatedFile();
    expect(r?.ok && r.guia.pasoActual).toBe(1);
  });
});
