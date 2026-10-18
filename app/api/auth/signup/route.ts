import { normalizeEmail, normalizeName, sessionCookie, signSession, validPassword } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { hashPassword } from "@/lib/password";
import { normalizeBirthday, normalizeInstitution, normalizeInterests, normalizeRole, profileFromAccount } from "@/lib/profile";
import { createAccount, findAccountByEmail } from "@/lib/store";

export async function POST(request: Request) {
  let body: { email?: string; password?: string; name?: string; role?: string; institution?: string; interests?: string[]; birthday?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonError("Enter your name, email, and password.", 400);
  }
  const email = normalizeEmail(body.email ?? "");
  const name = normalizeName(body.name ?? "");
  const password = body.password ?? "";
  const role = normalizeRole(body.role);
  const institution = normalizeInstitution(body.institution);
  const birthday = normalizeBirthday(body.birthday);
  const interests = normalizeInterests(body.interests);
  if (!email || !name || !validPassword(password) || !role || !institution || !birthday) {
    return jsonError("Use a name, a valid email, a password of at least 8 characters, your school, and your birthday.", 400);
  }
  if (role === "student" && interests.length === 0) return jsonError("Add at least one topic you want to study.", 400);
  if (await findAccountByEmail(email)) return jsonError("An account with that email already exists.", 409);
  try {
    const account = await createAccount({
      email,
      name,
      passwordHash: await hashPassword(password),
      googleSub: null,
      role,
      institution,
      interests,
      birthday,
    });
    const response = Response.json({ user: profileFromAccount(account) });
    response.headers.set("Set-Cookie", sessionCookie(await signSession(account)));
    return response;
  } catch (error) {
    console.error("Signup failed", error instanceof Error ? error.message : error);
    return jsonError("Could not create the account.", 400);
  }
}
