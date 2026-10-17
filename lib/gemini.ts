import { z } from "zod";
import { newId } from "./blocks";
import { liveModelEnabled, runDocumentProviders, type DocumentTool } from "./providers";
import { flatBlockSchema, lessonDraftSchema, normalizeBlock, normalizeBlocks } from "./schema";
import type { Block, CommandInput, Lesson, LessonDraftInput, ProseBlock } from "./types";

export { generationErrorMessage, liveModelEnabled } from "./providers";

const DOCUMENT_RULES = [
  "You change a study document by calling tools. The learner sees the document, not a chat reply.",
  "Block types are prose, equation, graph, quiz, short_answer, flashcards, code, and simulation.",
  "Write real explanations at the requested level. If a fact is uncertain, say so inside the prose.",
  "Never write that explanations are not written yet, that the page is only a structure, or that an API key is missing.",
  "Every block field is required. Use an empty string, 0, or an empty array when a field does not apply.",
  "Graph expressions may use x, numbers, sin, cos, tan, sqrt, abs, exp, log, pi, and arithmetic. Use a real domain for graphs, and 0 for unused numeric fields.",
  "A quiz has exactly 4 choices. answerIndex is 0, 1, 2, or 3.",
  "status is one short sentence describing the document change.",
].join(" ");

function blockCount(minutes: number): string {
  if (minutes <= 5) return "5 or 6";
  if (minutes >= 20) return "10 to 12";
  return "8";
}

export async function generateLesson(input: LessonDraftInput): Promise<{ lesson: Lesson; status: string }> {
  if (!liveModelEnabled()) throw new Error("No model key is configured");
  let written: z.infer<typeof lessonDraftSchema> | null = null;
  const tools: Record<string, DocumentTool> = {
    write_lesson: {
      description: "Create the study document. Call this once with real teaching content.",
      inputSchema: lessonDraftSchema,
      execute: async (input) => {
        const draft = input as z.infer<typeof lessonDraftSchema>;
        const blocks = normalizeBlocks(draft.blocks);
        if (blocks.length < 4 || !draft.title.trim()) {
          return { ok: false, error: "Write at least 4 real blocks and a title. Do not leave placeholders." };
        }
        written = draft;
        return { ok: true, blockCount: blocks.length };
      },
    },
  };

  await runDocumentProviders({
    tools,
    steps: 3,
    reset: () => {
      written = null;
    },
    succeeded: () => written !== null,
    system: [
      DOCUMENT_RULES,
      "Call write_lesson exactly once.",
      "Teach the topic with prose, one equation when the topic uses a formula, a graph or simulation when the idea is visual, a quiz, flashcards, and a short javascript or python snippet when code helps.",
    ].join(" "),
    prompt: `Topic: ${input.topic}\nLevel: ${input.level}\nLength: about ${input.minutes} minutes\nUse ${blockCount(input.minutes)} blocks.`,
  });

  if (!written) throw new Error("The model did not write a lesson");
  const draft: z.infer<typeof lessonDraftSchema> = written;
  const blocks = normalizeBlocks(draft.blocks);
  if (blocks.length < 4) throw new Error("The model did not write a lesson");
  const timestamp = new Date().toISOString();
  const lesson: Lesson = {
    id: newId(),
    ownerId: input.ownerId,
    ownerName: input.ownerName,
    title: draft.title.slice(0, 140),
    topic: input.topic.trim(),
    level: input.level,
    minutes: input.minutes,
    tags: draft.tags.map((tag) => tag.slice(0, 32)).slice(0, 6),
    visibility: "private",
    summary: draft.summary.slice(0, 280),
    blocks,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  return { lesson, status: draft.status.slice(0, 180) || `Created a lesson with ${blocks.length} parts.` };
}

type EditState = {
  blocks: Block[];
  title: string;
  summary: string;
  tags: string[];
  status: string;
  changed: boolean;
};

export async function editLesson(
  lesson: Lesson,
  input: CommandInput,
): Promise<{ blocks: Block[]; title: string; summary: string; tags: string[]; status: string }> {
  if (!liveModelEnabled()) throw new Error("No model key is configured");
  const state: EditState = {
    blocks: lesson.blocks.map((block) => ({ ...block })),
    title: lesson.title,
    summary: lesson.summary,
    tags: lesson.tags,
    status: "",
    changed: false,
  };
  const focused = Boolean(input.blockId || input.selection?.trim());

  const tools: Record<string, DocumentTool> = {
    write_lesson: {
      description: "Replace the whole lesson when the request is broad. Keep the topic unless the learner asked to change it.",
      inputSchema: lessonDraftSchema,
      execute: async (raw) => {
        const draft = raw as z.infer<typeof lessonDraftSchema>;
        const blocks = normalizeBlocks(draft.blocks);
        if (blocks.length < 4 || !draft.title.trim()) {
          return { ok: false, error: "A full rewrite needs a title and at least 4 real blocks." };
        }
        state.blocks = blocks;
        state.title = draft.title.slice(0, 140);
        state.summary = draft.summary.slice(0, 280);
        state.tags = draft.tags.map((tag) => tag.slice(0, 32)).slice(0, 6);
        state.status = draft.status.slice(0, 180);
        state.changed = true;
        return { ok: true, blockCount: blocks.length };
      },
    },
    insert_block: {
      description: "Insert one block after afterBlockId. Use an empty afterBlockId to insert at the start.",
      inputSchema: z.object({ status: z.string(), afterBlockId: z.string(), block: flatBlockSchema }),
      execute: async (raw) => {
        const { status, afterBlockId, block } = raw as { status: string; afterBlockId: string; block: z.infer<typeof flatBlockSchema> };
        const created = normalizeBlock(block);
        if (!created) return { ok: false, error: "That block was empty or invalid. Try again with real content." };
        const index = state.blocks.findIndex((item) => item.id === afterBlockId);
        state.blocks.splice(index >= 0 ? index + 1 : 0, 0, created);
        state.status = status.slice(0, 180);
        state.changed = true;
        return { ok: true, blockId: created.id };
      },
    },
    replace_block: {
      description: "Replace one existing block, keeping its id.",
      inputSchema: z.object({ status: z.string(), blockId: z.string(), block: flatBlockSchema }),
      execute: async (raw) => {
        const { status, blockId, block } = raw as { status: string; blockId: string; block: z.infer<typeof flatBlockSchema> };
        const index = state.blocks.findIndex((item) => item.id === blockId);
        const created = normalizeBlock(block);
        if (index < 0 || !created) return { ok: false, error: "Choose an existing block id and valid content." };
        state.blocks[index] = { ...created, id: state.blocks[index].id };
        state.status = status.slice(0, 180);
        state.changed = true;
        return { ok: true };
      },
    },
    delete_block: {
      description: "Delete one block. Do not delete the last block.",
      inputSchema: z.object({ status: z.string(), blockId: z.string() }),
      execute: async (raw) => {
        const { status, blockId } = raw as { status: string; blockId: string };
        if (state.blocks.length < 2) return { ok: false, error: "Keep at least one block." };
        const next = state.blocks.filter((item) => item.id !== blockId);
        if (next.length === state.blocks.length) return { ok: false, error: "That block id was not found." };
        state.blocks = next;
        state.status = status.slice(0, 180);
        state.changed = true;
        return { ok: true };
      },
    },
    rewrite_prose: {
      description: "Rewrite the heading and body of one prose block.",
      inputSchema: z.object({ status: z.string(), blockId: z.string(), heading: z.string(), body: z.string() }),
      execute: async (raw) => {
        const { status, blockId, heading, body } = raw as { status: string; blockId: string; heading: string; body: string };
        const index = state.blocks.findIndex((item) => item.id === blockId);
        const current = state.blocks[index];
        if (!current || current.type !== "prose" || !body.trim()) {
          return { ok: false, error: "rewrite_prose only updates an existing prose block." };
        }
        const next: ProseBlock = {
          ...current,
          heading: heading.trim().slice(0, 120) || current.heading,
          body: body.trim().slice(0, 4000),
        };
        const accepted = normalizeBlock({
          type: "prose",
          heading: next.heading,
          body: next.body,
          latex: "",
          caption: "",
          title: "",
          expression: "",
          xMin: 0,
          xMax: 0,
          yMin: 0,
          yMax: 0,
          prompt: "",
          choices: [],
          answerIndex: 0,
          explanation: "",
          accepted: [],
          cards: [],
          language: "javascript",
          starter: "",
          kind: "wave",
          note: "",
        });
        if (!accepted) return { ok: false, error: "Write a real explanation, not a placeholder." };
        state.blocks[index] = next;
        state.status = status.slice(0, 180);
        state.changed = true;
        return { ok: true };
      },
    },
  };

  await runDocumentProviders({
    tools,
    steps: 4,
    reset: () => {
      state.blocks = lesson.blocks.map((block) => ({ ...block }));
      state.title = lesson.title;
      state.summary = lesson.summary;
      state.tags = lesson.tags;
      state.status = "";
      state.changed = false;
    },
    succeeded: () => state.changed,
    system: [
      DOCUMENT_RULES,
      focused
        ? "A block is selected. Change that part with insert_block, replace_block, delete_block, or rewrite_prose."
        : "No block is selected. Use the smaller edit tools for a local change. Call write_lesson when the request asks to redo, expand, or rebuild the lesson.",
    ].join(" "),
    prompt: JSON.stringify({
      title: lesson.title,
      topic: lesson.topic,
      level: lesson.level,
      instruction: input.instruction,
      selection: input.selection ?? "",
      targetBlockId: input.blockId ?? "",
      blocks: lesson.blocks,
    }),
  });

  if (!state.changed) throw new Error("The model did not edit the document");
  return {
    blocks: state.blocks,
    title: state.title,
    summary: state.summary,
    tags: state.tags,
    status: state.status || "Updated the lesson.",
  };
}
