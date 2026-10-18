"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { LessonCard } from "./LessonCard";
import { useUser } from "./user";
import type { LessonSummary } from "@/lib/types";

export function LibraryPage() {
  const { user, loading } = useUser();
  const [lessons, setLessons] = useState<LessonSummary[]>([]);
  const [progress, setProgress] = useState<Record<string, string[]>>({});

  const load = useCallback(async () => {
    if (!user) {
      setLessons([]);
      return;
    }
    const response = await fetch("/api/lessons");
    if (!response.ok) return;
    const body = (await response.json()) as { lessons: LessonSummary[]; progress: Record<string, string[]> };
    setLessons(body.lessons);
    setProgress(body.progress);
  }, [user]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <h1 className="font-display text-5xl tracking-tight">Your lessons</h1>
      <p className="mt-3 text-lg text-muted">Everything you have written stays here.</p>
      {loading ? null : user ? (
        lessons.length === 0 ? (
          <p className="mt-8 text-muted">
            Nothing saved yet. <Link href="/create" className="text-accent">Create a lesson</Link> or look through Explore.
          </p>
        ) : (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {lessons.map((lesson) => {
              const done = progress[lesson.id]?.length ?? 0;
              const meta = lesson.stage === "drafting" ? "Still writing" : `${done} of ${lesson.blockCount} checks finished`;
              return <LessonCard key={lesson.id} lesson={lesson} meta={meta} />;
            })}
          </div>
        )
      ) : (
        <p className="mt-8 text-muted">
          <Link href="/login?next=/library" className="text-accent">Log in</Link> to see the lessons on your account.
        </p>
      )}
    </div>
  );
}
