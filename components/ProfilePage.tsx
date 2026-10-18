"use client";

import { useEffect, useState } from "react";
import { jsonHeaders, useUser } from "./user";
import type { Role } from "@/lib/types";

export function ProfilePage() {
  const { user, loading, refresh } = useUser();
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("student");
  const [institution, setInstitution] = useState("");
  const [birthday, setBirthday] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [tag, setTag] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    setName(user.name);
    setRole(user.role);
    setInstitution(user.institution);
    setBirthday(user.birthday);
    setInterests(user.interests);
  }, [user]);

  function addTag() {
    const nextTag = tag.trim();
    if (nextTag.length < 2) return;
    setInterests((current) => (current.some((item) => item.toLowerCase() === nextTag.toLowerCase()) ? current : [...current, nextTag].slice(0, 8)));
    setTag("");
  }

  async function save() {
    setBusy(true);
    setError("");
    setSaved(false);
    const response = await fetch("/api/profile", {
      method: "PATCH",
      headers: jsonHeaders(),
      body: JSON.stringify({ name, role, institution, birthday, interests }),
    });
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!response.ok) {
      setError(body.error ?? "Could not save the profile.");
      return;
    }
    await refresh();
    setSaved(true);
  }

  if (loading) return null;
  if (!user) return <p className="mx-auto max-w-xl px-5 py-16 text-muted">Log in to edit your profile.</p>;

  return (
    <div className="mx-auto max-w-xl px-5 py-16">
      <h1 className="font-display text-5xl tracking-tight">Profile</h1>
      <p className="mt-3 text-muted">{user.email}. Your birthday is only visible here.</p>
      <form
        className="mt-8 grid gap-4 rounded-3xl border border-line bg-paper p-6 shadow-sm"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
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
        <label className="grid gap-2">
          <span className="text-sm text-muted">Educational institution</span>
          <input value={institution} onChange={(event) => setInstitution(event.target.value)} className="rounded-2xl border border-line bg-background px-4 py-2 outline-none focus:border-accent" />
        </label>
        <label className="grid gap-2">
          <span className="text-sm text-muted">Birthday</span>
          <input type="date" value={birthday} onChange={(event) => setBirthday(event.target.value)} className="rounded-2xl border border-line bg-background px-4 py-2 outline-none focus:border-accent" />
        </label>
        {role === "student" ? (
          <div className="grid gap-2">
            <span className="text-sm text-muted">Topics</span>
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
        <button type="submit" disabled={busy} className="mt-2 w-fit rounded-full bg-accent px-5 py-2 text-paper disabled:opacity-60">
          {busy ? "Saving…" : "Save profile"}
        </button>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        {saved ? <p className="text-sm text-accent">Saved.</p> : null}
      </form>
    </div>
  );
}
