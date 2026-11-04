import { describe, it, expect } from "vitest";
import { parseGuide, serializeGuide } from "../src/guide/parse";
import { guide } from "./fixtures/guide";

describe("parseGuide", () => {
  it("round-trips a valid guide", () => {
    const g = guide();
    expect(parseGuide(serializeGuide(g))).toEqual({ ok: true, guide: g });
  });
  it("serializes with 2 spaces and a trailing newline", () => {
    expect(serializeGuide(guide())).toMatch(/^\{\n  "version": 1,[\s\S]*\}\n$/);
  });
  it("rejects text that isn't JSON", () => {
    const r = parseGuide("not json");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("JSON");
  });
  it("rejects another version", () => {
    const r = parseGuide(JSON.stringify({ ...guide(), version: 2 }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("version");
  });
  it("rejects a guide without steps", () => {
    const { steps, ...without } = guide();
    expect(parseGuide(JSON.stringify(without)).ok).toBe(false);
  });
  it("rejects currentIndex out of range", () => {
    expect(parseGuide(JSON.stringify({ ...guide(), currentIndex: 3 })).ok).toBe(false);
    expect(parseGuide(JSON.stringify({ ...guide(), currentIndex: -1 })).ok).toBe(false);
  });
  it("accepts currentIndex == steps.length (finished guide)", () => {
    expect(parseGuide(JSON.stringify({ ...guide(), currentIndex: 2, finished: true })).ok).toBe(true);
  });
  it("rejects a step with an invalid kind", () => {
    const g = guide();
    (g.steps[0] as any).kind = "other";
    expect(parseGuide(JSON.stringify(g)).ok).toBe(false);
  });
});
