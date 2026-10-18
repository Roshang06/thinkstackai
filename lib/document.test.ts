import assert from "node:assert/strict";
import test from "node:test";
import { prose } from "./blocks";
import { applyOfflineCommand, isBlock, progressPercent } from "./document";
import { buildLesson, matchCurated, seedLessons } from "./offline";
import { generationErrorMessage } from "./gemini";
import { backboardModels, geminiModelNames, providerLabels, specialistModel } from "./providers";
import { attachArtifacts, isPlaceholderCopy, normalizeBlock } from "./schema";
import { normalizeBirthday, normalizeInstitution, normalizeInterests } from "./profile";
import { isDisplayMath, parseMarkup, tidySectionParts } from "./markup";
import { insertProse, minutesForSections, normalizeLesson, sectionBounds, sectionCount } from "./sections";
import { sandboxDocument } from "./widget";
import type { Block } from "./types";

test("curated topics match the hand-written lessons", () => {
  assert.equal(matchCurated("Fourier transform for beginners"), "fourier");
  assert.equal(matchCurated("projectile motion"), "projectile");
  assert.equal(matchCurated("derivatives and slope"), "derivative");
  assert.equal(matchCurated("photosynthesis"), null);
});

test("a 10 minute Fourier lesson keeps the graph, wave, and quiz", () => {
  const { lesson, status } = buildLesson(
    { topic: "Fourier transform", level: "high", minutes: 10, ownerId: "user-1", ownerName: "Student" },
    "lesson-1",
  );
  assert.match(status, /8 parts/);
  assert.equal(lesson.blocks.length, 8);
  assert.ok(lesson.blocks.some((block) => block.type === "graph"));
  assert.ok(lesson.blocks.some((block) => block.type === "simulation"));
  assert.ok(lesson.blocks.some((block) => block.type === "quiz"));
  assert.ok(lesson.blocks.every(isBlock));
});

test("unknown topics stay an outline instead of invented facts", () => {
  const { lesson } = buildLesson(
    { topic: "Photosynthesis", level: "middle", minutes: 10, ownerId: "user-1", ownerName: "Student" },
    "lesson-2",
  );
  const opening = lesson.blocks[0];
  assert.equal(opening.type, "prose");
  if (opening.type === "prose") assert.match(opening.body, /not written yet/);
});

test("asking for a simulation inserts one after the selected part", () => {
  const blocks = [prose("Definition", "A signal can be written as waves. The rest of the definition stays here for the reader.")];
  const edited = applyOfflineCommand(blocks, { instruction: "show this as a simulation", blockId: blocks[0].id });
  assert.equal(edited.blocks.length, 2);
  assert.equal(edited.blocks[1].type, "simulation");
  assert.match(edited.status, /Added a wave simulation after part 1/);
});

test("shorter keeps the first two sentences of a prose block", () => {
  const blocks = [prose("Definition", "First sentence. Second sentence. Third sentence should go.")];
  const edited = applyOfflineCommand(blocks, { instruction: "make this shorter", blockId: blocks[0].id });
  assert.equal(edited.blocks.length, 1);
  const block = edited.blocks[0];
  assert.equal(block.type, "prose");
  if (block.type === "prose") {
    assert.match(block.body, /First sentence/);
    assert.doesNotMatch(block.body, /Third sentence/);
  }
});

test("public seeds are readable lessons", () => {
  const seeds = seedLessons();
  assert.equal(seeds.length, 3);
  assert.ok(seeds.every((lesson) => lesson.visibility === "public" && lesson.blocks.every(isBlock)));
});

test("a written equation like y = x squared becomes a plottable expression", () => {
  const block = normalizeBlock({
    type: "graph",
    heading: "",
    body: "",
    latex: "",
    caption: "",
    title: "Parabola",
    expression: "y = x²",
    xMin: -4,
    xMax: 4,
    yMin: 0,
    yMax: 16,
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
  assert.equal(block?.type, "graph");
  if (block?.type === "graph") assert.equal(block.expression, "x^2");
});

test("model blocks with unsafe graph expressions are dropped", () => {
  const block = normalizeBlock({
    type: "graph",
    heading: "",
    body: "",
    latex: "",
    caption: "",
    title: "Nope",
    expression: "fetch('https://example.com')",
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
  assert.equal(block, null);
});

test("placeholder prose from the old outline is rejected", () => {
  assert.equal(isPlaceholderCopy("The explanations are not written yet."), true);
  const block = normalizeBlock({
    type: "prose",
    heading: "Outline",
    body: "This page is a structure for the topic. The explanations are not written yet.",
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
  assert.equal(block, null);
});

test("model providers are tried in order and blank keys are skipped", () => {
  assert.deepEqual(
    providerLabels({
      OPENROUTER_API_KEY: "sk-or",
      BACKBOARD_API_KEY: "bb",
      GOOGLE_GENERATIVE_AI_API_KEY: "gem",
    }),
    ["Backboard", "OpenRouter", "Gemini"],
  );
  assert.deepEqual(providerLabels({ GOOGLE_GENERATIVE_AI_API_KEY: "gem" }), ["Gemini"]);
  assert.deepEqual(providerLabels({ OPENROUTER_API_KEY: "your-key" }), []);
  assert.deepEqual(providerLabels({ "OPENROUTER_API_KEY ": "sk-or" }), ["OpenRouter"]);
  assert.deepEqual(providerLabels({}), []);
});

test("backboard tries a strong model first and artifacts stay unique", () => {
  assert.deepEqual(backboardModels({}), [
    { provider: "openai", name: "gpt-4.1" },
    { provider: "anthropic", name: "claude-sonnet-4-6" },
    { provider: "openai", name: "gpt-4o-mini" },
  ]);
  assert.equal(specialistModel({}).provider, "anthropic");
  assert.equal(backboardModels({ BACKBOARD_MODEL: "gpt-4.1" })[0].name, "gpt-4.1");
  const prose = { id: "p", type: "prose", heading: "Note", body: "Text." } as Block;
  const quiz = { id: "q", type: "quiz", prompt: "Which?", choices: ["a"], answerIndex: 0, explanation: "a" } as Block;
  const graph = { id: "g", type: "graph", title: "Line", expression: "x", xMin: -1, xMax: 1, yMin: -1, yMax: 1 } as Block;
  const merged = attachArtifacts([prose, quiz], [graph, graph]);
  assert.deepEqual(merged.map((block) => block.type), ["prose", "graph", "quiz"]);
});

test("an overloaded Gemini model is followed by other flash models", () => {
  assert.deepEqual(geminiModelNames({ GEMINI_MODEL: "gemini-3.8-flash" }), [
    "gemini-3.8-flash",
    "gemini-3.5-flash",
    "gemini-3.5-flash-lite",
    "gemini-flash-latest",
  ]);
  assert.deepEqual(geminiModelNames({ GEMINI_MODEL: "gemini-3.5-flash" })[0], "gemini-3.5-flash");
  assert.equal(new Set(geminiModelNames({ GEMINI_MODEL: "gemini-3.5-flash" })).size, 4);
});

test("quota failures become a short error", () => {
  assert.match(generationErrorMessage(new Error("You exceeded your current quota"), "fallback"), /free requests/);
});

test("longer lessons plan more sections", () => {
  assert.equal(sectionCount(5), 2);
  assert.equal(sectionCount(10), 4);
  assert.equal(sectionCount(20), 6);
  assert.deepEqual(sectionBounds(10), { min: 2, max: 6 });
  assert.equal(minutesForSections(2), 8);
  assert.equal(minutesForSections(6), 24);
});

test("an older lesson without sections still opens as one section", () => {
  const lesson = normalizeLesson({
    id: "old",
    ownerId: "user",
    ownerName: "Student",
    title: "Limits",
    topic: "Limits",
    level: "high",
    minutes: 10,
    tags: [],
    visibility: "private",
    summary: "An introduction.",
    blocks: [prose("Start", "A limit describes the value being approached.")],
    createdAt: "2026-10-17T00:00:00.000Z",
    updatedAt: "2026-10-17T00:00:00.000Z",
  });
  assert.equal(lesson.institution, "");
  assert.equal(lesson.sections.length, 1);
  assert.equal(lesson.sections[0]?.blocks.length, 1);
  assert.equal(lesson.stage, "ready");
});

test("a widget document cannot load an outside script", () => {
  const html = sandboxDocument(`<html><head><script src="https://evil.example/app.js"></script></head><body><p>Try it</p><script>document.body.dataset.ready = "yes";</script></body></html>`);
  assert.ok(html);
  assert.equal(html?.includes("evil.example"), false);
  assert.match(html ?? "", /script-src 'unsafe-inline'/);
  assert.match(html ?? "", /dataset\.ready/);
});

test("a requested subsection is inserted after the highlighted block", () => {
  const sections = [
    {
      id: "s2",
      title: "Scheduling",
      objective: "How a project is ordered.",
      interaction: "",
      blocks: [prose("Tasks", "A schedule lists the tasks that have to finish before others can start.")],
    },
  ];
  const highlighted = sections[0]?.blocks[0]?.id ?? "";
  const next = insertProse(sections, {
    sectionId: "s2",
    afterBlockId: highlighted,
    heading: "Critical path",
    body: "The critical path is the longest chain of dependent tasks. Delaying any task on it delays the whole project.",
  });
  assert.equal(next?.[0]?.blocks.length, 2);
  assert.equal(next?.[0]?.blocks[1]?.type, "prose");
  if (next?.[0]?.blocks[1]?.type === "prose") assert.match(next[0].blocks[1].heading, /Critical path/);
  assert.equal(insertProse(sections, { sectionId: "missing", afterBlockId: highlighted, heading: "No", body: "Too short to count as a paragraph for the reader." }), null);
});

test("short math stays inline and repeated headings are dropped", () => {
  assert.equal(isDisplayMath("V"), false);
  assert.equal(isDisplayMath("\\frac{V}{R}"), true);
  const blocks = parseMarkup("The voltage is $V$ in **series**.\n\n<h2>Loops</h2>\nA loop is closed.\n\n$$\\frac{1}{R}$$");
  assert.equal(blocks[0]?.type, "paragraph");
  if (blocks[0]?.type === "paragraph") {
    assert.equal(blocks[0].children.some((child) => child.type === "math"), true);
    assert.equal(blocks[0].children.some((child) => child.type === "bold"), true);
  }
  assert.equal(blocks.some((block) => block.type === "heading"), true);
  assert.equal(blocks.some((block) => block.type === "math"), true);
  const parts = tidySectionParts(
    [
      { heading: "Ohm's law", body: "Current depends on voltage." },
      { heading: "Ohm's law", body: "<h2>Ohm's law</h2>\nThe same idea again, with more detail about resistance." },
      { heading: "Power", body: "Power is voltage times current." },
    ],
    "Ohm's law",
  );
  assert.equal(parts[0]?.heading, "");
  assert.equal(parts[1]?.heading, "");
  assert.equal(parts[1]?.body.startsWith("<h2>"), false);
  assert.equal(parts[2]?.heading, "Power");
});

test("signup profile fields stay private and bounded", () => {
  assert.equal(normalizeInstitution("  University of Washington "), "University of Washington");
  assert.equal(normalizeInstitution("A"), null);
  assert.equal(normalizeBirthday("2004-02-29"), "2004-02-29");
  assert.equal(normalizeBirthday("2003-02-29"), null);
  assert.equal(normalizeBirthday("2099-01-01"), null);
  assert.deepEqual(normalizeInterests([" Calculus ", "calculus", "a", "Physics"]), ["Calculus", "Physics"]);
});

test("progress percent rounds", () => {
  assert.equal(progressPercent(1, 4), 25);
  assert.equal(progressPercent(0, 0), 0);
});
