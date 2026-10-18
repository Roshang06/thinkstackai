import { z } from "zod";
import { newId } from "./blocks";
import { liveModelEnabled, runDocumentProviders, runSpecialist, type DocumentTool } from "./providers";
import { buildWidget } from "./course";
import { attachArtifacts, flatBlockSchema, lessonDraftSchema, normalizeBlock, normalizeBlocks } from "./schema";
import type { Block, CommandInput, Lesson, LessonDraftInput, ProseBlock } from "./types";

export { generationErrorMessage, liveModelEnabled } from "./providers";

const DOCUMENT_RULES = [
  "Call a tool. A prose reply is a failure because the learner never sees it.",
  "Choose only the blocks that teach this topic. Prose carries the explanation, and a quiz or short answer lets the learner check themselves.",
  "Add an equation only when a formula matters. Add flashcards only for terms worth memorizing.",
  "Do not add a graph, runnable code, or simulation unless that interaction teaches better than prose. History and literature lessons usually need none of those.",
  "For a graph, equation, code snippet, or simulation, call request_artifact. A specialist model builds that block. Leave it out of write_lesson.",
  "Write real explanations at the requested level. If a fact is uncertain, say so in the prose.",
  "Never say that explanations are not written yet or that an API key is missing.",
  "Every block field is required. Use an empty string, 0, or an empty array when a field does not apply.",
  "A quiz has exactly 4 choices. answerIndex is 0, 1, 2, or 3.",
  "status is one short sentence describing the document change.",
].join(" ");

const artifactKind = z.enum(["equation", "graph", "quiz", "flashcards", "code", "simulation"]);

const lessonPlanSchema = z.object({
  title: z.string(),
  summary: z.string(),
  tags: z.array(z.string()),
  status: z.string(),
  sections: z.array(z.object({ heading: z.string(), body: z.string() })),
  checkPrompt: z.string(),
  choices: z.array(z.string()),
  answerIndex: z.number(),
  explanation: z.string(),
  artifacts: z.array(z.object({ kind: artifactKind, brief: z.string() })),
});

function emptyFlat(overrides: Partial<z.infer<typeof flatBlockSchema>>): z.infer<typeof flatBlockSchema> {
  return {
    type: "prose",
    heading: "",
    body: "",
    latex: "",
    caption: "",
    title: "",
    expression: "",
    xMin: -6,
    xMax: 6,
    yMin: -2,
    yMax: 8,
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
    ...overrides,
  };
}

function inlineArtifact(kind: string, item: Record<string, unknown>, brief: string): Block | null {
  const named = typeof item.language === "string" ? item.language.toLowerCase() : "";
  const language = named === "python" || named === "javascript" ? named : /\b(def |print\(|import )/.test(brief) ? "python" : "javascript";
  if (kind === "code" && /[=()[\]:]/.test(brief)) return normalizeBlock(emptyFlat({ type: "code", title: "Try it", starter: brief, language }));
  if (kind === "equation" && (typeof item.latex === "string" || /\\|\^/.test(brief))) {
    return normalizeBlock(emptyFlat({ type: "equation", latex: typeof item.latex === "string" ? item.latex : brief }));
  }
  if (kind === "graph" && typeof item.expression === "string") {
    return normalizeBlock(emptyFlat({ type: "graph", title: "Graph", expression: item.expression }));
  }
  return null;
}

async function buildArtifact(topic: string, level: string, kind: string, brief: string): Promise<Block | null> {
  const drafted = await runSpecialist({
    toolName: "return_block",
    inputSchema: flatBlockSchema,
    system: `Build one ${kind} block. Set type to ${kind}. Fill unused fields with an empty string, 0, or an empty array. A quiz has exactly 4 choices. Call return_block once.`,
    prompt: `Topic: ${topic}\nLevel: ${level}\nKind: ${kind}\nBrief: ${brief}`,
  });
  const created = drafted ? normalizeBlock(drafted as z.infer<typeof flatBlockSchema>) : null;
  if (!created || created.type !== kind) return null;
  return created;
}

export async function generateLesson(input: LessonDraftInput): Promise<{ lesson: Lesson; status: string }> {
  if (!liveModelEnabled()) throw new Error("No model key is configured");
  let written: z.infer<typeof lessonPlanSchema> | null = null;
  const tools: Record<string, DocumentTool> = {
    write_lesson: {
      description: "Save the lesson plan. Call this once.",
      inputSchema: lessonPlanSchema,
      execute: async (raw) => {
        const record = raw as Record<string, unknown>;
        const rawSections = Array.isArray(record.sections) ? record.sections : [];
        const draft = raw as z.infer<typeof lessonPlanSchema>;
        const sections = rawSections.map((section) => {
          const item = section && typeof section === "object" ? (section as Record<string, unknown>) : {};
          const heading = typeof item.heading === "string" ? item.heading : typeof item.title === "string" ? item.title : "";
          const body = typeof item.body === "string" ? item.body : typeof item.content === "string" ? item.content : typeof item.text === "string" ? item.text : "";
          return { heading, body };
        });
        const usable = sections.filter((section) => section.body.trim());
        const title = typeof draft.title === "string" ? draft.title.trim() : "";
        const checkPrompt = typeof draft.checkPrompt === "string" ? draft.checkPrompt.trim() : "";
        if (usable.length < 2 || !title || !checkPrompt) {
          return { ok: false, error: "Write a title, at least 2 prose sections with body text, and a quiz prompt." };
        }
        written = {
          ...draft,
          title,
          checkPrompt,
          sections: usable,
          tags: Array.isArray(draft.tags) ? draft.tags : [],
          choices: Array.isArray(draft.choices) ? draft.choices : [],
          artifacts: Array.isArray(draft.artifacts) ? draft.artifacts : [],
          summary: typeof draft.summary === "string" ? draft.summary : "",
          explanation: typeof draft.explanation === "string" ? draft.explanation : "",
          status: typeof draft.status === "string" ? draft.status : "",
          answerIndex: typeof draft.answerIndex === "number" ? draft.answerIndex : 0,
        };
        return { ok: true, sections: usable.length, artifacts: written.artifacts.length };
      },
    },
  };

  await runDocumentProviders({
    tools,
    steps: 2,
    reset: () => {
      written = null;
    },
    succeeded: () => written !== null,
    system: [
      "Call write_lesson once. A prose reply is a failure.",
      "sections explain the idea in sentences. Each section has a heading and a body. Do not put code, LaTeX, or a plot inside a section.",
      "checkPrompt is one 4-choice quiz. answerIndex is 0, 1, 2, or 3.",
      "artifacts is empty for history, literature, and civics.",
      "A programming topic needs one artifact with kind code. A formula needs kind equation. A plot or curve needs kind graph. Motion or waves need kind simulation.",
      "The brief tells a specialist model exactly what to build, including the language, the expression, or the scenario.",
    ].join(" "),
    prompt: `Topic: ${input.topic}\nLevel: ${input.level}\nLength: about ${input.minutes} minutes`,
  });

  if (!written) throw new Error("The model did not write a lesson");
  const draft: z.infer<typeof lessonPlanSchema> = written;
  const prose = normalizeBlocks(
    draft.sections.map((section) => ({
      type: "prose" as const,
      heading: section.heading,
      body: section.body,
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
      language: "javascript" as const,
      starter: "",
      kind: "wave" as const,
      note: "",
    })),
  );
  const quiz = normalizeBlock({
    type: "quiz",
    heading: "",
    body: "",
    latex: "",
    caption: "",
    title: "",
    expression: "",
    xMin: 0,
    xMax: 0,
    yMin: 0,
    yMax: 0,
    prompt: draft.checkPrompt,
    choices: draft.choices,
    answerIndex: draft.answerIndex,
    explanation: draft.explanation,
    accepted: [],
    cards: [],
    language: "javascript",
    starter: "",
    kind: "wave",
    note: "",
  });
  const artifacts: Block[] = [];
  for (const request of draft.artifacts) {
    const item = request as Record<string, unknown>;
    const kind = typeof item.kind === "string" ? item.kind : typeof item.type === "string" ? item.type : "";
    const brief = [item.brief, item.description, item.content, item.starter, item.expression].find(
      (value): value is string => typeof value === "string" && value.trim().length > 0,
    );
    if (!artifactKind.options.includes(kind as (typeof artifactKind.options)[number]) || !brief) continue;
    const created = (await buildArtifact(input.topic, input.level, kind, brief)) ?? inlineArtifact(kind, item, brief);
    if (created) artifacts.push(created);
  }
  const blocks = attachArtifacts(quiz ? [...prose, quiz] : prose, artifacts);
  if (blocks.length < 3) throw new Error("The model did not write a lesson");
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
    sections: [{ id: newId(), title: draft.title.slice(0, 140), objective: draft.summary.slice(0, 280), interaction: "", blocks }],
    stage: "ready",
    activity: "",
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
    request_widget: {
      description: "Ask a specialist model for one self-contained interactive game or simulation, then insert it.",
      inputSchema: z.object({ status: z.string(), afterBlockId: z.string(), brief: z.string() }),
      execute: async (raw) => {
        const request = raw as { status?: string; afterBlockId?: string; brief?: string };
        if (!request.brief?.trim()) return { ok: false, error: "Describe the interaction." };
        const created = await buildWidget({ topic: lesson.topic, level: lesson.level, title: lesson.title, brief: request.brief });
        const index = state.blocks.findIndex((item) => item.id === request.afterBlockId);
        state.blocks.splice(index >= 0 ? index + 1 : state.blocks.length, 0, created);
        state.status = (request.status || "Added an interaction.").slice(0, 180);
        state.changed = true;
        return { ok: true, blockId: created.id };
      },
    },
    request_artifact: {
      description: "Ask a specialist model for one equation, graph, quiz, flashcards, code, or simulation block, then insert it.",
      inputSchema: z.object({
        status: z.string(),
        afterBlockId: z.string(),
        kind: z.enum(["equation", "graph", "quiz", "flashcards", "code", "simulation"]),
        brief: z.string(),
      }),
      execute: async (raw) => {
        const request = raw as { status?: string; afterBlockId?: string; kind?: string; brief?: string };
        if (!request.kind || !request.brief) return { ok: false, error: "kind and brief are required." };
        const drafted = await runSpecialist({
          toolName: "return_block",
          inputSchema: flatBlockSchema,
          system: `Build one ${request.kind} block. Set type to ${request.kind}. Fill unused fields with an empty string, 0, or an empty array. Call return_block once.`,
          prompt: `Topic: ${lesson.topic}\nLevel: ${lesson.level}\nKind: ${request.kind}\nBrief: ${request.brief}`,
        });
        const created = drafted ? normalizeBlock(drafted as z.infer<typeof flatBlockSchema>) : null;
        if (!created || created.type !== request.kind) return { ok: false, error: "The specialist did not return a usable block." };
        const index = state.blocks.findIndex((item) => item.id === request.afterBlockId);
        state.blocks.splice(index >= 0 ? index + 1 : state.blocks.length, 0, created);
        state.status = (request.status || "Added an interactive block.").slice(0, 180);
        state.changed = true;
        return { ok: true, blockId: created.id };
      },
    },
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
        : "No block is selected. For a custom game or simulation, call request_widget once. For a graph, equation, or code example, call request_artifact once. Use rewrite_prose, insert_block, replace_block, or delete_block for a local text change. Call write_lesson only when the learner asks to redo this section.",
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
