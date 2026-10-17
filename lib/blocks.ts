import type {
  Block,
  CodeBlock,
  EquationBlock,
  FlashcardsBlock,
  GraphBlock,
  ProseBlock,
  QuizBlock,
  ShortAnswerBlock,
  SimulationBlock,
} from "./types";

export function newId(): string {
  return crypto.randomUUID();
}

export function prose(heading: string, body: string): ProseBlock {
  return { id: newId(), type: "prose", heading, body };
}

export function equation(latex: string, caption: string): EquationBlock {
  return { id: newId(), type: "equation", latex, caption };
}

export function graph(
  title: string,
  expression: string,
  domain: { xMin?: number; xMax?: number; yMin?: number; yMax?: number } = {},
): GraphBlock {
  return {
    id: newId(),
    type: "graph",
    title,
    expression,
    xMin: domain.xMin ?? -6.28,
    xMax: domain.xMax ?? 6.28,
    yMin: domain.yMin ?? -2,
    yMax: domain.yMax ?? 2,
  };
}

export function quiz(
  prompt: string,
  choices: string[],
  answerIndex: number,
  explanation: string,
): QuizBlock {
  return { id: newId(), type: "quiz", prompt, choices, answerIndex, explanation };
}

export function shortAnswer(
  prompt: string,
  accepted: string[],
  explanation: string,
): ShortAnswerBlock {
  return { id: newId(), type: "short_answer", prompt, accepted, explanation };
}

export function flashcards(title: string, cards: { front: string; back: string }[]): FlashcardsBlock {
  return { id: newId(), type: "flashcards", title, cards };
}

export function code(title: string, language: "javascript" | "python", starter: string): CodeBlock {
  return { id: newId(), type: "code", title, language, starter };
}

export function simulation(kind: "wave" | "projectile", title: string, note: string): SimulationBlock {
  return { id: newId(), type: "simulation", kind, title, note };
}

export function reassignIds(blocks: Block[]): Block[] {
  return blocks.map((block) => ({ ...block, id: newId() }));
}

export function summarize(lesson: { blocks: Block[] } & Record<string, unknown>): number {
  return lesson.blocks.length;
}
