import { readFileSync } from "node:fs";
import * as path from "node:path";
import type { Guia, Paso } from "../guide/types";
import { currentStep } from "../guide/progress";

export interface ClaudeRequest { prompt: string; schema: object }

const RULES_HEADING = "Reglas (valen mientras la guía esté activa)";

const EXTENSION_NOTE = `
## Modo extensión (VS Code)
- Te invoca la extensión want-to-learn. No escribas ni edites ningún archivo: solo leé el proyecto y devolvé la respuesta como JSON con el schema pedido. La extensión guarda la guía.
- Las rutas de archivo siempre son relativas a la raíz del workspace (tu directorio actual).
- Si existe CLAUDE.md en la raíz, leelo para conocer las convenciones del proyecto.
- Escribí en español.
`;

export function extractSection(md: string, heading: string): string {
  const lines = md.split("\n");
  const start = lines.findIndex((l) => l.trim() === `## ${heading}`);
  if (start < 0) return "";
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => l.startsWith("## "));
  return (end < 0 ? rest : rest.slice(0, end)).join("\n");
}

export function loadRules(skillsDir: string): string {
  const md = readFileSync(path.join(skillsDir, "want-to-learn", "SKILL.md"), "utf8");
  return `# Tutor want-to-learn\n\n## Reglas\n${extractSection(md, RULES_HEADING)}\n${EXTENSION_NOTE}`;
}

const str = { type: "string" };
const strArr = { type: "array", items: str };

const pasoSchema = {
  type: "object",
  properties: {
    tipo: { type: "string", enum: ["crear-archivo", "codigo"] },
    titulo: str,
    archivo: str,
    donde: str,
    ancla: { type: "object", properties: { texto: str, linea: { type: "integer" } } },
    objetivo: str,
    conceptos: {
      type: "array",
      items: { type: "object", properties: { nombre: str, explicacion: str, docs: str }, required: ["nombre", "explicacion", "docs"] },
    },
    criterios: strArr,
    pistas: { ...strArr, minItems: 3, maxItems: 3 },
  },
  required: ["tipo", "titulo", "archivo", "donde", "objetivo", "conceptos", "criterios", "pistas"],
};

export function generateRequest(pedido: string): ClaudeRequest {
  const prompt = `El usuario quiere aprender a hacer este cambio en el proyecto:

> ${pedido}

Leé los archivos relevantes del proyecto (estructura, convenciones, librerías que ya usa, código parecido) y diseñá una guía paso a paso para que el usuario escriba el código él mismo.

Cada paso:
- toca un solo archivo ("archivo", ruta relativa a la raíz),
- tiene un resultado verificable leyendo el código,
- introduce como mucho uno o dos conceptos nuevos (explicados la primera vez que aparecen, con link a la documentación oficial en "docs"),
- "donde": ubicación precisa dentro del archivo,
- "ancla.texto": una línea que ya existe en el archivo, justo antes de donde se escribe (omitir "ancla" si el archivo es nuevo),
- "criterios": lo que la revisión va a verificar (privado),
- "pistas": exactamente 3, de suave a fuerte (1: por dónde empezar; 2: qué API o estructura usar; 3: el esqueleto en palabras), sin código resuelto.

Si un archivo no existe todavía, incluí antes un paso con "tipo": "crear-archivo" para ese archivo. Ordená los pasos para que cada uno se apoye en el anterior (normalmente 3 a 8 pasos).

Devolvé "titulo" (corto), "panorama" (2 a 4 líneas: qué vamos a construir y cómo encajan las piezas) y "pasos".`;
  return {
    prompt,
    schema: { type: "object", properties: { titulo: str, panorama: str, pasos: { type: "array", items: pasoSchema, minItems: 1 } }, required: ["titulo", "panorama", "pasos"] },
  };
}

function describeStep(g: Guia, p: Paso): string {
  return `Guía: ${g.titulo} (pedido: "${g.pedido}")
Paso ${g.pasoActual + 1} de ${g.pasos.length}: ${p.titulo}
Archivo: ${p.archivo}
Dónde: ${p.donde}
Objetivo: ${p.objetivo}`;
}

export function hintRequest(g: Guia): ClaudeRequest {
  const p = currentStep(g);
  if (!p) throw new Error("No hay paso actual");
  const nivel = Math.min(p.nivelPista + 1, 3);
  const prompt = `${describeStep(g, p)}

Pistas preparadas para este paso:
${p.pistas.map((x, i) => `${i + 1}. ${x}`).join("\n")}

El usuario pidió una pista de nivel ${nivel} (1 suave, 2 media, 3 fuerte).${p.ultimaPista ? `\nÚltima pista que recibió: ${p.ultimaPista}` : ""}

Leé ${p.archivo} para ver lo que ya escribió y adaptá la pista de nivel ${nivel} a dónde está: no repitas lo que ya resolvió. Nunca escribas el código resuelto del paso; como mucho una línea de sintaxis genérica. Devolvé "pista".`;
  return { prompt, schema: { type: "object", properties: { pista: str }, required: ["pista"] } };
}

const revisionProps = {
  aprobado: { type: "boolean" },
  mensaje: str,
  problemas: {
    type: "array",
    items: { type: "object", properties: { archivo: str, linea: { type: "integer" }, explicacion: str }, required: ["archivo", "linea", "explicacion"] },
  },
  sugerencias: strArr,
};

export function reviewRequest(g: Guia): ClaudeRequest {
  const p = currentStep(g);
  if (!p) throw new Error("No hay paso actual");
  const isLast = g.pasoActual === g.pasos.length - 1;
  const conceptos = g.pasos.slice(0, g.pasoActual + 1).flatMap((x) => x.conceptos.map((c) => c.nombre));
  let prompt = `${describeStep(g, p)}

Criterios de revisión:
${p.criterios.map((c) => `- ${c}`).join("\n")}

Leé ${p.archivo} (y lo que haga falta para entender el contexto) y revisá el código que escribió el usuario para este paso. Sé estricto con lo que rompe el comportamiento y flexible con el estilo: si lo resolvió de otra forma que funciona y respeta las convenciones del proyecto, está bien.

- "aprobado": true si cumple el objetivo.
- "mensaje": si está bien, qué hizo bien (1 a 3 líneas); si no, en una línea qué falta.
- "problemas": cada problema con archivo, línea (1-based) y por qué está mal (qué pasaría al correrlo), sin escribir el código corregido.
- "sugerencias": mejoras opcionales que no bloquean.`;
  const properties: Record<string, object> = { ...revisionProps };
  if (isLast) {
    prompt += `\n\nEs el último paso. Si lo aprobás, devolvé también "resumen": 3 a 5 líneas de lo que el usuario aprendió en esta guía (conceptos: ${conceptos.join(", ") || "los que aparecieron"}) y cómo probar el cambio funcionando.`;
    properties.resumen = str;
  }
  return { prompt, schema: { type: "object", properties, required: ["aprobado", "mensaje", "problemas", "sugerencias"] } };
}
