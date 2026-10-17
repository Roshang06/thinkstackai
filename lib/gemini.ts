import { generateText, Output } from "ai";
import { google } from "@ai-sdk/google";
import { newId } from "./blocks";
import { applyOfflineCommand } from "./document";
import { buildLesson } from "./offline";
import { editDraftSchema, lessonDraftSchema, normalizeBlock, normalizeBlocks } from "./schema";
import type { Block, CommandInput, Lesson, LessonDraftInput, ProseBlock } from "./types";

export function liveModelEnabled(): boolean {
  const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
  if (!key) return false;
  if (/placeholder|your-|changeme|example/i.test(key)) return false;
  return true;
}

function model() {
  return google(process.env.GEMINI_MODEL?.trim() || "gemini-3.8-flash");
}

export async function generateLesson(input: LessonDraftInput): Promise<{ lesson: Lesson; status: string; source: "gemini" | "offline" }> {
  const id = newId();
  if (!liveModelEnabled()) {
    const draft = buildLesson(input, id);
    return { ...draft, source: "offline" };
  }

  try {
    const { output } = await generateText({
      model: model(),
      output: Output.object({ schema: lessonDraftSchema }),
      abortSignal: AbortSignal.timeout(45_000),
      system: [
        "You write a study document as typed blocks, not a chat reply.",
        "Teach the requested topic at the requested level. If you are unsure of a fact, say so in the prose.",
        "Include a mix of prose, one equation, one graph or simulation, one quiz with exactly 4 choices, flashcards, and a short javascript or python snippet.",
        "Graph expressions may use x, numbers, sin, cos, tan, sqrt, abs, exp, log, pi, and arithmetic. Set xMin, xMax, yMin, and yMax to a real domain for graphs, and 0 otherwise.",
        "status is one short sentence such as 'Created a lesson with 8 parts.'",
        "Every block field is required. Use an empty string, 0, or an empty array when a field does not apply to that block type.",
        "Do not include the learner's name or any identifier.",
      ].join(" "),
      prompt: `Topic: ${input.topic}\nLevel: ${input.level}\nLength: about ${input.minutes} minutes\nUse ${input.minutes <= 5 ? "5" : input.minutes >= 20 ? "10 to 12" : "8"} blocks.`,
    });
    if (!output) throw new Error("Gemini returned an empty lesson");
    const blocks = normalizeBlocks(output.blocks);
    if (blocks.length < 4) throw new Error("Model returned too few valid blocks");
    const timestamp = new Date().toISOString();
    const lesson: Lesson = {
      id,
      ownerId: input.ownerId,
      ownerName: input.ownerName,
      title: output.title.slice(0, 140),
      topic: input.topic.trim(),
      level: input.level,
      minutes: input.minutes,
      tags: output.tags.map((tag) => tag.slice(0, 32)).slice(0, 6),
      visibility: "private",
      summary: output.summary.slice(0, 280),
      blocks,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    return { lesson, status: output.status.slice(0, 180), source: "gemini" };
  } catch (error) {
    console.error("Gemini lesson generation failed", error);
    const draft = buildLesson(input, id);
    return { ...draft, source: "offline" };
  }
}

export async function editLesson(lesson: Lesson, input: CommandInput): Promise<{ blocks: Block[]; status: string; source: "gemini" | "offline" }> {
  if (!liveModelEnabled()) {
    const edited = applyOfflineCommand(lesson.blocks, input);
    return { ...edited, source: "offline" };
  }

  try {
    const { output } = await generateText({
      model: model(),
      output: Output.object({ schema: editDraftSchema }),
      abortSignal: AbortSignal.timeout(45_000),
      system: [
        "You edit one study document. Return one action and a status of one short sentence.",
        "Example status: 'Added a graph after part 2.'",
        "insert_after adds block after blockId. replace swaps the targeted block. delete removes blockId.",
        "rewrite_prose replaces the body of a prose block; put the new paragraphs in prose. Use an empty string when prose is unused.",
        "blockId is the target block id, or an empty string when there is no target.",
        "Every block field is required. Use an empty string, 0, or an empty array when a field does not apply.",
        "Do not include the learner's name. Graph expressions may use x, numbers, sin, cos, tan, sqrt, abs, exp, log, pi, and arithmetic.",
        "Quizzes need exactly 4 choices.",
      ].join(" "),
      prompt: JSON.stringify({
        title: lesson.title,
        topic: lesson.topic,
        level: lesson.level,
        instruction: input.instruction,
        selection: input.selection ?? null,
        targetBlockId: input.blockId ?? null,
        blocks: lesson.blocks,
      }),
    });

    if (!output) throw new Error("Gemini returned an empty edit");
    const applied = applyModelEdit(lesson.blocks, output);
    if (!applied) throw new Error("Model edit did not apply");
    return { blocks: applied.blocks, status: output.status.slice(0, 180), source: "gemini" };
  } catch (error) {
    console.error("Gemini edit failed", error);
    const edited = applyOfflineCommand(lesson.blocks, input);
    return { ...edited, source: "offline" };
  }
}

function applyModelEdit(blocks: Block[], edit: { action: string; blockId: string; prose: string; block: Parameters<typeof normalizeBlock>[0] }): { blocks: Block[] } | null {
  const blockId = edit.blockId.trim() || null;
  const index = blocks.findIndex((block) => block.id === blockId);
  if (edit.action === "delete") {
    if (index < 0) return null;
    return { blocks: blocks.filter((block) => block.id !== blockId) };
  }
  if (edit.action === "rewrite_prose") {
    if (index < 0 || blocks[index].type !== "prose" || !edit.prose.trim()) return null;
    const next = blocks.slice();
    const current = blocks[index] as ProseBlock;
    next[index] = { ...current, body: edit.prose.trim().slice(0, 4000) };
    return { blocks: next };
  }
  const created = normalizeBlock(edit.block);
  if (!created) return null;
  if (edit.action === "replace") {
    if (index < 0) return null;
    const next = blocks.slice();
    next[index] = { ...created, id: blocks[index].id };
    return { blocks: next };
  }
  if (edit.action === "insert_after") {
    const next = blocks.slice();
    next.splice(index >= 0 ? index + 1 : next.length, 0, created);
    return { blocks: next };
  }
  return null;
}
