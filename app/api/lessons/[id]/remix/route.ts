import { jsonError, readUser } from "@/lib/http";
import { remixLesson } from "@/lib/store";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const user = readUser(request);
  if (!user) return jsonError("Missing user", 401);
  const { id } = await context.params;
  const lesson = await remixLesson(id, user.id, user.name);
  if (!lesson) return jsonError("Lesson not found", 404);
  return Response.json({ lesson });
}
