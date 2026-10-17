"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ProgressBar } from "./ProgressBar";
import { useUser, userHeaders } from "./user";
import type { LessonSummary, Level } from "@/lib/types";

type Status = { liveModel: boolean; storage: "file" | "mongo"; storageNote: string | null };

export function HomePage() {
  const router = useRouter();
  const { user } = useUser();
  const [lessons, setLessons] = useState<LessonSummary[]>([]);
  const [progress, setProgress] = useState<Record<string, string[]>>({});
  const [status, setStatus] = useState<Status | null>(null);
  const [topic, setTopic] = useState("Fourier transform");
  const [level, setLevel] = useState<Level>("high");
  const [minutes, setMinutes] = useState<5 | 10 | 20>(10);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!user) return;
    const response = await fetch("/api/lessons", { headers: userHeaders(user) });
    if (!response.ok) return;
    const body = (await response.json()) as {
      lessons: LessonSummary[];
      progress: Record<string, string[]>;
      liveModel: boolean;
      storage: "file" | "mongo";
      storageNote: string | null;
    };
    setLessons(body.lessons);
    setProgress(body.progress);
    setStatus({ liveModel: body.liveModel, storage: body.storage, storageNote: body.storageNote });
  }, [user]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function createLesson() {
    if (!user) return;
    setBusy(true);
    setError("");
    const response = await fetch("/api/lessons/generate", {
      method: "POST",
      headers: userHeaders(user),
      body: JSON.stringify({ topic, level, minutes }),
    });
    setBusy(false);
    if (!response.ok) {
      setError("Could not create the lesson.");
      return;
    }
    const body = (await response.json()) as { lesson: { id: string } };
    router.push(`/lessons/${body.lesson.id}`);
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="font-display text-5xl tracking-tight">What do you want to learn?</h1>
      <p className="mt-3 max-w-xl text-lg text-muted">Describe a topic. Thinkstack writes a lesson you can read, edit, and check.</p>
      {status?.storageNote ? <p className="mt-4 text-sm text-muted">{status.storageNote}</p> : null}
      {status && !status.liveModel ? (
        <p className="mt-4 text-sm text-muted">Add GOOGLE_GENERATIVE_AI_API_KEY for live lessons.</p>
      ) : null}
      {status?.liveModel && status.storage === "mongo" ? (
        <p className="mt-4 text-sm text-muted">Gemini is connected. Lessons are saved in MongoDB.</p>
      ) : null}
      <form
        className="mt-8 grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void createLesson();
        }}
      >
        <label className="grid gap-2">
          <span className="text-sm text-muted">Topic</span>
          <input
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
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
        <button type="submit" disabled={busy || !user} className="mt-2 w-fit rounded-full bg-accent px-5 py-2 text-paper disabled:opacity-60">
          {busy ? "Writing lesson…" : "Create lesson"}
        </button>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
      </form>
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
    </div>
  );
}
