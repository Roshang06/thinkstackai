import { generateLesson } from "@/lib/gemini";
import { jsonError, readUser } from "@/lib/http";
import { addMessage, createLesson } from "@/lib/store";
import type { Level } from "@/lib/types";

export const maxDuration = 60;

const LEVELS = new Set<Level>(["middle", "high", "university"]);

export async function POST(request: Request) {
  const user = readUser(request);
  if (!user) return jsonError("Missing user", 401);
  const body = (await request.json()) as { topic?: string; level?: Level; minutes?: number };
  const topic = body.topic?.trim() ?? "";
  if (topic.length < 2 || topic.length > 160) return jsonError("Add a topic", 400);
  if (!body.level || !LEVELS.has(body.level)) return jsonError("Choose a level", 400);
  if (body.minutes !== 5 && body.minutes !== 10 && body.minutes !== 20) return jsonError("Choose a length", 400);

  const draft = await generateLesson({
    topic,
    level: body.level,
    minutes: body.minutes,
    ownerId: user.id,
    ownerName: user.name,
  });
  const lesson = await createLesson(draft.lesson);
  const message = await addMessage(lesson.id, "model", draft.status);
  return Response.json({ lesson, message, source: draft.source });
}
