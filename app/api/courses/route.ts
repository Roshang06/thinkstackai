import { jsonError, readUser } from "@/lib/http";
import { normalizeInterests } from "@/lib/profile";
import { createCourse, findAccountById, listOwnerCourses } from "@/lib/store";

export async function GET(request: Request) {
  const user = await readUser(request);
  if (!user) return jsonError("Sign in required", 401);
  return Response.json({ courses: await listOwnerCourses(user.id) });
}

export async function POST(request: Request) {
  const user = await readUser(request);
  if (!user) return jsonError("Sign in required", 401);
  const body = (await request.json().catch(() => null)) as { title?: string; summary?: string; topics?: string[] } | null;
  const title = body?.title?.replace(/\s+/g, " ").trim().slice(0, 140) ?? "";
  const summary = body?.summary?.replace(/\s+/g, " ").trim().slice(0, 400) ?? "";
  const topics = normalizeInterests(body?.topics);
  if (title.length < 2) return jsonError("Name the course.", 400);
  const account = await findAccountById(user.id);
  const course = await createCourse({
    ownerId: user.id,
    ownerName: account?.name ?? user.name,
    institution: account?.institution ?? "",
    joinable: account?.role === "instructor",
    title,
    summary,
    topics,
  });
  return Response.json({ course });
}
