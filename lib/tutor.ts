import { z } from "zod";
import { runDocumentProviders } from "./providers";
import type { Block, Lesson } from "./types";

export type TutorHighlight = { blockId: string; quote: string };

export type TutorTurn = { role: "user" | "model"; text: string };

const answerSchema = z.object({
  say: z.string(),
  highlights: z.array(z.object({ blockId: z.string(), quote: z.string() })).max(3).optional(),
});

export function visibleLessonText(value: string): string {
  return value
    .replace(/```[a-zA-Z0-9_+-]*\n?/g, "")
    .replace(/```/g, "")
    .replace(/\$\$([\s\S]+?)\$\$/g, (_, latex: string) => latex.trim())
    .replace(/\$([^$\n]+)\$/g, (_, latex: string) => latex.trim())
    .replace(/\*\*|__|`/g, "")
    .replace(/<\/?h[12]>/gi, "")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

export function blockTutorText(block: Block): string {
  switch (block.type) {
    case "prose":
      return visibleLessonText(`${block.heading}\n${block.body}`);
    case "equation":
      return visibleLessonText(`${block.latex}\n${block.caption}`);
    case "graph":
      return visibleLessonText(block.title);
    case "quiz":
      return visibleLessonText([block.prompt, ...block.choices].join("\n"));
    case "short_answer":
      return visibleLessonText(block.prompt);
    case "flashcards":
      return visibleLessonText([block.title, ...block.cards.map((card) => card.front)].join("\n"));
    case "code":
      return visibleLessonText(`${block.title}\n${block.starter}`);
    case "simulation":
      return visibleLessonText(`${block.title}\n${block.note}`);
    case "widget":
      return visibleLessonText(block.title);
    default:
      return "";
  }
}

function locateQuote(haystack: string, quote: string): string | null {
  const needle = quote.replace(/\s+/g, " ").trim();
  if (needle.length < 4 || needle.length > 220) return null;
  const direct = haystack.toLowerCase().indexOf(needle.toLowerCase());
  if (direct >= 0) return haystack.slice(direct, direct + needle.length);
  const collapsed = haystack.replace(/\s+/g, " ");
  const folded = collapsed.toLowerCase().indexOf(needle.toLowerCase());
  if (folded < 0) return null;
  return collapsed.slice(folded, folded + needle.length);
}

function foldChoice(value: string): string {
  return value.toLowerCase().replace(/[−–-]/g, "-").replace(/\s+/g, "");
}

export function tutorReply(lesson: Lesson, say: string): string {
  const cleaned = say.replace(/\s+/g, " ").trim();
  const words = cleaned.split(" ").filter(Boolean);
  const quizzes = lesson.sections.flatMap((section) => section.blocks).filter((block) => block.type === "quiz");
  const leaked = quizzes.some((block) =>
    block.choices.some((choice) => {
      const folded = foldChoice(choice);
      if (!folded) return false;
      if (foldChoice(cleaned) === folded) return true;
      return folded.length >= 3 && words.length < 12 && foldChoice(cleaned).includes(folded);
    }),
  );
  if (leaked) return "I won't pick a choice for you. Use the passage on this page and decide which option matches it.";
  return cleaned.slice(0, 800);
}

export function acceptHighlights(lesson: Lesson, raw: { blockId?: string; quote?: string }[]): TutorHighlight[] {
  const blocks = lesson.sections.flatMap((section) => section.blocks.map((block) => ({ id: block.id, text: blockTutorText(block) })));
  const accepted: TutorHighlight[] = [];
  for (const item of raw) {
    const block = blocks.find((candidate) => candidate.id === item.blockId);
    const quote = locateQuote(block?.text ?? "", item.quote ?? "");
    if (!block || !quote) continue;
    accepted.push({ blockId: block.id, quote });
    if (accepted.length === 3) break;
  }
  return accepted;
}

export function tutorContext(lesson: Lesson, sectionId: string | null): unknown {
  const current = lesson.sections.find((section) => section.id === sectionId) ?? lesson.sections[0];
  return {
    title: lesson.title,
    topic: lesson.topic,
    level: lesson.level,
    summary: lesson.summary,
    currentSectionId: current?.id ?? "",
    sections: lesson.sections.map((section) => ({
      id: section.id,
      title: section.title,
      objective: section.objective,
      current: section.id === current?.id,
      blocks: section.blocks.map((block) => ({
        id: block.id,
        type: block.type,
        text: blockTutorText(block).slice(0, section.id === current?.id ? 1600 : 280),
      })),
    })),
  };
}

export async function askTutor(
  lesson: Lesson,
  input: { question: string; sectionId?: string | null; selection?: string | null; history?: TutorTurn[] },
): Promise<{ reply: string; highlights: TutorHighlight[] }> {
  const state: { reply: string; highlights: TutorHighlight[] } = { reply: "", highlights: [] };
  const history = (input.history ?? [])
    .filter((turn) => turn.role === "user" || turn.role === "model")
    .slice(-6)
    .map((turn) => ({ role: turn.role, text: turn.text.slice(0, 500) }));

  await runDocumentProviders({
    steps: 3,
    reset: () => {
      state.reply = "";
      state.highlights = [];
    },
    succeeded: () => state.reply.trim().length > 1,
    tools: {
      answer: {
        description: "Reply to the student and optionally point at passages already on the page.",
        inputSchema: answerSchema,
        execute: (raw) => {
          const parsed = answerSchema.safeParse(raw);
          if (!parsed.success) return { ok: false, error: "Include say, and highlights as a list." };
          const say = parsed.data.say.trim();
          if (say.split(/\s+/).length < 8) return { ok: false, error: "Write at least two sentences. Do not answer with only a quiz choice." };
          state.reply = tutorReply(lesson, say);
          state.highlights = acceptHighlights(lesson, parsed.data.highlights ?? []);
          return { ok: true, highlights: state.highlights.length };
        },
      },
    },
    system: [
      "Call answer once. You are a tutor beside a student reading this lesson. You cannot edit the lesson.",
      "say is two or three sentences in plain language.",
      "If the student asks which quiz choice is correct, refuse in two sentences and do not name any choice. Give a hint and point at the passage that helps.",
      "highlights copies short phrases that already appear in a block's text. Use the block id from the lesson. Leave highlights empty when nothing on the page should be marked.",
      "A quote that is not copied from the block will be discarded.",
    ].join(" "),
    prompt: JSON.stringify({
      question: input.question,
      selection: input.selection ?? "",
      history,
      lesson: tutorContext(lesson, input.sectionId ?? null),
    }),
  });

  if (!state.reply.trim()) throw new Error("The tutor did not reply");
  return state;
}
