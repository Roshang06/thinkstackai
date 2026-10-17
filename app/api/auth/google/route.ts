import { googleAuthEnabled, oauthCookie, safeNext, signOAuthState } from "@/lib/auth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (!googleAuthEnabled()) return Response.redirect(new URL("/login?error=google", url.origin));
  const state = crypto.randomUUID();
  const next = safeNext(url.searchParams.get("next"));
  const redirectUri = `${url.origin}/api/auth/google/callback`;
  const google = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  google.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID!.trim());
  google.searchParams.set("redirect_uri", redirectUri);
  google.searchParams.set("response_type", "code");
  google.searchParams.set("scope", "openid email profile");
  google.searchParams.set("state", state);
  google.searchParams.set("prompt", "select_account");
  const response = Response.redirect(google);
  response.headers.set("Set-Cookie", oauthCookie(await signOAuthState(state, next)));
  return response;
}
