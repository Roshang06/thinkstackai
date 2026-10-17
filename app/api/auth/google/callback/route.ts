import { clearOAuthCookie, normalizeEmail, normalizeName, readOAuthState, sessionCookie, signSession } from "@/lib/auth";
import { attachGoogleSub, createAccount, findAccountByEmail, findAccountByGoogleSub } from "@/lib/store";
import type { Account } from "@/lib/types";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const fail = (reason: string) => {
    const response = Response.redirect(new URL(`/login?error=${reason}`, url.origin));
    response.headers.set("Set-Cookie", clearOAuthCookie());
    return response;
  };
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const saved = await readOAuthState(request);
  if (!code || !state || !saved || saved.state !== state) return fail("auth");

  const redirectUri = `${url.origin}/api/auth/google/callback`;
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID?.trim() ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET?.trim() ?? "",
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenResponse.ok) return fail("auth");
  const token = (await tokenResponse.json()) as { access_token?: string };
  if (!token.access_token) return fail("auth");

  const profileResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { authorization: `Bearer ${token.access_token}` },
  });
  if (!profileResponse.ok) return fail("auth");
  const profile = (await profileResponse.json()) as {
    sub?: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
  };
  const email = normalizeEmail(profile.email ?? "");
  if (!profile.sub || !email || profile.email_verified === false) return fail("auth");

  let account: Account | null = await findAccountByGoogleSub(profile.sub);
  if (!account) {
    account = await findAccountByEmail(email);
    if (account) {
      if (!account.googleSub) await attachGoogleSub(account.id, profile.sub);
    } else {
      account = await createAccount({
        email,
        name: normalizeName(profile.name ?? "") ?? email.split("@")[0].slice(0, 40),
        passwordHash: null,
        googleSub: profile.sub,
      });
    }
  }

  const response = Response.redirect(new URL(saved.next, url.origin));
  response.headers.append("Set-Cookie", sessionCookie(await signSession(account)));
  response.headers.append("Set-Cookie", clearOAuthCookie());
  return response;
}
