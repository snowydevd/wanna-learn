import { readFileSync } from "node:fs";
import * as path from "node:path";
import type { Guide, Step } from "../guide/types";
import { currentStep } from "../guide/progress";

export interface ClaudeRequest { prompt: string; schema: object }

const RULES_HEADING = "Rules (apply while a guide is active)";

const EXTENSION_NOTE = `
## Extension mode (VS Code)
- You are being called by the want-to-learn extension. Do not write or edit any file: only read the project and return your answer as JSON matching the requested schema. The extension saves the guide.
- File paths are always relative to the workspace root (your current directory).
- If there is a CLAUDE.md at the root, read it to learn the project's conventions.
- Write in the same language as the user's request (quoted in each prompt). Code, file and API names stay as they are.
- The user doesn't use commands: instead of /check and /hint they have the panel buttons "✓ Check my code", "💡 Hint" and "❓ Ask". If you need to mention them, name the buttons.
- Everything you return is read in a narrow side panel: short, direct text. No greetings or introductions.
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
  return `# want-to-learn tutor\n\n## Rules\n${extractSection(md, RULES_HEADING)}\n${EXTENSION_NOTE}`;
}

const str = { type: "string" };
const strArr = { type: "array", items: str };

const stepSchema = {
  type: "object",
  properties: {
    kind: { type: "string", enum: ["code"] },
    title: str,
    file: str,
    where: str,
    anchor: { type: "object", properties: { text: str, line: { type: "integer" } } },
    goal: str,
    concepts: {
      type: "array",
      items: { type: "object", properties: { name: str, explanation: str, docs: str }, required: ["name", "explanation", "docs"] },
    },
    criteria: strArr,
    hints: { ...strArr, minItems: 3, maxItems: 3 },
  },
  required: ["kind", "title", "file", "where", "goal", "concepts", "criteria", "hints"],
};

export function generateRequest(request: string): ClaudeRequest {
  const prompt = `The user wants to learn how to make this change in the project:

> ${request}

Read the relevant project files (structure, conventions, libraries it already uses, similar code) and design a step-by-step guide so the user writes the code themselves.

Each step:
- touches a single file ("file", path relative to the root),
- has an outcome that can be verified by reading the code,
- introduces at most one or two new concepts (explained the first time they appear in 1 or 2 simple sentences, with a link to the official documentation in "docs"),
- "title": short, starting with a verb ("Compute next Sunday"),
- "goal": what the code has to achieve, in 1 or 2 direct sentences addressed to the user ("Write a function that…"),
- "where": precise location inside the file,
- "anchor.text": a line that already exists in the file, right before where the code goes (omit "anchor" if the file is new),
- "criteria": what the review will check (private),
- "hints": exactly 3, from gentle to strong (1: where to start; 2: which API or structure to use; 3: the skeleton in words), with no solved code.

Don't include create-file steps: if a step uses a file that doesn't exist yet, the extension adds a step before it that creates it empty. Everything that has to be written in that file (imports included) goes in "kind": "code" steps. Order the steps so each one builds on the previous one (usually 3 to 8 steps).

Return "title" (short), "overview" (2 or 3 short sentences: what we're going to build and how the pieces fit together) and "steps".`;
  return {
    prompt,
    schema: { type: "object", properties: { title: str, overview: str, steps: { type: "array", items: stepSchema, minItems: 1 } }, required: ["title", "overview", "steps"] },
  };
}

function describeStep(g: Guide, s: Step): string {
  return `Guide: ${g.title} (request: "${g.request}")
Step ${g.currentIndex + 1} of ${g.steps.length}: ${s.title}
File: ${s.file}
Where: ${s.where}
Goal: ${s.goal}`;
}

export function hintRequest(g: Guide): ClaudeRequest {
  const s = currentStep(g);
  if (!s) throw new Error("No current step");
  const level = s.hintLevel + 1;
  const prompt = `${describeStep(g, s)}

Hints prepared for this step:
${s.hints.map((x, i) => `${i + 1}. ${x}`).join("\n")}

The user asked for the level ${level} hint.${s.lastHint ? `\nLast hint they got: ${s.lastHint}` : ""}${s.lastQuestion ? `\nLast question they asked: ${s.lastQuestion.question}` : ""}

How much to reveal per level:
- Level 1: don't name functions or APIs; point them at what to think about or where to look in the existing code.
- Level 2: name which API, function or structure to use.
- Level 3: describe the skeleton in words.
- Level 4 or more: each one more concrete than the last. Aim at exactly where they're stuck based on what they've already written (which line, what's missing, which concept isn't clicking). If needed, explain that concept with an example different from their code. Don't repeat an earlier hint in other words.

Read ${s.file} to see what they've already written and adapt the hint to where they are: don't repeat what they already solved. Never write the solved code for the step; at most one line of generic syntax.

"hint": 1 to 3 sentences, straight to the point.`;
  return { prompt, schema: { type: "object", properties: { hint: str }, required: ["hint"] } };
}

export function askRequest(g: Guide, question: string): ClaudeRequest {
  const s = currentStep(g);
  if (!s) throw new Error("No current step");
  const prompt = `${describeStep(g, s)}

The user is on this step and asks:

> ${question}

Read ${s.file} (and whatever else you need from the project) and answer what they asked, like a teammate pairing with them: direct and short. If they ask about a concept or an API, explain it with an example different from their code and, if useful, a link to the official documentation. If the question isn't about the step, answer it anyway in one or two lines.

Don't write the solved code for the step or tell them line by line what to type: at most one line of generic syntax. If what they want is the solution, tell them that's theirs to write and give them a concrete direction.

Answer in the language of this question. "answer": as short as possible (usually 2 to 6 sentences).`;
  return { prompt, schema: { type: "object", properties: { answer: str }, required: ["answer"] } };
}

const reviewProps = {
  approved: { type: "boolean" },
  message: str,
  problems: {
    type: "array",
    items: { type: "object", properties: { file: str, line: { type: "integer" }, explanation: str }, required: ["file", "line", "explanation"] },
  },
  suggestions: strArr,
};

export function reviewRequest(g: Guide): ClaudeRequest {
  const s = currentStep(g);
  if (!s) throw new Error("No current step");
  const isLast = g.currentIndex === g.steps.length - 1;
  const concepts = g.steps.slice(0, g.currentIndex + 1).flatMap((x) => x.concepts.map((c) => c.name));
  let prompt = `${describeStep(g, s)}

Review criteria:
${s.criteria.map((c) => `- ${c}`).join("\n")}

Read ${s.file} (and whatever you need to understand the context) and review the code the user wrote for this step. Be strict about anything that breaks behavior and flexible about style: if they solved it differently in a way that works and follows the project's conventions, that's fine.

- "approved": true if it meets the goal.
- "message": one or two sentences. If it's right, what exactly they did well; if not, what's missing. No introductions.
- "problems": each problem with file, line (1-based) and why it's wrong in one sentence (what would happen when it runs), without writing the corrected code.
- "suggestions": optional, non-blocking improvements, one line each (or none).`;
  const properties: Record<string, object> = { ...reviewProps };
  if (isLast) {
    prompt += `\n\nThis is the last step. If you approve it, also return "summary": 3 or 4 short sentences on what the user learned in this guide (concepts: ${concepts.join(", ") || "the ones that came up"}) and how to try the change working.`;
    properties.summary = str;
  }
  return { prompt, schema: { type: "object", properties, required: ["approved", "message", "problems", "suggestions"] } };
}
