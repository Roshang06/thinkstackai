import { draftSections, planLesson } from "@/lib/course";
import { generationErrorMessage } from "@/lib/gemini";
import { jsonError, readUser } from "@/lib/http";
import { addMessage, createLesson } from "@/lib/store";
import type { Lesson, Level } from "@/lib/types";

export const maxDuration = 60;

const LEVELS = new Set<Level>(["middle", "high", "university"]);

export async function POST(request: Request) {
  const user = await readUser(request);
  if (!user) return jsonError("Sign in to create a lesson.", 401);
  const body = (await request.json()) as { topic?: string; level?: Level; minutes?: number; notes?: string };
  const topic = body.topic?.trim() ?? "";
  if (topic.length < 2 || topic.length > 500) return jsonError("Add a topic", 400);
  if (!body.level || !LEVELS.has(body.level)) return jsonError("Choose a level", 400);
  if (body.minutes !== 5 && body.minutes !== 10 && body.minutes !== 20) return jsonError("Choose a length", 400);

  try {
    const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 1000) : "";
    const outline = await planLesson({ topic, level: body.level, minutes: body.minutes, notes });
    const sections = draftSections(outline);
    const timestamp = new Date().toISOString();
    const lesson: Lesson = {
      id: crypto.randomUUID(),
      ownerId: user.id,
      ownerName: user.name,
      institution: "",
      title: outline.title,
      topic,
      level: body.level,
      minutes: outline.minutes,
      tags: outline.tags,
      visibility: "private",
      summary: outline.summary,
      blocks: [],
      sections,
      stage: "drafting",
      activity: "",
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const saved = await createLesson(lesson);
    await addMessage(saved.id, "model", outline.status);
    return Response.json({ lesson: saved });
  } catch (error) {
    console.error("Lesson planning failed", error instanceof Error ? error.message : error);
    return jsonError(generationErrorMessage(error, "Lesson planning failed. Try again."), 502);
  }
}
