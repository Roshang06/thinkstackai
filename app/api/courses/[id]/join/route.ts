import { jsonError, readUser } from "@/lib/http";
import { findAccountById, getCourse, requestJoin } from "@/lib/store";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const user = await readUser(request);
  if (!user) return jsonError("Sign in required", 401);
  const { id } = await context.params;
  const course = await getCourse(id);
  if (!course || course.visibility !== "public") return jsonError("Course not found", 404);
  if (!course.joinable) return jsonError("This course can be opened, but it does not take join requests.", 400);
  const account = await findAccountById(user.id);
  const enrollment = await requestJoin(course, { id: user.id, name: account?.name ?? user.name });
  if (!enrollment) return jsonError("You cannot join this course.", 400);
  return Response.json({ enrollment });
}
