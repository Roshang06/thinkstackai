import { isBlock } from "./document";
import type { Block, Lesson, LessonSection, LessonStage } from "./types";

export function sectionCount(minutes: number): number {
  if (minutes <= 5) return 2;
  if (minutes >= 20) return 6;
  return 4;
}

export function sectionBounds(minutes: number): { min: number; max: number } {
  if (minutes <= 5) return { min: 2, max: 3 };
  if (minutes >= 20) return { min: 4, max: 6 };
  return { min: 2, max: 6 };
}

export function minutesForSections(count: number): number {
  return Math.min(30, Math.max(5, count * 4));
}

export function proseDepth(minutes: number): { parts: number; words: number } {
  if (minutes >= 20) return { parts: 3, words: 150 };
  if (minutes <= 5) return { parts: 2, words: 80 };
  return { parts: 3, words: 110 };
}

export function flattenSections(sections: LessonSection[]): Block[] {
  return sections.flatMap((section) => section.blocks);
}

export function oneSection(title: string, objective: string, blocks: Block[], id = "section-1"): LessonSection[] {
  return [{ id, title, objective, interaction: "", blocks }];
}

export function normalizeLesson<T extends Partial<Lesson> & Pick<Lesson, "blocks">>(lesson: T): Lesson {
  const stored = lesson.sections;
  const sections = Array.isArray(stored) && stored.length > 0
    ? stored.map((section, index) => ({
        id: typeof section.id === "string" && section.id ? section.id : `section-${index + 1}`,
        title: typeof section.title === "string" && section.title.trim() ? section.title.trim().slice(0, 120) : `Section ${index + 1}`,
        objective: typeof section.objective === "string" ? section.objective.slice(0, 400) : "",
        interaction: typeof section.interaction === "string" ? section.interaction.slice(0, 400) : "",
        blocks: Array.isArray(section.blocks) ? section.blocks.filter(isBlock) : [],
      }))
    : oneSection(lesson.title || "Lesson", lesson.summary || "", (lesson.blocks ?? []).filter(isBlock));
  const stage: LessonStage = lesson.stage === "drafting" ? "drafting" : "ready";
  return {
    ...(lesson as Lesson),
    sections,
    blocks: flattenSections(sections),
    stage,
    activity: typeof lesson.activity === "string" ? lesson.activity.slice(0, 180) : "",
  };
}
