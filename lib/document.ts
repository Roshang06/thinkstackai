import { code, equation, flashcards, graph, quiz, simulation } from "./blocks";
import type { Block, CommandInput, ProseBlock } from "./types";

const BLOCK_TYPES = new Set([
  "prose",
  "equation",
  "graph",
  "quiz",
  "short_answer",
  "flashcards",
  "code",
  "simulation",
  "widget",
]);

export function isBlock(value: unknown): value is Block {
  if (!value || typeof value !== "object") return false;
  const block = value as Block;
  if (typeof block.id !== "string" || block.id.length < 4 || block.id.length > 80) return false;
  if (!BLOCK_TYPES.has(block.type)) return false;

  switch (block.type) {
    case "prose":
      return typeof block.heading === "string" && typeof block.body === "string";
    case "equation":
      return typeof block.latex === "string" && typeof block.caption === "string";
    case "graph":
      return (
        typeof block.title === "string" &&
        typeof block.expression === "string" &&
        [block.xMin, block.xMax, block.yMin, block.yMax].every((n) => typeof n === "number" && Number.isFinite(n))
      );
    case "quiz":
      return (
        typeof block.prompt === "string" &&
        Array.isArray(block.choices) &&
        block.choices.length === 4 &&
        block.choices.every((choice) => typeof choice === "string") &&
        Number.isInteger(block.answerIndex) &&
        block.answerIndex >= 0 &&
        block.answerIndex < 4 &&
        typeof block.explanation === "string"
      );
    case "short_answer":
      return (
        typeof block.prompt === "string" &&
        Array.isArray(block.accepted) &&
        block.accepted.length > 0 &&
        block.accepted.every((answer) => typeof answer === "string") &&
        typeof block.explanation === "string"
      );
    case "flashcards":
      return (
        typeof block.title === "string" &&
        Array.isArray(block.cards) &&
        block.cards.length > 0 &&
        block.cards.every((card) => typeof card.front === "string" && typeof card.back === "string")
      );
    case "code":
      return (
        typeof block.title === "string" &&
        (block.language === "javascript" || block.language === "python") &&
        typeof block.starter === "string"
      );
    case "simulation":
      return (
        (block.kind === "wave" || block.kind === "projectile") &&
        typeof block.title === "string" &&
        typeof block.note === "string"
      );
    case "widget":
      return typeof block.title === "string" && typeof block.brief === "string" && typeof block.html === "string";
    default:
      return false;
  }
}

export function progressPercent(completed: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((completed / total) * 100);
}

export function partNumber(blocks: Block[], blockId: string | null | undefined): number {
  const index = blocks.findIndex((block) => block.id === blockId);
  return index >= 0 ? index + 1 : blocks.length;
}

function insertAfter(blocks: Block[], afterId: string | null | undefined, block: Block): Block[] {
  const index = blocks.findIndex((item) => item.id === afterId);
  const next = blocks.slice();
  next.splice(index >= 0 ? index + 1 : next.length, 0, block);
  return next;
}

export function applyOfflineCommand(blocks: Block[], input: CommandInput): { blocks: Block[]; status: string } {
  const instruction = input.instruction.trim();
  const lower = instruction.toLowerCase();
  const index = blocks.findIndex((block) => block.id === input.blockId);
  const part = index >= 0 ? index + 1 : Math.max(blocks.length, 1);
  const afterId = index >= 0 ? blocks[index].id : blocks[blocks.length - 1]?.id;

  const inserted = (block: Block, label: string) => ({
    blocks: insertAfter(blocks, afterId, block),
    status: `Added ${label} after part ${part}.`,
  });

  if (/delete|remove/.test(lower) && index >= 0) {
    return {
      blocks: blocks.filter((block) => block.id !== input.blockId),
      status: `Removed part ${part}.`,
    };
  }

  if (/shorter|concise|brief|tighten/.test(lower) && index >= 0 && blocks[index].type === "prose") {
    const block = blocks[index] as ProseBlock;
    const sentences = block.body.split(/(?<=[.!?])\s+/).slice(0, 2).join(" ");
    const next = blocks.slice();
    next[index] = { ...block, body: sentences || block.body };
    return { blocks: next, status: `Shortened part ${part}.` };
  }

  if (/projectile|trajectory|launch/.test(lower)) {
    return inserted(
      simulation("projectile", "Projectile path", "Change the angle and speed. Gravity pulls the path into a parabola."),
      "a projectile simulation",
    );
  }

  if (/simulat|animat|wave|visual/.test(lower)) {
    return inserted(
      simulation("wave", "Wave simulation", "Frequency is how many cycles fit across the screen. Amplitude is the height."),
      "a wave simulation",
    );
  }

  if (/graph|plot|chart/.test(lower)) {
    return inserted(graph("Plot", "sin(x)"), "a graph");
  }

  if (/flashcard|quizlet|memor/.test(lower)) {
    return inserted(
      flashcards("Key terms", [
        { front: "Idea", back: "Say the idea in one sentence before you flip." },
        { front: "Check", back: "Use the question blocks to see if the sentence holds." },
      ]),
      "flashcards",
    );
  }

  if (/code|python|javascript|program/.test(lower)) {
    const language = lower.includes("python") ? "python" : "javascript";
    const starter =
      language === "python"
        ? "print('Ready to try an idea from this lesson')"
        : "console.log('Ready to try an idea from this lesson')";
    return inserted(code("Try it", language, starter), "a code runner");
  }

  if (/equation|formula|latex/.test(lower)) {
    return inserted(equation("y = f(x)", "Name each symbol in the caption before you move on."), "an equation");
  }

  if (/quiz|multiple choice|check question|test me/.test(lower)) {
    return inserted(
      quiz(
        "What should you do with a new idea in this lesson?",
        [
          "Read it, then use the check or the graph",
          "Skip every interactive block",
          "Copy the title and stop",
          "Ignore the equation",
        ],
        0,
        "The checks and graphs are part of the lesson, so use them while the idea is still in view.",
      ),
      "a check question",
    );
  }

  return {
    blocks,
    status: `Noted on part ${part}. Connect Gemini to rewrite that section.`,
  };
}
