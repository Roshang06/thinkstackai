import { normalizeEmail, normalizeName, sessionCookie, signSession, validPassword } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { hashPassword } from "@/lib/password";
import { createAccount, findAccountByEmail } from "@/lib/store";

export async function POST(request: Request) {
  let body: { email?: string; password?: string; name?: string };
  try {
    body = (await request.json()) as { email?: string; password?: string; name?: string };
  } catch {
    return jsonError("Enter your name, email, and password.", 400);
  }
  const email = normalizeEmail(body.email ?? "");
  const name = normalizeName(body.name ?? "");
  const password = body.password ?? "";
  if (!email || !name || !validPassword(password)) {
    return jsonError("Use a name, a valid email, and a password of at least 8 characters.", 400);
  }
  if (await findAccountByEmail(email)) return jsonError("An account with that email already exists.", 409);
  try {
    const account = await createAccount({
      email,
      name,
      passwordHash: await hashPassword(password),
      googleSub: null,
    });
    const response = Response.json({ user: { id: account.id, name: account.name, email: account.email } });
    response.headers.set("Set-Cookie", sessionCookie(await signSession(account)));
    return response;
  } catch (error) {
    console.error("Signup failed", error instanceof Error ? error.message : error);
    return jsonError("Could not create the account.", 400);
  }
}
