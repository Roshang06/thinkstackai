import { z } from "zod";
import { equation, newId, prose, quiz } from "./blocks";
import { runDocumentProviders, runSpecialist } from "./providers";
import { isDisplayMath, repairLessonText, tidySectionParts } from "./markup";
import { insertProse, minutesForSections, proseDepth, sectionBounds } from "./sections";
import type { Block, Lesson, LessonSection, WidgetBlock } from "./types";
import { sandboxDocument, widgetFallback } from "./widget";

const outlineSchema = z.object({
  title: z.string(),
  summary: z.string(),
  tags: z.array(z.string()),
  status: z.string(),
  minutes: z.number(),
  sections: z.array(z.object({ title: z.string(), objective: z.string(), interaction: z.string() })),
});

const sectionSchema = z.object({
  parts: z.array(z.object({ heading: z.string(), body: z.string() })),
  checkPrompt: z.string(),
  choices: z.array(z.string()),
  answerIndex: z.number(),
  explanation: z.string(),
  equationLatex: z.string(),
  equationCaption: z.string(),
});

export type LessonOutline = {
  title: string;
  summary: string;
  tags: string[];
  status: string;
  minutes: number;
  sections: { title: string; objective: string; interaction: string }[];
};

function text(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .split(/(```[\s\S]*?```)/g)
    .map((part, index) => (part.startsWith("```") && part.endsWith("```") && index % 2 === 1 ? part : repairLessonText(part)))
    .join("")
    .trim();
}

function words(value: string): number {
  return value.split(/\s+/).filter(Boolean).length;
}

export async function planLesson(input: { topic: string; level: string; minutes: number; notes?: string }): Promise<LessonOutline> {
  const bounds = sectionBounds(input.minutes);
  let written: LessonOutline | null = null;
  await runDocumentProviders({
    steps: 2,
    reset: () => {
      written = null;
    },
    succeeded: () => written !== null,
    tools: {
      write_outline: {
        description: "Save the lesson outline. Call this once.",
        inputSchema: outlineSchema,
        execute: (raw) => {
          const record = raw as Record<string, unknown>;
          const sections = (Array.isArray(record.sections) ? record.sections : [])
            .map((section) => {
              const item = section && typeof section === "object" ? (section as Record<string, unknown>) : {};
              return {
                title: text(item.title || item.heading || item.name),
                objective: text(item.objective || item.summary || item.body || item.content),
                interaction: text(item.interaction || item.widget || item.game || item.brief),
              };
            })
            .filter((section) => section.title && section.objective);
          const title = text(record.title);
          if (!title || sections.length < 2) {
            return { ok: false, error: "Plan at least 2 sections. Each needs a title and an objective." };
          }
          const kept = sections.slice(0, 8);
          const minutes = minutesForSections(kept.length);
          written = {
            title: title.slice(0, 140),
            summary: text(record.summary).slice(0, 280),
            tags: (Array.isArray(record.tags) ? record.tags : []).map((tag) => text(tag).slice(0, 32)).filter(Boolean).slice(0, 6),
            status: text(record.status).slice(0, 180) || `Planned ${kept.length} sections, about ${minutes} minutes.`,
            minutes,
            sections: kept,
          };
          return { ok: true, sections: kept.length, minutes };
        },
      },
    },
    system: [
      "Call write_outline once. A prose reply is a failure.",
      "You decide how long the lesson is from the prompt. A suggested length is only a hint.",
      "A single definition or a narrow question is 2 sections. A topic with several distinct ideas is 4 to 6 sections. A long custom request can be 8. Never plan more than 8.",
      `The learner suggested about ${input.minutes} minutes, which usually means ${bounds.min} to ${bounds.max} sections. Leave that range when the prompt clearly asks for something shorter or broader.`,
      "Sections are taught one at a time, in order. Section 1 introduces the idea. Later sections go deeper. Do not make every section a summary of the whole topic.",
      "objective is one sentence a writer can expand into several paragraphs.",
      "minutes is about 4 minutes per section.",
      "interaction is a one-sentence brief for a small playable simulation or game, or an empty string.",
      "Use an interaction when the learner should manipulate something. A math or science lesson needs one interaction, and never more than two. Do not put an interaction on every section. History and literature can leave every interaction empty.",
      "Do not put the rules of the game inside the objective.",
    ].join(" "),
    prompt: `Prompt: ${input.topic}\nLevel: ${input.level}\nSuggested length: ${input.minutes} minutes${input.notes?.trim() ? `\nInstructor notes: ${input.notes.trim().slice(0, 1000)}` : ""}`,
  });
  if (!written) throw new Error("The model did not plan the lesson");
  return written;
}

export function draftSections(outline: LessonOutline): LessonSection[] {
  return outline.sections.map((section) => ({
    id: newId(),
    title: section.title,
    objective: section.objective,
    interaction: section.interaction,
    blocks: [],
  }));
}

export async function writeSection(input: {
  topic: string;
  level: string;
  minutes: number;
  section: LessonSection;
  earlierTitles: string[];
  note?: string;
}): Promise<Block[]> {
  const depth = proseDepth(input.minutes);
  const minimum = Math.round(depth.words * 0.55) * depth.parts;
  let parts: { heading: string; body: string }[] = [];
  let check = { prompt: "", choices: [] as string[], answerIndex: 0, explanation: "" };
  let formula = { latex: "", caption: "" };
  let accepted = false;

  await runDocumentProviders({
    steps: 3,
    reset: () => {
      accepted = false;
    },
    succeeded: () => accepted,
    tools: {
      write_section: {
        description: "Save this one section. Call this once.",
        inputSchema: sectionSchema,
        execute: (raw) => {
          const record = raw as Record<string, unknown>;
          const written = (Array.isArray(record.parts) ? record.parts : Array.isArray(record.sections) ? record.sections : [])
            .map((part) => {
              const item = part && typeof part === "object" ? (part as Record<string, unknown>) : {};
              return {
                heading: text(item.heading || item.title),
                body: text(item.body || item.content || item.text),
              };
            })
            .filter((part) => part.body);
          const prompt = text(record.checkPrompt || record.prompt || record.question);
          const choices = (Array.isArray(record.choices) ? record.choices : []).map((choice) => text(choice)).filter(Boolean).slice(0, 4);
          const total = written.reduce((sum, part) => sum + words(part.body), 0);
          const floor = Math.round(depth.words * 0.45);
          const short = written.find((part) => words(part.body) < floor);
          if (written.length < 2 || short || total < minimum || !prompt || choices.length !== 4) {
            return {
              ok: false,
              error: short
                ? `Each part needs about ${depth.words} words. One part is only ${words(short.body)} words. Add paragraphs, not another heading.`
                : `Write at least 2 parts and about ${depth.words} words in each. Include a 4-choice quiz. Current length is ${total} words.`,
            };
          }
          parts = tidySectionParts(written.slice(0, depth.parts + 1), input.section.title);
          check = {
            prompt,
            choices,
            answerIndex: Math.min(3, Math.max(0, Math.round(Number(record.answerIndex) || 0))),
            explanation: text(record.explanation),
          };
          formula = { latex: text(record.equationLatex || record.latex).slice(0, 300), caption: text(record.equationCaption || record.caption).slice(0, 400) };
          accepted = true;
          return { ok: true, words: total };
        },
      },
    },
    system: [
      "Call write_section once. A prose reply is a failure.",
      `This is only the section “${input.section.title}” of a longer lesson. Do not summarize the other sections.`,
      `Write ${depth.parts} parts. Each body is about ${depth.words} words, in several paragraphs. The section title is already visible, so leave heading empty unless a later part starts a genuinely new subtopic.`,
      "Never repeat a heading, and never use the section title as a heading. If you need a subheading inside a paragraph, write it as <h2>Subtopic</h2> on its own line. Use <h1> only for a title that is not already the section title.",
      "Wrap a word in **double asterisks** when it should be bold. A short name from a program goes in single backticks, like `scores`.",
      "A multi-line code example is a fenced block: a line of three backticks and the language, then the code, then a line of three backticks. Keep a string's quotation marks inside that block. Do not put the fence in the middle of a sentence.",
      "A variable or short formula stays inside the sentence as $V$. Write a fraction as $\\\\frac{a}{b}$. Use $$...$$ only for a long formula that needs its own line. Leave equationLatex empty unless you could not place the formula in the text.",
      "checkPrompt is one 4-choice quiz about this section. answerIndex is 0, 1, 2, or 3.",
      input.section.interaction
        ? "A specialist is building a playable interaction from a separate brief. Teach the idea, and do not describe the game's controls."
        : "This section has no interaction.",
    ].join(" "),
    prompt: [
      `Topic: ${input.topic}`,
      `Level: ${input.level}`,
      `Lesson length: ${input.minutes} minutes`,
      `Section: ${input.section.title}`,
      `Objective: ${input.section.objective}`,
      input.earlierTitles.length ? `Already taught: ${input.earlierTitles.join("; ")}` : "This is the first section.",
      input.note?.trim() ? `Instructor note for this step: ${input.note.trim().slice(0, 500)}` : "",
    ].filter(Boolean).join("\n"),
  });

  if (!accepted) throw new Error("The model did not write this section");
  const blocks: Block[] = tidySectionParts(parts, input.section.title).map((part, index) => {
    const math = index === 0 && formula.latex ? (isDisplayMath(formula.latex) ? `\n\n$$${formula.latex}$$` : ` $${formula.latex}$`) : "";
    const note = index === 0 && formula.caption ? `\n\n${formula.caption}` : "";
    return prose(part.heading, `${part.body}${math}${note}`);
  });
  if (input.section.interaction) {
    blocks.push({
      id: newId(),
      type: "widget",
      title: input.section.title,
      brief: input.section.interaction,
      html: "",
    });
  }
  blocks.push(quiz(check.prompt, check.choices, check.answerIndex, check.explanation));
  return blocks;
}

function readParts(value: unknown): { heading: string; body: string }[] {
  return (Array.isArray(value) ? value : [])
    .map((part) => {
      const item = part && typeof part === "object" ? (part as Record<string, unknown>) : {};
      return { heading: text(item.heading || item.title), body: text(item.body || item.content || item.text) };
    })
    .filter((part) => part.body);
}

function sectionBlocks(input: {
  title: string;
  interaction: string;
  parts: { heading: string; body: string }[];
  checkPrompt: string;
  choices: string[];
  answerIndex: number;
  explanation: string;
  equationLatex: string;
  equationCaption: string;
  previous?: LessonSection;
}): Block[] {
  const blocks: Block[] = input.parts.map((part) => prose(part.heading || input.title, part.body));
  if (input.equationLatex) blocks.push(equation(input.equationLatex, input.equationCaption));
  if (input.interaction) {
    const existing = input.previous?.blocks.find((block) => block.type === "widget" && block.brief === input.interaction);
    blocks.push(
      existing ?? {
        id: newId(),
        type: "widget",
        title: input.title,
        brief: input.interaction,
        html: "",
      },
    );
  }
  blocks.push(quiz(input.checkPrompt, input.choices, input.answerIndex, input.explanation));
  return blocks;
}

export type LessonEdit = {
  sections: LessonSection[];
  title: string;
  summary: string;
  tags: string[];
  minutes: number;
  status: string;
  reply: string;
  changedDocument: boolean;
};

export async function editCourse(
  lesson: Lesson,
  input: { instruction: string; selection?: string | null; visibleSectionId?: string | null; highlightedBlockId?: string | null },
): Promise<LessonEdit> {
  const copySections = () => lesson.sections.map((section) => ({ ...section, blocks: section.blocks.map((block) => ({ ...block })) }));
  const state: LessonEdit = {
    sections: copySections(),
    title: lesson.title,
    summary: lesson.summary,
    tags: lesson.tags,
    minutes: lesson.minutes,
    status: "",
    reply: "",
    changedDocument: false,
  };

  await runDocumentProviders({
    steps: 4,
    reset: () => {
      state.sections = copySections();
      state.title = lesson.title;
      state.summary = lesson.summary;
      state.tags = lesson.tags;
      state.minutes = lesson.minutes;
      state.status = "";
      state.reply = "";
      state.changedDocument = false;
    },
    succeeded: () => state.reply.trim().length > 1,
    tools: {
      say: {
        description: "Send the chat reply. Call this on every turn, after any edit.",
        inputSchema: z.object({ message: z.string() }),
        execute: (raw) => {
          const message = text((raw as { message?: string }).message);
          if (message.split(/\s+/).length < 3) return { ok: false, error: "Write a full sentence for the chat." };
          state.reply = message.slice(0, 800);
          state.status = state.reply;
          return { ok: true };
        },
      },
      insert_prose: {
        description: "Insert one headed explanation into a section, after afterBlockId.",
        inputSchema: z.object({ sectionId: z.string(), afterBlockId: z.string(), heading: z.string(), body: z.string() }),
        execute: (raw) => {
          const request = raw as { sectionId?: string; afterBlockId?: string; heading?: string; body?: string };
          const next = insertProse(state.sections, {
            sectionId: text(request.sectionId) || text(input.visibleSectionId),
            afterBlockId: text(request.afterBlockId) || text(input.highlightedBlockId),
            heading: text(request.heading),
            body: text(request.body),
          });
          if (!next) return { ok: false, error: "Name the section id and write a heading plus a paragraph of at least 40 characters." };
          state.sections = next;
          state.changedDocument = true;
          return { ok: true };
        },
      },
      patch_prose: {
        description: "Rewrite one prose block in any section.",
        inputSchema: z.object({ status: z.string(), sectionId: z.string(), blockId: z.string(), heading: z.string(), body: z.string() }),
        execute: (raw) => {
          const request = raw as { status?: string; sectionId?: string; blockId?: string; heading?: string; body?: string };
          const section = state.sections.find((item) => item.id === request.sectionId);
          const index = section?.blocks.findIndex((block) => block.id === request.blockId) ?? -1;
          const body = text(request.body);
          if (!section || index < 0 || section.blocks[index]?.type !== "prose" || body.length < 40) {
            return { ok: false, error: "Choose a prose block id from any section and write a real paragraph." };
          }
          const current = section.blocks[index];
          if (current.type !== "prose") return { ok: false, error: "That block is not prose." };
          section.blocks[index] = { ...current, heading: text(request.heading).slice(0, 120) || current.heading, body: body.slice(0, 4000) };
          state.status = text(request.status).slice(0, 180) || "Updated a paragraph.";
          state.changedDocument = true;
          return { ok: true };
        },
      },
      replace_section: {
        description: "Replace one section, or append a section when sectionId is empty. Include the full explanation and quiz.",
        inputSchema: sectionSchema.extend({
          status: z.string(),
          sectionId: z.string(),
          title: z.string(),
          objective: z.string(),
          interaction: z.string(),
        }),
        execute: (raw) => {
          const record = raw as Record<string, unknown>;
          const parts = readParts(record.parts);
          const choices = (Array.isArray(record.choices) ? record.choices : []).map((choice) => text(choice)).filter(Boolean).slice(0, 4);
          const prompt = text(record.checkPrompt || record.prompt);
          const title = text(record.title);
          if (!title || parts.length < 2 || !prompt || choices.length !== 4) {
            return { ok: false, error: "A section needs a title, at least 2 prose parts, and a 4-choice quiz." };
          }
          const sectionId = text(record.sectionId);
          const previous = state.sections.find((item) => item.id === sectionId);
          const next: LessonSection = {
            id: previous?.id ?? newId(),
            title: title.slice(0, 120),
            objective: text(record.objective).slice(0, 400),
            interaction: text(record.interaction).slice(0, 400),
            blocks: sectionBlocks({
              title,
              interaction: text(record.interaction),
              parts,
              checkPrompt: prompt,
              choices,
              answerIndex: Math.min(3, Math.max(0, Math.round(Number(record.answerIndex) || 0))),
              explanation: text(record.explanation),
              equationLatex: text(record.equationLatex || record.latex).slice(0, 300),
              equationCaption: text(record.equationCaption || record.caption).slice(0, 400),
              previous,
            }),
          };
          if (previous) state.sections = state.sections.map((item) => (item.id === previous.id ? next : item));
          else if (state.sections.length >= 6) return { ok: false, error: "A lesson can have at most 6 sections." };
          else state.sections = [...state.sections, next];
          state.minutes = minutesForSections(state.sections.length);
          state.status = text(record.status).slice(0, 180) || (previous ? `Updated ${next.title}.` : `Added ${next.title}.`);
          state.changedDocument = true;
          return { ok: true, sectionId: next.id };
        },
      },
      delete_section: {
        description: "Delete one whole section by id. Keep at least one section.",
        inputSchema: z.object({ status: z.string(), sectionId: z.string() }),
        execute: (raw) => {
          const request = raw as { status?: string; sectionId?: string };
          if (state.sections.length < 2) return { ok: false, error: "Keep at least one section." };
          const next = state.sections.filter((item) => item.id !== request.sectionId);
          if (next.length === state.sections.length) return { ok: false, error: "That section id was not found." };
          state.sections = next;
          state.minutes = minutesForSections(next.length);
          state.status = text(request.status).slice(0, 180) || "Removed a section.";
          state.changedDocument = true;
          return { ok: true };
        },
      },
    },
    system: [
      "Call say once on every turn. The message is the chat reply: one or two sentences. Never reply with a single word such as complete, draft, or a school level.",
      "If the learner asks where something is, call say and do not edit.",
      "If they ask to add a topic inside a section, call insert_prose with that section id and the highlighted block id, then call say and name the heading you added.",
      "Use replace_section only to rewrite a whole page or append a new page. Use delete_section to remove a page.",
      "Do not add a game unless the learner asked for one.",
    ].join(" "),
    prompt: JSON.stringify({
      title: lesson.title,
      topic: lesson.topic,
      level: lesson.level,
      minutes: lesson.minutes,
      instruction: input.instruction,
      selection: input.selection ?? "",
      visibleSectionId: input.visibleSectionId ?? "",
      highlightedBlockId: input.highlightedBlockId ?? "",
      sections: state.sections.map((section) => ({
        id: section.id,
        title: section.title,
        objective: section.objective,
        interaction: section.interaction,
        blocks: section.blocks.map((block) => ({
          id: block.id,
          type: block.type,
          text:
            block.type === "prose"
              ? `${block.heading}: ${block.body.slice(0, 500)}`
              : block.type === "quiz"
                ? block.prompt
                : block.type === "widget"
                  ? block.brief
                  : block.type,
        })),
      })),
    }),
  });

  if (!state.reply.trim()) throw new Error("The model did not reply");
  if (!state.changedDocument) return state;
  const previousIds = new Set(lesson.sections.flatMap((section) => section.blocks.map((block) => block.id)));
  for (const section of state.sections) {
    const pending = section.blocks.find((block) => block.type === "widget" && !block.html.trim() && !previousIds.has(block.id));
    if (!pending || pending.type !== "widget") continue;
    const built = await buildWidget({ topic: lesson.topic, level: lesson.level, title: section.title, brief: pending.brief });
    section.blocks = section.blocks.map((block) => (block.id === pending.id ? { ...built, id: pending.id } : block));
  }
  return state;
}

export async function buildWidget(input: { topic: string; level: string; title: string; brief: string }): Promise<WidgetBlock> {
  const drafted = await runSpecialist({
    toolName: "return_widget",
    inputSchema: z.object({ title: z.string(), html: z.string() }),
    models: [
      { provider: "openai", name: "gpt-4o-mini" },
      { provider: "anthropic", name: "claude-sonnet-4-6" },
    ],
    timeoutMs: 22_000,
    system: [
      "Call return_widget once. Do not reply with prose.",
      "html is one short page: inline CSS, a few lines of JavaScript, no libraries, no network, no iframes.",
      "One control the learner can move or click, and a visible way to tell whether they succeeded.",
      "Stay under 80 lines.",
    ].join(" "),
    prompt: `Topic: ${input.topic}\nLevel: ${input.level}\nSection: ${input.title}\nBrief: ${input.brief}`,
  });
  const html = drafted && typeof drafted.html === "string" ? sandboxDocument(drafted.html) : null;
  const title = drafted && typeof drafted.title === "string" && drafted.title.trim() ? drafted.title.trim().slice(0, 120) : input.title;
  return {
    id: newId(),
    type: "widget",
    title,
    brief: input.brief,
    html: html ?? widgetFallback(input.brief),
  };
}
