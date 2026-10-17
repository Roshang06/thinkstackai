import { jsonError, readUser } from "@/lib/http";
import { getLesson, lessonReadable, setBlockComplete } from "@/lib/store";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const user = await readUser(request);
  if (!user) return jsonError("Sign in required", 401);
  const { id } = await context.params;
  const lesson = await getLesson(id);
  if (!lesson || !lessonReadable(lesson, user.id)) return jsonError("Lesson not found", 404);
  const body = (await request.json()) as { blockId?: string; completed?: boolean };
  if (!body.blockId || !lesson.blocks.some((block) => block.id === body.blockId)) return jsonError("Unknown block", 400);
  const completedBlockIds = await setBlockComplete(user.id, id, body.blockId, body.completed !== false);
  return Response.json({ completedBlockIds });
}
