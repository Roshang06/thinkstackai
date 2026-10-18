"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { jsonHeaders, useUser } from "./user";
import type { Role } from "@/lib/types";

function safeNext(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/";
  return value;
}

export function AuthPage({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const search = useSearchParams();
  const { refresh } = useUser();
  const next = safeNext(search.get("next"));
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("student");
  const [institution, setInstitution] = useState("");
  const [birthday, setBirthday] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [tag, setTag] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const otherHref = `${mode === "signup" ? "/login" : "/signup"}${next === "/" ? "" : `?next=${encodeURIComponent(next)}`}`;

  function addTag() {
    const nextTag = tag.trim();
    if (nextTag.length < 2) return;
    setInterests((current) => (current.some((item) => item.toLowerCase() === nextTag.toLowerCase()) ? current : [...current, nextTag].slice(0, 8)));
    setTag("");
  }

  async function submit() {
    setBusy(true);
    setError("");
    const response = await fetch(mode === "signup" ? "/api/auth/signup" : "/api/auth/login", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify(
        mode === "signup" ? { name, email, password, role, institution, birthday, interests } : { email, password },
      ),
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
    <div className="mx-auto max-w-xl px-5 py-16">
      <h1 className="font-display text-5xl tracking-tight">{mode === "signup" ? "Create an account" : "Log in"}</h1>
      <p className="mt-3 text-muted">
        {mode === "signup" ? "Tell us whether you teach or study, and which school you are with." : "Your lessons are waiting after you sign in."}
      </p>
      <form
        className="mt-8 grid gap-4 rounded-3xl border border-line bg-paper p-6 shadow-sm"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        {mode === "signup" ? (
          <>
            <fieldset className="flex flex-wrap gap-2">
              <legend className="mb-2 text-sm text-muted">I am a</legend>
              {(["student", "instructor"] as Role[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setRole(option)}
                  className={`rounded-full px-3 py-1 text-sm capitalize ${role === option ? "bg-foreground text-paper" : "border border-line"}`}
                >
                  {option}
                </button>
              ))}
            </fieldset>
            <label className="grid gap-2">
              <span className="text-sm text-muted">Name</span>
              <input value={name} onChange={(event) => setName(event.target.value)} className="rounded-2xl border border-line bg-background px-4 py-2 outline-none focus:border-accent" />
            </label>
          </>
        ) : null}
        <label className="grid gap-2">
          <span className="text-sm text-muted">Email</span>
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="rounded-2xl border border-line bg-background px-4 py-2 outline-none focus:border-accent" />
        </label>
        <label className="grid gap-2">
          <span className="text-sm text-muted">Password</span>
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="rounded-2xl border border-line bg-background px-4 py-2 outline-none focus:border-accent" />
        </label>
        {mode === "signup" ? (
          <>
            <label className="grid gap-2">
              <span className="text-sm text-muted">Educational institution</span>
              <input value={institution} onChange={(event) => setInstitution(event.target.value)} placeholder="University of Washington" className="rounded-2xl border border-line bg-background px-4 py-2 outline-none focus:border-accent" />
            </label>
            <label className="grid gap-2">
              <span className="text-sm text-muted">Birthday</span>
              <input type="date" value={birthday} onChange={(event) => setBirthday(event.target.value)} className="rounded-2xl border border-line bg-background px-4 py-2 outline-none focus:border-accent" />
            </label>
            {role === "student" ? (
              <div className="grid gap-2">
                <span className="text-sm text-muted">Topics you want to study</span>
                <div className="flex gap-2">
                  <input
                    value={tag}
                    onChange={(event) => setTag(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addTag();
                      }
                    }}
                    placeholder="Calculus"
                    className="min-w-0 flex-1 rounded-2xl border border-line bg-background px-4 py-2 outline-none focus:border-accent"
                  />
                  <button type="button" onClick={addTag} className="rounded-full border border-line px-4 py-2 text-sm">
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {interests.map((interest) => (
                    <button key={interest} type="button" onClick={() => setInterests((current) => current.filter((item) => item !== interest))} className="rounded-full bg-accent-soft px-3 py-1 text-sm text-accent">
                      {interest}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            <p className="text-sm text-muted">Use at least 8 characters. Your birthday stays on your profile.</p>
          </>
        ) : null}
        <button type="submit" disabled={busy} className="mt-2 w-fit rounded-full bg-accent px-5 py-2 text-paper disabled:opacity-60">
          {busy ? "Working…" : mode === "signup" ? "Create account" : "Log in"}
        </button>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
      </form>
      <p className="mt-6 text-sm text-muted">
        <Link href={otherHref} className="hover:text-foreground">
          {mode === "signup" ? "Already have an account? Log in" : "Need an account? Sign up"}
        </Link>
      </p>
    </div>
  );
}
