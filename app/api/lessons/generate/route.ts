import { draftSections, planLesson } from "@/lib/course";
import { generationErrorMessage } from "@/lib/gemini";
import { jsonError, readUser } from "@/lib/http";
import { addMessage, createLesson, findAccountById } from "@/lib/store";
import type { Lesson } from "@/lib/types";

export const maxDuration = 60;

export async function POST(request: Request) {
  const user = await readUser(request);
  if (!user) return jsonError("Sign in to create a lesson.", 401);
  const body = (await request.json()) as { topic?: string; level?: string; minutes?: number; notes?: string };
  const topic = body.topic?.trim() ?? "";
  const level = body.level?.trim().slice(0, 40) ?? "";
  const minutes = Number(body.minutes);
  if (topic.length < 2 || topic.length > 500) return jsonError("Add a topic", 400);
  if (level.length < 2) return jsonError("Choose a level", 400);
  if (!Number.isInteger(minutes) || minutes < 5 || minutes > 120) return jsonError("Choose a length between 5 and 120 minutes", 400);

  try {
    const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 1000) : "";
    const outline = await planLesson({ topic, level, minutes, notes });
    const sections = draftSections(outline);
    const timestamp = new Date().toISOString();
    const lesson: Lesson = {
      id: crypto.randomUUID(),
      ownerId: user.id,
      ownerName: user.name,
      institution: (await findAccountById(user.id))?.institution ?? "",
      title: outline.title,
      topic,
      level,
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
