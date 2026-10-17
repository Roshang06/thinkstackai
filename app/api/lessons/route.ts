import { appStatus, jsonError, readUser } from "@/lib/http";
import { listForOwner, progressFor } from "@/lib/store";

export async function GET(request: Request) {
  const user = await readUser(request);
  if (!user) return jsonError("Sign in required", 401);
  const lessons = await listForOwner(user.id);
  const progress = await progressFor(
    user.id,
    lessons.map((lesson) => lesson.id),
  );
  return Response.json({ lessons, progress, ...(await appStatus()) });
}
