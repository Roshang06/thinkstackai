import { jsonError, readUser } from "@/lib/http";
import { normalizeInterests } from "@/lib/profile";
import { enrollmentFor, getCourse, getLessonsByIds, listEnrollments, updateCourse } from "@/lib/store";
import { toSummary } from "@/lib/summary";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  const user = await readUser(request);
  const { id } = await context.params;
  const course = await getCourse(id);
  if (!course) return jsonError("Course not found", 404);
  const enrollment = user ? await enrollmentFor(course.id, user.id) : null;
  const isOwner = user?.id === course.ownerId;
  const canOpen = course.visibility === "public" || isOwner || enrollment?.status === "member";
  if (!canOpen) return jsonError("Course not found", 404);
  const lessons = (await getLessonsByIds(course.lessonIds)).map(toSummary);
  const roster = isOwner ? await listEnrollments(course.id) : [];
  return Response.json({
    course,
    lessons,
    roster,
    membership: isOwner ? "owner" : enrollment?.status ?? "visitor",
  });
}

export async function PATCH(request: Request, context: Context) {
  const user = await readUser(request);
  if (!user) return jsonError("Sign in required", 401);
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as {
    title?: string;
    summary?: string;
    topics?: string[];
    addLessonId?: string;
    removeLessonId?: string;
  } | null;
  if (!body) return jsonError("Could not read that change.", 400);
  if (body.addLessonId) {
    const lessons = await getLessonsByIds([body.addLessonId]);
    if (lessons[0]?.ownerId !== user.id) return jsonError("Add a lesson you created.", 400);
  }
  const course = await updateCourse(id, user.id, {
    title: body.title?.replace(/\s+/g, " ").trim().slice(0, 140),
    summary: typeof body.summary === "string" ? body.summary.replace(/\s+/g, " ").trim().slice(0, 400) : undefined,
    topics: body.topics ? normalizeInterests(body.topics) : undefined,
    addLessonId: body.addLessonId,
    removeLessonId: body.removeLessonId,
  });
  if (!course) return jsonError("Course not found", 404);
  return Response.json({ course });
}
