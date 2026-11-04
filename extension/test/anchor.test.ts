import { describe, it, expect } from "vitest";
import { clampLine, resolveAnchor } from "../src/anchor";

const five = ["import a", "  import b", "", "export x", "end"];

describe("resolveAnchor", () => {
  it("line after the text (ignoring whitespace)", () => {
    expect(resolveAnchor(five, { text: "import b  " })).toBe(2);
  });
  it("missing text falls back to line", () => {
    expect(resolveAnchor(five, { text: "nope", line: 3 })).toBe(2);
  });
  it("no anchor → last line", () => {
    expect(resolveAnchor(five)).toBe(4);
  });
  it("empty file → 0", () => {
    expect(resolveAnchor([])).toBe(0);
    expect(resolveAnchor([""], { text: "x" })).toBe(0);
  });
  it("text on the last line stays inside the file", () => {
    expect(resolveAnchor(five, { text: "end" })).toBe(4);
  });
});

describe("clampLine", () => {
  it("converts 1-based to an in-range 0-based index", () => {
    expect(clampLine(five, 99)).toBe(4);
    expect(clampLine(five, 0)).toBe(0);
    expect(clampLine(five, 2)).toBe(1);
    expect(clampLine([], 3)).toBe(0);
  });
});
