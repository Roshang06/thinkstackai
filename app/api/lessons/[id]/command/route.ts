import { editCourse } from "@/lib/course";
import { generationErrorMessage } from "@/lib/gemini";
import { jsonError, readUser } from "@/lib/http";
import { addMessage, getLesson, saveLesson } from "@/lib/store";

export const maxDuration = 60;

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const user = await readUser(request);
  if (!user) return jsonError("Sign in to edit a lesson.", 401);
  const { id } = await context.params;
  const lesson = await getLesson(id);
  if (!lesson || lesson.ownerId !== user.id) return jsonError("Lesson not found", 404);

  const body = (await request.json()) as { instruction?: string; blockId?: string; sectionId?: string; selection?: string };
  const instruction = body.instruction?.trim() ?? "";
  if (instruction.length < 2 || instruction.length > 500) return jsonError("Write a short instruction", 400);

  if (lesson.stage === "drafting") return jsonError("Wait until the lesson finishes.", 409);

  try {
    const edited = await editCourse(lesson, {
      instruction,
      selection: body.selection?.slice(0, 500),
      visibleSectionId: body.sectionId,
    });
    const saved = await saveLesson(id, user.id, {
      sections: edited.sections,
      minutes: edited.minutes,
      title: edited.title,
      summary: edited.summary,
      tags: edited.tags,
    });
    if (!saved) return jsonError("Could not update the lesson", 400);
    await addMessage(id, "user", instruction);
    const message = await addMessage(id, "model", edited.status);
    return Response.json({ lesson: saved, message });
  } catch (error) {
    console.error("Lesson edit failed", error instanceof Error ? error.message : error);
    return jsonError(generationErrorMessage(error, "The edit failed. Try again."), 502);
  }
}
