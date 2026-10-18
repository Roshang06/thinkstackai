"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { jsonHeaders, useUser } from "./user";
type Status = { liveModel: boolean; storage: "file" | "mongo"; storageNote: string | null };
type Draft = { topic: string; level: string; minutes: number; notes: string };

const LEVELS = ["middle", "high", "university"] as const;

const DRAFT_KEY = "thinkstack-draft";
let draftStarted = false;

export function HomePage() {
  const router = useRouter();
  const { user, loading } = useUser();
  const [status, setStatus] = useState<Status | null>(null);
  const [topic, setTopic] = useState("");
  const [notes, setNotes] = useState("");
  const [level, setLevel] = useState("high");
  const [minutes, setMinutes] = useState(10);
  const [customLevel, setCustomLevel] = useState("");
  const [customMinutes, setCustomMinutes] = useState("");
  const [levelCustom, setLevelCustom] = useState(false);
  const [timeCustom, setTimeCustom] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const started = useRef(false);

  const load = useCallback(async () => {
    const statusResponse = await fetch("/api/status");
    if (statusResponse.ok) setStatus((await statusResponse.json()) as Status);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const createLesson = useCallback(
    async (draft: Draft) => {
      setBusy(true);
      setError("");
      setTopic(draft.topic);
      setNotes(draft.notes);
      setLevel(LEVELS.includes(draft.level as (typeof LEVELS)[number]) ? draft.level : "high");
      setCustomLevel(LEVELS.includes(draft.level as (typeof LEVELS)[number]) ? "" : draft.level);
      setLevelCustom(!LEVELS.includes(draft.level as (typeof LEVELS)[number]));
      setMinutes(draft.minutes === 5 || draft.minutes === 10 || draft.minutes === 20 ? draft.minutes : 10);
      setCustomMinutes(draft.minutes === 5 || draft.minutes === 10 || draft.minutes === 20 ? "" : String(draft.minutes));
      setTimeCustom(!(draft.minutes === 5 || draft.minutes === 10 || draft.minutes === 20));
      const response = await fetch("/api/lessons/generate", {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify(draft),
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string; lesson?: { id: string } };
      setBusy(false);
      if (!response.ok || !body.lesson) {
        setError(body.error ?? "Lesson generation failed. Try again.");
        draftStarted = false;
        return;
      }
      router.push(`/lessons/${body.lesson.id}`);
    },
    [router],
  );

  useEffect(() => {
    if (loading || !user || started.current || draftStarted) return;
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return;
    let draft: Draft;
    try {
      draft = JSON.parse(raw) as Draft;
    } catch {
      sessionStorage.removeItem(DRAFT_KEY);
      return;
    }
    if (!draft.topic || typeof draft.notes !== "string" || typeof draft.level !== "string" || !Number.isInteger(draft.minutes)) {
      sessionStorage.removeItem(DRAFT_KEY);
      return;
    }
    sessionStorage.removeItem(DRAFT_KEY);
    started.current = true;
    draftStarted = true;
    void createLesson(draft);
  }, [createLesson, loading, user]);

  function submitPrompt() {
    const chosenLevel = (levelCustom ? customLevel : level).trim();
    const chosenMinutes = timeCustom ? Number(customMinutes) : minutes;
    if (topic.trim().length < 2) {
      setError("Add a topic.");
      return;
    }
    if (chosenLevel.length < 2) {
      setError("Add a level.");
      return;
    }
    if (!Number.isInteger(chosenMinutes) || chosenMinutes < 5 || chosenMinutes > 120) {
      setError("Use a length between 5 and 120 minutes.");
      return;
    }
    const draft: Draft = { topic: topic.trim(), level: chosenLevel, minutes: chosenMinutes, notes: notes.trim() };
    if (loading) return;
    if (!user) {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      router.push("/login?next=/create");
      return;
    }
    void createLesson(draft);
  }

  return (
    <div className="mx-auto max-w-4xl px-5 py-16">
      <h1 className="text-center font-display text-5xl tracking-tight sm:text-6xl">What should this lesson teach?</h1>
      <p className="mx-auto mt-4 max-w-xl text-center text-lg text-muted">Describe the topic, then add any notes the planner should follow.</p>
      {status?.storageNote ? <p className="mt-4 text-sm text-muted">{status.storageNote}</p> : null}
      {status && !status.liveModel ? (
        <p className="mt-4 text-sm text-muted">Add an OpenRouter, Backboard, or Gemini API key for live lessons.</p>
      ) : null}
      <form
        className="mx-auto mt-10 grid w-full gap-5 rounded-3xl border border-line bg-paper p-6 shadow-sm sm:p-10"
        onSubmit={(event) => {
          event.preventDefault();
          submitPrompt();
        }}
      >
        <label className="grid gap-2">
          <span className="text-sm text-muted">Topic</span>
          <input
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            placeholder="How enzymes lower activation energy"
            className="rounded-2xl border border-line bg-background px-4 py-3 text-lg outline-none focus:border-accent"
          />
        </label>
        <label className="grid gap-2">
          <span className="text-sm text-muted">Notes</span>
          <textarea
            value={notes}
            onChange={(event) => {
              setNotes(event.target.value);
              const element = event.target;
              element.style.height = "auto";
              element.style.height = `${element.scrollHeight}px`;
            }}
            placeholder="Spend extra time on the chain rule. The class already knows limits."
            rows={3}
            className="resize-none overflow-hidden rounded-2xl border border-line bg-background px-4 py-3 outline-none focus:border-accent"
          />
        </label>
        <fieldset className="flex flex-wrap gap-2">
          <legend className="mb-2 text-sm text-muted">Level</legend>
          {LEVELS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => {
                setLevelCustom(false);
                setLevel(option);
              }}
              className={`rounded-full px-3 py-1 text-sm ${!levelCustom && level === option ? "bg-foreground text-paper" : "border border-line"}`}
            >
              {option === "middle" ? "Middle school" : option === "high" ? "High school" : "University"}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setLevelCustom(true)}
            className={`rounded-full px-3 py-1 text-sm ${levelCustom ? "bg-foreground text-paper" : "border border-line"}`}
          >
            Custom
          </button>
        </fieldset>
        {levelCustom ? (
          <input
            value={customLevel}
            onChange={(event) => setCustomLevel(event.target.value)}
            placeholder="AP Physics 1"
            className="rounded-2xl border border-line bg-background px-4 py-2 outline-none focus:border-accent"
          />
        ) : null}
        <fieldset className="flex flex-wrap gap-2">
          <legend className="mb-2 text-sm text-muted">Suggested length</legend>
          {([5, 10, 20] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => {
                setTimeCustom(false);
                setMinutes(option);
              }}
              className={`rounded-full px-3 py-1 text-sm ${!timeCustom && minutes === option ? "bg-foreground text-paper" : "border border-line"}`}
            >
              {option} min
            </button>
          ))}
          <button
            type="button"
            onClick={() => setTimeCustom(true)}
            className={`rounded-full px-3 py-1 text-sm ${timeCustom ? "bg-foreground text-paper" : "border border-line"}`}
          >
            Custom
          </button>
        </fieldset>
        {timeCustom ? (
          <input
            type="number"
            min={5}
            max={120}
            value={customMinutes}
            onChange={(event) => setCustomMinutes(event.target.value)}
            placeholder="45"
            className="w-32 rounded-2xl border border-line bg-background px-4 py-2 outline-none focus:border-accent"
          />
        ) : null}
        <p className="text-sm text-muted">The planner chooses the real length from your prompt.</p>
        <button type="submit" disabled={busy || loading} className="mt-2 w-fit rounded-full bg-accent px-5 py-2 text-paper disabled:opacity-60">
          {busy ? "Planning the sections…" : "Create lesson"}
        </button>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        {!loading && !user ? <p className="text-sm text-muted">You'll sign in before the lesson is created.</p> : null}
      </form>
    </div>
  );
}
