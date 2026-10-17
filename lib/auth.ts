import { SignJWT, jwtVerify } from "jose";

export type SessionUser = { id: string; name: string; email: string };

const SESSION = "thinkstack_session";
const OAUTH = "thinkstack_oauth";

function key(): Uint8Array {
  const raw = process.env.SESSION_SECRET?.trim();
  if (raw && raw.length >= 16) return new TextEncoder().encode(raw);
  if (process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET is required");
  return new TextEncoder().encode("thinkstack-dev-session-secret-key");
}

export function googleAuthEnabled(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim());
}

export function normalizeEmail(email: string): string | null {
  const value = email.trim().toLowerCase();
  if (value.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return null;
  return value;
}

export function normalizeName(name: string): string | null {
  const value = name.replace(/\s+/g, " ").trim().slice(0, 40);
  if (value.length < 1) return null;
  return value;
}

export function validPassword(password: string): boolean {
  return password.length >= 8 && password.length <= 72;
}

export function safeNext(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/";
  return value;
}

export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [rawName, ...rest] = part.trim().split("=");
    if (rawName === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

function cookie(name: string, value: string, maxAge: number): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export function sessionCookie(token: string): string {
  return cookie(SESSION, token, 60 * 60 * 24 * 14);
}

export function clearSessionCookie(): string {
  return cookie(SESSION, "", 0);
}

export async function signSession(user: SessionUser): Promise<string> {
  return new SignJWT({ id: user.id, name: user.name, email: user.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("14d")
    .sign(key());
}

export async function readSessionUser(request: Request): Promise<SessionUser | null> {
  const token = readCookie(request, SESSION);
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    const id = typeof payload.id === "string" ? payload.id : payload.sub;
    const email = typeof payload.email === "string" ? payload.email : "";
    const name = typeof payload.name === "string" ? payload.name : "";
    if (!id || !email) return null;
    return { id, email, name: name || "Student" };
  } catch {
    return null;
  }
}

export async function signOAuthState(state: string, next: string): Promise<string> {
  return new SignJWT({ state, next })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("10m")
    .sign(key());
}

export function oauthCookie(token: string): string {
  return cookie(OAUTH, token, 60 * 10);
}

export function clearOAuthCookie(): string {
  return cookie(OAUTH, "", 0);
}

export async function readOAuthState(request: Request): Promise<{ state: string; next: string } | null> {
  const token = readCookie(request, OAUTH);
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    const state = typeof payload.state === "string" ? payload.state : "";
    const next = typeof payload.next === "string" ? payload.next : "/";
    if (!state) return null;
    return { state, next: safeNext(next) };
  } catch {
    return null;
  }
}
