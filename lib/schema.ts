import { z } from "zod";
import { newId } from "./blocks";
import type { Block } from "./types";

const PLACEHOLDER = /not written yet|this page is a structure|this draft is still an outline|add a gemini|gemini api key/i;

export function isPlaceholderCopy(value: string): boolean {
  return PLACEHOLDER.test(value);
}

export const flatBlockSchema = z.object({
  type: z.enum(["prose", "equation", "graph", "quiz", "short_answer", "flashcards", "code", "simulation"]),
  heading: z.string(),
  body: z.string(),
  latex: z.string(),
  caption: z.string(),
  title: z.string(),
  expression: z.string(),
  xMin: z.number(),
  xMax: z.number(),
  yMin: z.number(),
  yMax: z.number(),
  prompt: z.string(),
  choices: z.array(z.string()),
  answerIndex: z.number(),
  explanation: z.string(),
  accepted: z.array(z.string()),
  cards: z.array(z.object({ front: z.string(), back: z.string() })),
  language: z.enum(["javascript", "python"]),
  starter: z.string(),
  kind: z.enum(["wave", "projectile"]),
  note: z.string(),
});

export const lessonDraftSchema = z.object({
  title: z.string(),
  summary: z.string(),
  tags: z.array(z.string()),
  status: z.string(),
  blocks: z.array(flatBlockSchema),
});

export const editDraftSchema = z.object({
  status: z.string(),
  action: z.enum(["insert_after", "replace", "delete", "rewrite_prose"]),
  blockId: z.string(),
  prose: z.string(),
  block: flatBlockSchema,
});

const SAFE_EXPR = /^[0-9xX+\-*/^().,\sA-Za-z]+$/;
const SUPERSCRIPTS: Record<string, string> = { "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9" };

function cleanExpression(value: unknown): string {
  const rewritten = clip(value, 80)
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, (digit) => `^${SUPERSCRIPTS[digit] ?? ""}`)
    .replace(/[×·]/g, "*")
    .replace(/[−–]/g, "-")
    .replace(/^[yY]\s*=\s*/, "");
  const candidate = SAFE_EXPR.test(rewritten) ? rewritten : rewritten.replace(/[^0-9xX+\-*/^().,\sA-Za-z]/g, "");
  return SAFE_EXPR.test(candidate) && /[xX]/.test(candidate) ? candidate : "";
}

function clip(value: unknown, max: number): string {
  return String(value ?? "").trim().slice(0, max);
}

export function normalizeBlock(input: z.infer<typeof flatBlockSchema>): Block | null {
  const id = newId();
  switch (input.type) {
    case "prose": {
      const body = clip(input.body ?? "", 4000);
      if (!body || isPlaceholderCopy(body)) return null;
      return { id, type: "prose", heading: clip(input.heading || "Note", 120), body };
    }
    case "equation": {
      const latex = clip(input.latex ?? "", 300);
      if (!latex) return null;
      return { id, type: "equation", latex, caption: clip(input.caption || "", 400) };
    }
    case "graph": {
      const expression = cleanExpression(input.expression);
      if (!expression) return null;
      const xMin = input.xMin ?? -6;
      const xMax = input.xMax ?? 6;
      const yMin = input.yMin ?? -2;
      const yMax = input.yMax ?? 2;
      if (![xMin, xMax, yMin, yMax].every((n) => Number.isFinite(n)) || xMin >= xMax || yMin >= yMax) return null;
      return {
        id,
        type: "graph",
        title: clip(input.title || "Graph", 120),
        expression,
        xMin,
        xMax,
        yMin,
        yMax,
      };
    }
    case "quiz": {
      const choices = (input.choices ?? []).map((choice) => clip(choice, 200)).filter(Boolean);
      if (choices.length !== 4) return null;
      const answerIndex = Math.round(input.answerIndex ?? 0);
      if (answerIndex < 0 || answerIndex > 3) return null;
      const prompt = clip(input.prompt ?? "", 400);
      if (!prompt || isPlaceholderCopy(prompt)) return null;
      return {
        id,
        type: "quiz",
        prompt,
        choices,
        answerIndex,
        explanation: clip(input.explanation || "", 600),
      };
    }
    case "short_answer": {
      const accepted = (input.accepted ?? []).map((answer) => clip(answer, 80)).filter(Boolean).slice(0, 8);
      const prompt = clip(input.prompt ?? "", 400);
      if (!prompt || accepted.length === 0) return null;
      return { id, type: "short_answer", prompt, accepted, explanation: clip(input.explanation || "", 600) };
    }
    case "flashcards": {
      const cards = (input.cards ?? [])
        .map((card) => ({ front: clip(card.front, 160), back: clip(card.back, 240) }))
        .filter((card) => card.front && card.back)
        .slice(0, 8);
      if (cards.length < 2) return null;
      return { id, type: "flashcards", title: clip(input.title || "Cards", 120), cards };
    }
    case "code": {
      const extra = input as { code?: unknown; source?: unknown };
      const starter = clip(input.starter || extra.code || extra.source || "", 2000);
      if (!starter) return null;
      const language = String(input.language ?? "javascript").toLowerCase() === "python" ? "python" : "javascript";
      return {
        id,
        type: "code",
        title: clip(input.title || "Try it", 120),
        language,
        starter,
      };
    }
    case "simulation":
      return {
        id,
        type: "simulation",
        kind: input.kind ?? "wave",
        title: clip(input.title || "Simulation", 120),
        note: clip(input.note || "", 400),
      };
    default:
      return null;
  }
}

export function normalizeBlocks(inputs: z.infer<typeof flatBlockSchema>[]): Block[] {
  return inputs.map(normalizeBlock).filter((block): block is Block => block !== null);
}

function blockSignature(block: Block): string {
  switch (block.type) {
    case "graph":
      return `graph:${block.expression}`;
    case "equation":
      return `equation:${block.latex}`;
    case "code":
      return `code:${block.starter}`;
    case "quiz":
      return `quiz:${block.prompt}`;
    case "simulation":
      return `simulation:${block.kind}:${block.note}`;
    case "flashcards":
      return `flashcards:${block.cards.map((card) => card.front).join("|")}`;
    case "short_answer":
      return `short_answer:${block.prompt}`;
    case "prose":
      return `prose:${block.heading}`;
  }
}

export function attachArtifacts(blocks: Block[], artifacts: Block[]): Block[] {
  const seen = new Set(blocks.map(blockSignature));
  const next = [...blocks];
  for (const artifact of artifacts) {
    const key = blockSignature(artifact);
    if (seen.has(key)) continue;
    seen.add(key);
    const quizAt = next.findIndex((block) => block.type === "quiz" || block.type === "short_answer");
    if (quizAt >= 0) next.splice(quizAt, 0, artifact);
    else next.push(artifact);
  }
  return next;
}
