import { describe, it, expect } from "vitest";
import { clampLine, resolveAnchor } from "../src/anchor";

const five = ["import a", "  import b", "", "export x", "fin"];

describe("resolveAnchor", () => {
  it("línea siguiente al texto (ignorando espacios)", () => {
    expect(resolveAnchor(five, { texto: "import b  " })).toBe(2);
  });
  it("texto ausente usa linea", () => {
    expect(resolveAnchor(five, { texto: "nope", linea: 3 })).toBe(2);
  });
  it("sin ancla → última línea", () => {
    expect(resolveAnchor(five)).toBe(4);
  });
  it("archivo vacío → 0", () => {
    expect(resolveAnchor([])).toBe(0);
    expect(resolveAnchor([""], { texto: "x" })).toBe(0);
  });
  it("texto en la última línea no se sale del archivo", () => {
    expect(resolveAnchor(five, { texto: "fin" })).toBe(4);
  });
});

describe("clampLine", () => {
  it("convierte 1-based a 0-based dentro de rango", () => {
    expect(clampLine(five, 99)).toBe(4);
    expect(clampLine(five, 0)).toBe(0);
    expect(clampLine(five, 2)).toBe(1);
    expect(clampLine([], 3)).toBe(0);
  });
});
