"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ProgressBar } from "./ProgressBar";
import { jsonHeaders, useUser } from "./user";
import type { LessonSummary, Level } from "@/lib/types";

type Status = { liveModel: boolean; storage: "file" | "mongo"; storageNote: string | null };
type Draft = { topic: string; level: Level; minutes: 5 | 10 | 20 };

const DRAFT_KEY = "thinkstack-draft";
let draftStarted = false;

export function HomePage() {
  const router = useRouter();
  const { user, loading } = useUser();
  const [lessons, setLessons] = useState<LessonSummary[]>([]);
  const [progress, setProgress] = useState<Record<string, string[]>>({});
  const [status, setStatus] = useState<Status | null>(null);
  const [topic, setTopic] = useState("");
  const [level, setLevel] = useState<Level>("high");
  const [minutes, setMinutes] = useState<5 | 10 | 20>(10);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const started = useRef(false);

  const load = useCallback(async () => {
    const statusResponse = await fetch("/api/status");
    if (statusResponse.ok) setStatus((await statusResponse.json()) as Status);
    if (!user) {
      setLessons([]);
      setProgress({});
      return;
    }
    const response = await fetch("/api/lessons");
    if (!response.ok) return;
    const body = (await response.json()) as {
      lessons: LessonSummary[];
      progress: Record<string, string[]>;
    };
    setLessons(body.lessons);
    setProgress(body.progress);
  }, [user]);

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
      setLevel(draft.level);
      setMinutes(draft.minutes);
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
    if (!draft.topic || (draft.minutes !== 5 && draft.minutes !== 10 && draft.minutes !== 20)) {
      sessionStorage.removeItem(DRAFT_KEY);
      return;
    }
    sessionStorage.removeItem(DRAFT_KEY);
    started.current = true;
    draftStarted = true;
    void createLesson(draft);
  }, [createLesson, loading, user]);

  function submitPrompt() {
    const draft: Draft = { topic: topic.trim(), level, minutes };
    if (draft.topic.length < 2) {
      setError("Add a topic.");
      return;
    }
    if (loading) return;
    if (!user) {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      router.push("/login?next=/create");
      return;
    }
    void createLesson(draft);
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="font-display text-5xl tracking-tight">What do you want to learn?</h1>
      <p className="mt-3 max-w-xl text-lg text-muted">Describe a topic. Thinkstack writes a lesson you can read, edit, and check.</p>
      {status?.storageNote ? <p className="mt-4 text-sm text-muted">{status.storageNote}</p> : null}
      {status && !status.liveModel ? (
        <p className="mt-4 text-sm text-muted">Add an OpenRouter, Backboard, or Gemini API key for live lessons.</p>
      ) : null}
      <form
        className="mt-8 grid gap-4"
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
            className="border-b border-line bg-transparent py-2 text-xl outline-none focus:border-accent"
          />
        </label>
        <fieldset className="flex flex-wrap gap-2">
          <legend className="mb-2 text-sm text-muted">Level</legend>
          {(["middle", "high", "university"] as Level[]).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setLevel(option)}
              className={`rounded-full px-3 py-1 text-sm ${level === option ? "bg-foreground text-paper" : "border border-line"}`}
            >
              {option === "middle" ? "Middle school" : option === "high" ? "High school" : "University"}
            </button>
          ))}
        </fieldset>
        <fieldset className="flex flex-wrap gap-2">
          <legend className="mb-2 text-sm text-muted">Length</legend>
          {([5, 10, 20] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setMinutes(option)}
              className={`rounded-full px-3 py-1 text-sm ${minutes === option ? "bg-foreground text-paper" : "border border-line"}`}
            >
              {option} min
            </button>
          ))}
        </fieldset>
        <button type="submit" disabled={busy || loading} className="mt-2 w-fit rounded-full bg-accent px-5 py-2 text-paper disabled:opacity-60">
          {busy ? "Writing lesson…" : "Create lesson"}
        </button>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        {!loading && !user ? <p className="text-sm text-muted">You'll sign in before the lesson is created. Public lessons are in Explore.</p> : null}
      </form>
      {user ? (
        <section className="mt-14">
          <h2 className="font-display text-3xl">Your lessons</h2>
          {lessons.length === 0 ? <p className="mt-3 text-muted">Nothing saved yet. Public examples are in Explore.</p> : null}
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {lessons.map((lesson) => (
              <li key={lesson.id}>
                <Link href={`/lessons/${lesson.id}`} className="flex items-center justify-between gap-4 py-4">
                  <span>
                    <span className="block text-lg">{lesson.title}</span>
                    <span className="text-sm text-muted">
                      {lesson.visibility === "public" ? "Public" : "Private"} · {lesson.blockCount} parts
                    </span>
                  </span>
                  <ProgressBar completed={progress[lesson.id]?.length ?? 0} total={lesson.blockCount} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
