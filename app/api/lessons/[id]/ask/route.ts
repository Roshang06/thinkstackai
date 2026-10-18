import { generationErrorMessage } from "@/lib/gemini";
import { jsonError, readUser } from "@/lib/http";
import { getLesson, lessonReadable, lessonSharedThroughCourse } from "@/lib/store";
import { askTutor, type TutorTurn } from "@/lib/tutor";

export const maxDuration = 60;

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const user = await readUser(request);
  const { id } = await context.params;
  const lesson = await getLesson(id);
  const shared = lesson ? await lessonSharedThroughCourse(lesson.id, user?.id ?? null) : false;
  if (!lesson || (!lessonReadable(lesson, user?.id ?? null) && !shared)) return jsonError("Lesson not found", 404);
  if (lesson.stage === "drafting") return jsonError("This lesson is still being written.", 409);

  const body = (await request.json()) as {
    question?: string;
    sectionId?: string;
    selection?: string;
    history?: TutorTurn[];
  };
  const question = body.question?.trim() ?? "";
  if (question.length < 2 || question.length > 500) return jsonError("Ask a short question", 400);

  try {
    const answer = await askTutor(lesson, {
      question,
      sectionId: body.sectionId,
      selection: body.selection?.slice(0, 500),
      history: Array.isArray(body.history) ? body.history.slice(-6) : [],
    });
    return Response.json(answer);
  } catch (error) {
    console.error("Tutor reply failed", error instanceof Error ? error.message : error);
    return jsonError(generationErrorMessage(error, "The tutor could not answer. Try again."), 502);
  }
}
