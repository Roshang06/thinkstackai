import { code, equation, flashcards, graph, prose, quiz, reassignIds, shortAnswer, simulation } from "./blocks";
import { oneSection } from "./sections";
import type { Block, Lesson, LessonDraftInput } from "./types";

type CuratedId = "fourier" | "projectile" | "derivative";

function nowIso(): string {
  return new Date().toISOString();
}

function fitLength(blocks: Block[], minutes: number): Block[] {
  const cap = minutes <= 5 ? 5 : minutes >= 20 ? blocks.length : Math.min(blocks.length, 8);
  return blocks.slice(0, cap);
}

export function matchCurated(topic: string): CuratedId | null {
  const text = topic.toLowerCase();
  if (/fourier|harmonic|frequency domain|signal|square wave/.test(text)) return "fourier";
  if (/projectile|kinematic|trajectory|parabola|launch angle/.test(text)) return "projectile";
  if (/derivative|calculus|slope|rate of change|differentiat/.test(text)) return "derivative";
  return null;
}

function fourierBlocks(): Block[] {
  return [
    prose(
      "From a wiggle to a recipe of waves",
      "A Fourier transform takes a signal that changes over time and writes it as a mix of sine and cosine waves. A chord played on a piano is one sound wave. The transform is the list of pitches in that chord, each with its own strength. A sharp corner needs many high-frequency sines stacked together, which is why a square wave's spectrum keeps going.",
    ),
    equation(
      "X(f)=\\int_{-\\infty}^{\\infty} x(t)\\, e^{-i 2\\pi f t}\\, dt",
      "x(t) is the signal in time, f is frequency, and X(f) says how strongly that frequency shows up.",
    ),
    graph(
      "Three odd harmonics",
      "sin(x)+sin(3*x)/3+sin(5*x)/5",
      { xMin: -6.28, xMax: 6.28, yMin: -2, yMax: 2 },
    ),
    simulation(
      "wave",
      "Watch one sine wave",
      "Frequency is how many cycles fit across the screen. Amplitude is the height. A Fourier recipe is a list of waves like this one.",
    ),
    quiz(
      "A Fourier transform mainly converts a signal between which pair of descriptions?",
      ["Time and frequency", "Color and mass", "Distance and temperature", "Charge and spin"],
      0,
      "The usual pair is time (or space) and frequency. The transform does not change the signal into a new physical substance.",
    ),
    shortAnswer(
      "Whole-number multiples of a fundamental frequency are called what?",
      ["harmonics", "harmonic", "odd harmonics"],
      "They are harmonics. In a square wave, the even harmonics cancel and the odd ones remain.",
    ),
    flashcards("Fourier terms", [
      { front: "Fourier transform", back: "A description of a signal as the strength of each sine and cosine wave." },
      { front: "Frequency", back: "How many cycles happen in one second." },
      { front: "Harmonic", back: "A whole-number multiple of a fundamental frequency." },
      { front: "Spectrum", back: "The strength of each frequency in a signal." },
    ]),
    code(
      "Odd harmonics get smaller",
      "javascript",
      "const harmonics = [1, 3, 5];\nfor (const n of harmonics) {\n  console.log('harmonic ' + n + ' amplitude ' + (1 / n).toFixed(3));\n}",
    ),
    prose(
      "What to try next",
      "Change the graph expression to sin(x) and compare it with the three-harmonic sum. The single sine is smooth. The sum is flatter on top and steeper at the edges, which is the start of a square wave.",
    ),
  ];
}

function projectileBlocks(): Block[] {
  return [
    prose(
      "A parabola, if you ignore the air",
      "Launch an object and ignore air resistance. The only acceleration is gravity, straight down. Horizontal velocity stays constant. Vertical velocity loses about 9.8 meters per second of upward speed every second. The path is a parabola.",
    ),
    equation(
      "y=x\\tan\\theta-\\frac{g x^{2}}{2 v^{2}\\cos^{2}\\theta}",
      "v is launch speed, theta is the angle above horizontal, and g is about 9.8 m/s² near Earth's surface.",
    ),
    graph("The shape of the path", "-0.15*x^2+1.2*x", { xMin: 0, xMax: 8, yMin: -1, yMax: 4 }),
    simulation(
      "projectile",
      "Launch it",
      "A 45 degree launch travels farthest when launch and landing heights match and air resistance is ignored.",
    ),
    quiz(
      "With no air resistance, what happens to the horizontal velocity during the flight?",
      ["It stays constant", "It increases at g", "It drops to zero at the top", "It reverses at the top"],
      0,
      "Gravity pulls vertically, so it changes the vertical velocity and leaves the horizontal velocity alone.",
    ),
    shortAnswer(
      "About how many meters per second squared is g near Earth's surface? A number is enough.",
      ["9.8", "9.81", "10", "9.8 m/s^2", "9.81 m/s^2"],
      "9.8 m/s² is the usual value. 10 is a common estimate in class problems.",
    ),
    flashcards("Motion terms", [
      { front: "Parabola", back: "The curved path of a projectile when air resistance is ignored." },
      { front: "g", back: "Acceleration due to gravity, about 9.8 m/s² downward." },
      { front: "Components", back: "Horizontal and vertical pieces of the launch velocity." },
      { front: "Air time", back: "For flat ground, about twice the initial vertical speed divided by g." },
    ]),
    code(
      "Time in the air",
      "javascript",
      "const g = 9.8;\nconst speed = 20;\nconst angle = 45 * Math.PI / 180;\nconst vy = speed * Math.sin(angle);\nconst time = (2 * vy) / g;\nconsole.log('air time ' + time.toFixed(2) + ' s');",
    ),
  ];
}

function derivativeBlocks(): Block[] {
  return [
    prose(
      "Slope at a single instant",
      "The derivative of a function at a point is the slope of the tangent line there. It answers how fast the value is changing at that instant. If f is position, the derivative is velocity. If f is velocity, the derivative is acceleration.",
    ),
    equation(
      "f'(x)=\\lim_{h \\to 0}\\frac{f(x+h)-f(x)}{h}",
      "h is a tiny step in x. The limit squeezes that step toward zero so the slope is instantaneous.",
    ),
    graph("y = x²", "x^2", { xMin: -4, xMax: 4, yMin: -1, yMax: 16 }),
    graph("Slope of x²", "2*x", { xMin: -4, xMax: 4, yMin: -8, yMax: 8 }),
    quiz(
      "If position is measured over time, the derivative of position is",
      ["Velocity", "Mass", "Area under the axis", "The starting height only"],
      0,
      "Velocity is the rate of change of position. Acceleration is the rate of change of velocity.",
    ),
    shortAnswer(
      "What is the derivative of x²? Write it as an expression in x.",
      ["2x", "2*x", "2 x"],
      "The power rule says the derivative of xⁿ is n xⁿ⁻¹, so x² becomes 2x.",
    ),
    flashcards("Derivative terms", [
      { front: "Derivative", back: "The instantaneous rate of change, or the slope of the tangent." },
      { front: "Tangent", back: "A line that touches a curve and matches its slope at one point." },
      { front: "Limit", back: "The value an expression approaches as the step size goes to zero." },
      { front: "Power rule", back: "The derivative of xⁿ is n xⁿ⁻¹." },
    ]),
    code(
      "A numerical slope",
      "javascript",
      "function derivative(f, x) {\n  const h = 0.0001;\n  return (f(x + h) - f(x - h)) / (2 * h);\n}\nconsole.log(derivative((x) => x * x, 3).toFixed(3));",
    ),
  ];
}

const CURATED: Record<CuratedId, { title: string; summary: string; tags: string[]; blocks: () => Block[] }> = {
  fourier: {
    title: "Fourier transform",
    summary: "How a signal in time becomes a recipe of frequencies, with a graph, a wave, and a check.",
    tags: ["math", "signals", "waves"],
    blocks: fourierBlocks,
  },
  projectile: {
    title: "Projectile motion",
    summary: "Constant horizontal velocity, gravity downward, and a parabolic path you can launch.",
    tags: ["physics", "motion", "graphs"],
    blocks: projectileBlocks,
  },
  derivative: {
    title: "Derivatives",
    summary: "Instantaneous slope, from the limit definition to the slope of x squared.",
    tags: ["calculus", "math", "graphs"],
    blocks: derivativeBlocks,
  },
};

function scaffoldBlocks(topic: string): Block[] {
  return [
    prose(
      "Outline",
      `This page is a structure for “${topic}.” The explanations are not written yet. Add a Gemini API key, then ask in the side panel to fill a section in.`,
    ),
    equation("y = f(x)", "Replace this with the central equation for the topic once the model is connected."),
    graph("A placeholder curve", "sin(x)"),
    simulation("wave", "A placeholder wave", "Use this to talk about cycles, or ask the side panel for a simulation that matches the topic."),
    quiz(
      "This draft is still an outline. What fills in the explanation?",
      [
        "A Gemini key, then a request in the side panel",
        "Refreshing the page",
        "Deleting the graph",
        "Renaming the lesson",
      ],
      0,
      "Without a model key, Thinkstack will not invent an explanation for an unknown topic.",
    ),
    shortAnswer(
      "Type the word outline if you can see that this lesson is still a draft.",
      ["outline", "draft"],
      "The curated lessons on Fourier transforms, derivatives, and projectile motion already have full explanations.",
    ),
    flashcards("While you wait", [
      { front: "Document", back: "The lesson itself. Edits land here, not in a chat transcript." },
      { front: "Side panel", back: "Where you ask for a change. The reply is one short status line." },
    ]),
    code("Runner", "javascript", "console.log('Runner is ready')"),
  ];
}

export function buildLesson(input: LessonDraftInput, id: string): { lesson: Lesson; status: string } {
  const curatedId = matchCurated(input.topic);
  const timestamp = nowIso();
  const curated = curatedId ? CURATED[curatedId] : null;
  const blocks = fitLength(reassignIds(curated ? curated.blocks() : scaffoldBlocks(input.topic.trim())), input.minutes);
  const title = curated?.title ?? input.topic.trim();
  const lesson: Lesson = {
    id,
    ownerId: input.ownerId,
    ownerName: input.ownerName,
    title,
    topic: input.topic.trim(),
    level: input.level,
    minutes: input.minutes,
    tags: curated?.tags ?? ["draft"],
    visibility: "private",
    summary: curated?.summary ?? `An outline for ${input.topic.trim()}. Connect Gemini to write the explanation.`,
    blocks,
    sections: oneSection(title, curated?.summary ?? input.topic.trim(), blocks, `${id}-section`),
    stage: "ready",
    activity: "",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  return {
    lesson,
    status: curated
      ? `Created a lesson with ${blocks.length} parts on ${title}.`
      : `Created an outline with ${blocks.length} parts for ${title}.`,
  };
}

export function seedLessons(): Lesson[] {
  const base = {
    ownerId: "community",
    ownerName: "Thinkstack",
    level: "high" as const,
    minutes: 10,
  };
  return (["fourier", "projectile", "derivative"] as CuratedId[]).map((curatedId) => {
    const curated = CURATED[curatedId];
    const timestamp = "2026-10-17T12:00:00.000Z";
    return {
      id: `seed-${curatedId}`,
      ...base,
      title: curated.title,
      topic: curated.title,
      tags: curated.tags,
      visibility: "public" as const,
      summary: curated.summary,
      blocks: curated.blocks(),
      sections: oneSection(curated.title, curated.summary, curated.blocks(), `seed-${curatedId}-section`),
      stage: "ready" as const,
      activity: "",
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  });
}
