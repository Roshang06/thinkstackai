import { jsonError, readUser } from "@/lib/http";
import { leaveCourse, setEnrollment } from "@/lib/store";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const user = await readUser(request);
  if (!user) return jsonError("Sign in required", 401);
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as { userId?: string; action?: string } | null;
  if (body?.action === "leave") {
    const left = await leaveCourse(id, user.id);
    if (!left) return jsonError("You are not enrolled in this course.", 400);
    return Response.json({ ok: true });
  }
  if (!body?.userId || (body.action !== "member" && body.action !== "remove")) return jsonError("Choose a student.", 400);
  const ok = await setEnrollment(id, user.id, body.userId, body.action);
  if (!ok) return jsonError("Course not found", 404);
  return Response.json({ ok: true });
}
