import { normalizeEmail, sessionCookie, signSession } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { checkPassword } from "@/lib/password";
import { findAccountByEmail } from "@/lib/store";

export async function POST(request: Request) {
  let body: { email?: string; password?: string };
  try {
    body = (await request.json()) as { email?: string; password?: string };
  } catch {
    return jsonError("Enter your email and password.", 400);
  }
  const email = normalizeEmail(body.email ?? "");
  const password = body.password ?? "";
  if (!email || !password) return jsonError("Enter your email and password.", 400);
  const account = await findAccountByEmail(email);
  if (!account?.passwordHash) {
    return jsonError(account?.googleSub ? "This account uses Google sign-in." : "Email or password is incorrect.", 401);
  }
  if (!(await checkPassword(password, account.passwordHash))) return jsonError("Email or password is incorrect.", 401);
  const response = Response.json({ user: { id: account.id, name: account.name, email: account.email } });
  response.headers.set("Set-Cookie", sessionCookie(await signSession(account)));
  return response;
}
