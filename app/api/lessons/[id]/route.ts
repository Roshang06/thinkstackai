import { isBlock } from "@/lib/document";
import { jsonError, readUser } from "@/lib/http";
import { deleteLesson, getLesson, lessonReadable, listMessages, progressFor, saveLesson } from "@/lib/store";
import type { Block } from "@/lib/types";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  const user = await readUser(request);
  const { id } = await context.params;
  const lesson = await getLesson(id);
  if (!lesson || !lessonReadable(lesson, user?.id ?? null)) return jsonError("Lesson not found", 404);
  const messages = user && lesson.ownerId === user.id ? await listMessages(id) : [];
  const progress = user ? await progressFor(user.id, [id]) : {};
  return Response.json({
    lesson,
    messages,
    completedBlockIds: progress[id] ?? [],
    canEdit: user !== null && lesson.ownerId === user.id,
  });
}

export async function PATCH(request: Request, context: Context) {
  const user = await readUser(request);
  if (!user) return jsonError("Sign in required", 401);
  const { id } = await context.params;
  const body = (await request.json()) as { blocks?: unknown; sectionId?: string; title?: string; visibility?: "private" | "public" };
  let blocks: Block[] | undefined;
  if (body.blocks !== undefined) {
    if (!Array.isArray(body.blocks) || !body.blocks.every(isBlock)) return jsonError("Invalid blocks", 400);
    blocks = body.blocks;
  }
  const existing = await getLesson(id);
  if (existing?.stage === "drafting" && blocks) return jsonError("Wait until the lesson finishes.", 409);
  try {
    const lesson = await saveLesson(id, user.id, { blocks, sectionId: body.sectionId, title: body.title, visibility: body.visibility });
    if (!lesson) return jsonError("Lesson not found", 404);
    return Response.json({ lesson });
  } catch {
    return jsonError("Could not save the lesson", 400);
  }
}

export async function DELETE(request: Request, context: Context) {
  const user = await readUser(request);
  if (!user) return jsonError("Sign in required", 401);
  const { id } = await context.params;
  const removed = await deleteLesson(id, user.id);
  if (!removed) return jsonError("Lesson not found", 404);
  return Response.json({ ok: true });
}
