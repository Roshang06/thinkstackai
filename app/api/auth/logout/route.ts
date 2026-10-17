import { clearSessionCookie } from "@/lib/auth";

export async function POST() {
  const response = Response.json({ ok: true });
  response.headers.set("Set-Cookie", clearSessionCookie());
  return response;
}
