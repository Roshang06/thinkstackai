import { editLesson } from "@/lib/gemini";
import { jsonError, readUser } from "@/lib/http";
import { addMessage, getLesson, saveLesson } from "@/lib/store";

export const maxDuration = 60;

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const user = readUser(request);
  if (!user) return jsonError("Missing user", 401);
  const { id } = await context.params;
  const lesson = await getLesson(id);
  if (!lesson || lesson.ownerId !== user.id) return jsonError("Lesson not found", 404);

  const body = (await request.json()) as { instruction?: string; blockId?: string; selection?: string };
  const instruction = body.instruction?.trim() ?? "";
  if (instruction.length < 2 || instruction.length > 500) return jsonError("Write a short instruction", 400);

  const edited = await editLesson(lesson, {
    instruction,
    blockId: body.blockId,
    selection: body.selection?.slice(0, 500),
  });
  const saved = await saveLesson(id, user.id, { blocks: edited.blocks });
  if (!saved) return jsonError("Could not update the lesson", 400);
  await addMessage(id, "user", instruction);
  const message = await addMessage(id, "model", edited.status);
  return Response.json({ lesson: saved, message, source: edited.source });
}
