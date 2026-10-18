import type { Lesson, LessonSummary } from "./types";

export function toSummary(lesson: Lesson): LessonSummary {
  return {
    id: lesson.id,
    ownerId: lesson.ownerId,
    ownerName: lesson.ownerName,
    institution: lesson.institution,
    title: lesson.title,
    topic: lesson.topic,
    level: lesson.level,
    minutes: lesson.minutes,
    tags: lesson.tags,
    visibility: lesson.visibility,
    summary: lesson.summary,
    blockCount: lesson.blocks.length,
    sectionCount: lesson.sections.length,
    stage: lesson.stage,
    createdAt: lesson.createdAt,
    updatedAt: lesson.updatedAt,
  };
}
