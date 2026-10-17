"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { jsonHeaders, useUser } from "./user";

function safeNext(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/";
  return value;
}

export function AuthPage() {
  const router = useRouter();
  const search = useSearchParams();
  const { refresh } = useUser();
  const next = safeNext(search.get("next"));
  const [mode, setMode] = useState<"login" | "signup">(search.get("mode") === "signup" ? "signup" : "login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(search.get("error") === "google" ? "Google sign-in is not configured yet." : search.get("error") === "auth" ? "Google sign-in failed. Try again." : "");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError("");
    const response = await fetch(mode === "signup" ? "/api/auth/signup" : "/api/auth/login", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify(mode === "signup" ? { name, email, password } : { email, password }),
    });
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!response.ok) {
      setError(body.error ?? "Could not sign in.");
      return;
    }
    await refresh();
    router.push(next);
  }

  return (
    <div className="mx-auto max-w-md px-5 py-16">
      <h1 className="font-display text-5xl tracking-tight">{mode === "signup" ? "Create an account" : "Log in"}</h1>
      <p className="mt-3 text-muted">
        {mode === "signup" ? "Save lessons to your account." : "Your lessons are waiting after you sign in."}
      </p>
      <a href={`/api/auth/google?next=${encodeURIComponent(next)}`} className="mt-8 block rounded-full border border-line px-5 py-2 text-center">
        Continue with Google
      </a>
      <form
        className="mt-6 grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        {mode === "signup" ? (
          <label className="grid gap-2">
            <span className="text-sm text-muted">Name</span>
            <input value={name} onChange={(event) => setName(event.target.value)} className="border-b border-line bg-transparent py-2 outline-none focus:border-accent" />
          </label>
        ) : null}
        <label className="grid gap-2">
          <span className="text-sm text-muted">Email</span>
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="border-b border-line bg-transparent py-2 outline-none focus:border-accent" />
        </label>
        <label className="grid gap-2">
          <span className="text-sm text-muted">Password</span>
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="border-b border-line bg-transparent py-2 outline-none focus:border-accent" />
        </label>
        <button type="submit" disabled={busy} className="mt-2 w-fit rounded-full bg-accent px-5 py-2 text-paper disabled:opacity-60">
          {busy ? "Working…" : mode === "signup" ? "Create account" : "Log in"}
        </button>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
      </form>
      <button
        type="button"
        className="mt-6 text-sm text-muted hover:text-foreground"
        onClick={() => {
          setMode(mode === "signup" ? "login" : "signup");
          setError("");
        }}
      >
        {mode === "signup" ? "Already have an account? Log in" : "Need an account? Create one"}
      </button>
      <p className="mt-4 text-sm text-muted">
        <Link href="/explore" className="hover:text-foreground">
          Browse public lessons
        </Link>
      </p>
    </div>
  );
}
