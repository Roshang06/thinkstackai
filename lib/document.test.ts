import assert from "node:assert/strict";
import test from "node:test";
import { prose } from "./blocks";
import { applyOfflineCommand, isBlock, progressPercent } from "./document";
import { buildLesson, matchCurated, seedLessons } from "./offline";
import { generationErrorMessage } from "./gemini";
import { geminiModelNames, providerLabels } from "./providers";
import { isPlaceholderCopy, normalizeBlock } from "./schema";

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
    ["OpenRouter", "Backboard", "Gemini"],
  );
  assert.deepEqual(providerLabels({ GOOGLE_GENERATIVE_AI_API_KEY: "gem" }), ["Gemini"]);
  assert.deepEqual(providerLabels({ OPENROUTER_API_KEY: "your-key" }), []);
  assert.deepEqual(providerLabels({ "OPENROUTER_API_KEY ": "sk-or" }), ["OpenRouter"]);
  assert.deepEqual(providerLabels({}), []);
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

test("progress percent rounds", () => {
  assert.equal(progressPercent(1, 4), 25);
  assert.equal(progressPercent(0, 0), 0);
});
