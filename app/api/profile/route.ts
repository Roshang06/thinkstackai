import { normalizeName, sessionCookie, signSession } from "@/lib/auth";
import { jsonError, readUser } from "@/lib/http";
import { normalizeBirthday, normalizeInstitution, normalizeInterests, normalizeRole, profileFromAccount } from "@/lib/profile";
import { findAccountById, updateProfile } from "@/lib/store";

export async function GET(request: Request) {
  const session = await readUser(request);
  if (!session) return jsonError("Sign in required", 401);
  const account = await findAccountById(session.id);
  if (!account) return jsonError("Sign in required", 401);
  return Response.json({ profile: profileFromAccount(account) });
}

export async function PATCH(request: Request) {
  const session = await readUser(request);
  if (!session) return jsonError("Sign in required", 401);
  const body = (await request.json().catch(() => null)) as { name?: string; role?: string; institution?: string; interests?: string[]; birthday?: string } | null;
  if (!body) return jsonError("Could not read that profile.", 400);
  const name = normalizeName(body.name ?? "");
  const role = normalizeRole(body.role);
  const institution = normalizeInstitution(body.institution);
  const birthday = normalizeBirthday(body.birthday);
  const interests = normalizeInterests(body.interests);
  if (!name || !role || !institution || !birthday) return jsonError("Name, role, school, and birthday are required.", 400);
  if (role === "student" && interests.length === 0) return jsonError("Add at least one topic you want to study.", 400);
  const account = await updateProfile(session.id, { name, role, institution, interests, birthday });
  if (!account) return jsonError("Could not save the profile.", 400);
  const response = Response.json({ profile: profileFromAccount(account) });
  response.headers.set("Set-Cookie", sessionCookie(await signSession(account)));
  return response;
}
