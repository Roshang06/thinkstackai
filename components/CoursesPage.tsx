"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { jsonHeaders, useUser } from "./user";
import type { Course } from "@/lib/types";

export function CoursesPage() {
  const router = useRouter();
  const { user, loading } = useUser();
  const [courses, setCourses] = useState<Course[]>([]);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [topics, setTopics] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const response = await fetch("/api/courses");
    if (!response.ok) return;
    const body = (await response.json()) as { courses: Course[] };
    setCourses(body.courses);
  }, [user]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function create() {
    setBusy(true);
    setError("");
    const response = await fetch("/api/courses", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({
        title,
        summary,
        topics: topics.split(",").map((topic) => topic.trim()).filter(Boolean),
      }),
    });
    const body = (await response.json().catch(() => ({}))) as { error?: string; course?: Course };
    setBusy(false);
    if (!response.ok || !body.course) {
      setError(body.error ?? "Could not create the course.");
      return;
    }
    router.push(`/courses/${body.course.id}`);
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-16">
      <h1 className="text-center font-display text-5xl tracking-tight">Courses</h1>
      <p className="mx-auto mt-3 max-w-xl text-center text-muted">
        A course is public, so it shows up in Explore. Only an instructor course can accept students.
      </p>
      {loading ? null : user ? (
        <form
          className="mx-auto mt-10 grid gap-4 rounded-3xl border border-line bg-paper p-6 shadow-sm"
          onSubmit={(event) => {
            event.preventDefault();
            void create();
          }}
        >
          <label className="grid gap-2">
            <span className="text-sm text-muted">Course title</span>
            <input value={title} onChange={(event) => setTitle(event.target.value)} className="rounded-2xl border border-line bg-background px-4 py-3 text-lg outline-none focus:border-accent" />
          </label>
          <label className="grid gap-2">
            <span className="text-sm text-muted">Summary</span>
            <textarea value={summary} onChange={(event) => setSummary(event.target.value)} rows={3} className="rounded-2xl border border-line bg-background px-4 py-3 outline-none focus:border-accent" />
          </label>
          <label className="grid gap-2">
            <span className="text-sm text-muted">Topics, separated by commas</span>
            <input value={topics} onChange={(event) => setTopics(event.target.value)} placeholder="Calculus, limits" className="rounded-2xl border border-line bg-background px-4 py-3 outline-none focus:border-accent" />
          </label>
          <button type="submit" disabled={busy} className="w-fit rounded-full bg-accent px-5 py-2 text-paper disabled:opacity-60">
            {busy ? "Creating…" : "Create course"}
          </button>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
        </form>
      ) : (
        <p className="mt-8 text-center text-muted">
          <Link href="/login?next=/courses" className="text-accent">Log in</Link> to create a course.
        </p>
      )}
      {courses.length > 0 ? (
        <ul className="mt-10 grid gap-3">
          {courses.map((course) => (
            <li key={course.id}>
              <Link href={`/courses/${course.id}`} className="block rounded-3xl border border-line bg-paper p-5 shadow-sm">
                <span className="font-display text-2xl">{course.title}</span>
                <span className="mt-1 block text-sm text-muted">
                  {course.joinable ? "Accepts students" : "Open to view"} · {course.lessonIds.length} lessons
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
