import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import * as path from "node:path";
import type { Guia, Paso, Revision } from "./guide/types";
import { parseGuide, serializeGuide } from "./guide/parse";
import { applyHint, applyReview, completeCreateFile, currentStep, normalizeSteps, resolveInWorkspace } from "./guide/progress";
import { generateRequest, hintRequest, reviewRequest, type ClaudeRequest } from "./claude/prompts";
import type { RunResult } from "./claude/runner";

export type Runner = (req: ClaudeRequest) => Promise<RunResult>;
export type Result = { ok: true; guia: Guia } | { ok: false; error: string };
export type LoadResult = { kind: "none" } | { kind: "ok"; guia: Guia } | { kind: "error"; error: string };

const isStr = (v: unknown): v is string => typeof v === "string";

function toRevision(d: any): (Revision & { resumen?: string }) | null {
  if (!d || typeof d.aprobado !== "boolean" || !isStr(d.mensaje) || !Array.isArray(d.problemas)) return null;
  return {
    aprobado: d.aprobado,
    mensaje: d.mensaje,
    problemas: d.problemas.filter((p: any) => p && isStr(p.archivo) && isStr(p.explicacion)).map((p: any) => ({
      archivo: p.archivo, linea: Number.isFinite(p.linea) ? p.linea : 1, explicacion: p.explicacion,
    })),
    sugerencias: Array.isArray(d.sugerencias) ? d.sugerencias.filter(isStr) : [],
    ...(isStr(d.resumen) ? { resumen: d.resumen } : {}),
  };
}

export class Tutor {
  readonly guidePath: string;
  busy = false;

  constructor(private root: string, private runner: Runner, private saveAll: () => Promise<void>) {
    this.guidePath = path.join(root, ".want-to-learn", "guia.json");
  }

  async load(): Promise<LoadResult> {
    let text: string;
    try {
      text = await readFile(this.guidePath, "utf8");
    } catch (e: any) {
      if (e?.code === "ENOENT") return { kind: "none" };
      return { kind: "error", error: `No pude leer guia.json: ${e?.message ?? e}` };
    }
    const r = parseGuide(text);
    return r.ok ? { kind: "ok", guia: r.guia } : { kind: "error", error: r.error };
  }

  private async save(g: Guia): Promise<void> {
    await mkdir(path.dirname(this.guidePath), { recursive: true });
    await writeFile(this.guidePath, serializeGuide(g));
  }

  private async exclusive(fn: () => Promise<Result>): Promise<Result> {
    if (this.busy) return { ok: false, error: "Ya estoy trabajando en otra cosa, esperá a que termine." };
    this.busy = true;
    try {
      return await fn();
    } catch (e: any) {
      return { ok: false, error: e?.message ?? String(e) };
    } finally {
      this.busy = false;
    }
  }

  private async active(): Promise<{ ok: true; guia: Guia; paso: Paso } | { ok: false; error: string }> {
    const l = await this.load();
    if (l.kind === "none") return { ok: false, error: "No hay una guía activa." };
    if (l.kind === "error") return { ok: false, error: l.error };
    const paso = currentStep(l.guia);
    if (!paso) return { ok: false, error: "La guía ya está terminada." };
    return { ok: true, guia: l.guia, paso };
  }

  generate(pedido: string): Promise<Result> {
    return this.exclusive(async () => {
      const r = await this.runner(generateRequest(pedido));
      if (!r.ok) return r;
      const d: any = r.data;
      if (!d || !isStr(d.titulo) || !Array.isArray(d.pasos) || d.pasos.length === 0) {
        return { ok: false, error: "Claude no devolvió una guía válida. Probá de nuevo." };
      }
      const raw: Paso[] = d.pasos.map((p: any) => ({
        id: 0,
        tipo: p.tipo === "crear-archivo" ? "crear-archivo" : "codigo",
        titulo: String(p.titulo ?? ""),
        archivo: String(p.archivo ?? ""),
        donde: String(p.donde ?? ""),
        ...(p.ancla && typeof p.ancla === "object" ? { ancla: p.ancla } : {}),
        objetivo: String(p.objetivo ?? ""),
        conceptos: Array.isArray(p.conceptos) ? p.conceptos : [],
        criterios: Array.isArray(p.criterios) ? p.criterios.filter(isStr) : [],
        pistas: Array.isArray(p.pistas) ? p.pistas.filter(isStr) : [],
        hecho: false,
        nivelPista: 0,
      }));
      const bad = raw.find((p) => !resolveInWorkspace(this.root, p.archivo));
      if (bad) return { ok: false, error: `La guía tenía una ruta fuera del proyecto ("${bad.archivo}"). Probá de nuevo.` };
      const pasos = normalizeSteps(raw, (rel) => existsSync(resolveInWorkspace(this.root, rel)!));
      const guia: Guia = { version: 1, pedido, titulo: d.titulo, panorama: isStr(d.panorama) ? d.panorama : "", pasoActual: 0, terminada: false, pasos };
      await this.save(guia);
      return { ok: true, guia };
    });
  }

  hint(): Promise<Result> {
    return this.exclusive(async () => {
      const a = await this.active();
      if (!a.ok) return a;
      const r = await this.runner(hintRequest(a.guia));
      if (!r.ok) return r;
      const pista = (r.data as any)?.pista;
      if (!isStr(pista)) return { ok: false, error: "Claude no devolvió una pista válida. Probá de nuevo." };
      const guia = applyHint(a.guia, pista);
      await this.save(guia);
      return { ok: true, guia };
    });
  }

  review(): Promise<Result> {
    return this.exclusive(async () => {
      const a = await this.active();
      if (!a.ok) return a;
      await this.saveAll();
      const r = await this.runner(reviewRequest(a.guia));
      if (!r.ok) return r;
      const rev = toRevision(r.data);
      if (!rev) return { ok: false, error: "Claude no devolvió una revisión válida. Probá de nuevo." };
      const { resumen, ...revision } = rev;
      const guia = applyReview(a.guia, revision, resumen);
      await this.save(guia);
      return { ok: true, guia };
    });
  }

  createFile(): Promise<Result> {
    return this.exclusive(async () => {
      const a = await this.active();
      if (!a.ok) return a;
      if (a.paso.tipo !== "crear-archivo") return { ok: false, error: "El paso actual no es de crear archivo." };
      const abs = resolveInWorkspace(this.root, a.paso.archivo);
      if (!abs) return { ok: false, error: `La ruta "${a.paso.archivo}" está fuera del proyecto.` };
      await mkdir(path.dirname(abs), { recursive: true });
      if (!existsSync(abs)) await writeFile(abs, "", { flag: "wx" });
      const guia = completeCreateFile(a.guia);
      await this.save(guia);
      return { ok: true, guia };
    });
  }

  /** Marca hecho el paso crear-archivo actual si su archivo ya existe (lo creó el usuario a mano). */
  async syncCreatedFile(): Promise<Result | null> {
    if (this.busy) return null;
    const a = await this.active();
    if (!a.ok || a.paso.tipo !== "crear-archivo") return null;
    const abs = resolveInWorkspace(this.root, a.paso.archivo);
    if (!abs || !existsSync(abs)) return null;
    const guia = completeCreateFile(a.guia);
    await this.save(guia);
    return { ok: true, guia };
  }

  async abandon(): Promise<void> {
    await rm(this.guidePath, { force: true });
  }
}
