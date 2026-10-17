import { appStatus, jsonError, readUser } from "@/lib/http";
import { listForOwner, progressFor } from "@/lib/store";

export async function GET(request: Request) {
  const user = readUser(request);
  if (!user) return jsonError("Missing user", 401);
  const lessons = await listForOwner(user.id);
  const progress = await progressFor(
    user.id,
    lessons.map((lesson) => lesson.id),
  );
  return Response.json({ lessons, progress, ...(await appStatus()) });
}
