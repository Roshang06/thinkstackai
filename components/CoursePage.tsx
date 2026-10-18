"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { jsonHeaders, useUser } from "./user";
import type { Course, Enrollment, LessonSummary } from "@/lib/types";

type Membership = "owner" | "member" | "requested" | "visitor";

export function CoursePage() {
  const params = useParams<{ id: string }>();
  const courseId = params.id;
  const { user } = useUser();
  const [course, setCourse] = useState<Course | null>(null);
  const [lessons, setLessons] = useState<LessonSummary[]>([]);
  const [roster, setRoster] = useState<Enrollment[]>([]);
  const [classmates, setClassmates] = useState<Enrollment[]>([]);
  const [mine, setMine] = useState<LessonSummary[]>([]);
  const [membership, setMembership] = useState<Membership>("visitor");
  const [lessonId, setLessonId] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const response = await fetch(`/api/courses/${courseId}`);
    if (!response.ok) {
      setError("Course not found.");
      return;
    }
    const body = (await response.json()) as { course: Course; lessons: LessonSummary[]; roster: Enrollment[]; classmates?: Enrollment[]; membership: Membership };
    setCourse(body.course);
    setLessons(body.lessons);
    setRoster(body.roster);
    setClassmates(body.classmates ?? []);
    setMembership(body.membership);
    setError("");
  }, [courseId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (membership !== "owner") return;
    void fetch("/api/lessons")
      .then((response) => response.json())
      .then((body: { lessons?: LessonSummary[] }) => setMine(body.lessons ?? []));
  }, [membership]);

  async function change(patch: { addLessonId?: string; removeLessonId?: string }) {
    const response = await fetch(`/api/courses/${courseId}`, { method: "PATCH", headers: jsonHeaders(), body: JSON.stringify(patch) });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? "Could not update the course.");
      return;
    }
    await load();
  }

  async function join() {
    const response = await fetch(`/api/courses/${courseId}/join`, { method: "POST" });
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      setError(body.error ?? "Could not request to join.");
      return;
    }
    await load();
  }

  async function decide(userId: string, action: "member" | "remove") {
    await fetch(`/api/courses/${courseId}/roster`, { method: "POST", headers: jsonHeaders(), body: JSON.stringify({ userId, action }) });
    await load();
  }

  async function leave() {
    if (!window.confirm("Leaving cannot be undone. You will need to request to join and be approved again.")) return;
    await fetch(`/api/courses/${courseId}/roster`, { method: "POST", headers: jsonHeaders(), body: JSON.stringify({ action: "leave" }) });
    setClassmates([]);
    await load();
  }

  if (!course) return <p className="mx-auto max-w-3xl px-5 py-16 text-muted">{error || "Opening course…"}</p>;
  const requests = roster.filter((row) => row.status === "requested");
  const members = roster.filter((row) => row.status === "member");

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <p className="text-sm uppercase tracking-[0.14em] text-accent">{course.joinable ? "Instructor course" : "Course"}</p>
      <h1 className="mt-2 font-display text-5xl tracking-tight">{course.title}</h1>
      <p className="mt-3 text-muted">
        {course.ownerName}
        {course.institution ? ` · ${course.institution}` : ""}
      </p>
      {course.summary ? <p className="mt-4 text-lg">{course.summary}</p> : null}
      {course.topics.length > 0 ? <p className="mt-2 text-sm text-muted">{course.topics.join(" · ")}</p> : null}
      {membership === "visitor" && course.joinable ? (
        user ? (
          <button type="button" onClick={() => void join()} className="mt-6 rounded-full bg-accent px-5 py-2 text-paper">
            Request to join
          </button>
        ) : (
          <Link href={`/login?next=/courses/${course.id}`} className="mt-6 inline-block rounded-full bg-accent px-5 py-2 text-paper">
            Log in to request a seat
          </Link>
        )
      ) : null}
      {membership === "requested" ? <p className="mt-6 text-muted">Your request is waiting for the instructor.</p> : null}
      {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}
      <section className="mt-10">
        <h2 className="font-display text-3xl">Lessons</h2>
        <ul className="mt-4 grid gap-3">
          {lessons.map((lesson) => (
            <li key={lesson.id} className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-paper px-4 py-3">
              <Link href={`/lessons/${lesson.id}`} className="text-lg">
                {lesson.title}
              </Link>
              {membership === "owner" ? (
                <button type="button" onClick={() => void change({ removeLessonId: lesson.id })} className="text-sm text-danger">
                  Remove
                </button>
              ) : null}
            </li>
          ))}
        </ul>
        {lessons.length === 0 ? <p className="mt-3 text-muted">No lessons yet.</p> : null}
        {membership === "owner" ? (
          <form
            className="mt-4 flex flex-wrap gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (lessonId) void change({ addLessonId: lessonId });
            }}
          >
            <select value={lessonId} onChange={(event) => setLessonId(event.target.value)} className="rounded-full border border-line bg-paper px-4 py-2">
              <option value="">Choose one of your lessons</option>
              {mine.map((lesson) => (
                <option key={lesson.id} value={lesson.id}>
                  {lesson.title}
                </option>
              ))}
            </select>
            <button type="submit" className="rounded-full bg-foreground px-4 py-2 text-sm text-paper">
              Add lesson
            </button>
          </form>
        ) : null}
      </section>
      {membership === "owner" && course.joinable ? (
        <section className="mt-10 grid gap-6 sm:grid-cols-2">
          <div>
            <h2 className="font-display text-3xl">Requests</h2>
            {requests.length === 0 ? <p className="mt-3 text-muted">No one is waiting.</p> : null}
            <ul className="mt-3 grid gap-2">
              {requests.map((row) => (
                <li key={row.userId} className="flex items-center justify-between rounded-2xl border border-line px-3 py-2">
                  <span>{row.userName}</span>
                  <button type="button" onClick={() => void decide(row.userId, "member")} className="text-sm text-accent">
                    Approve
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="font-display text-3xl">Students</h2>
            {members.length === 0 ? <p className="mt-3 text-muted">No students yet.</p> : null}
            <ul className="mt-3 grid gap-2">
              {members.map((row) => (
                <li key={row.userId} className="flex items-center justify-between rounded-2xl border border-line px-3 py-2">
                  <span>{row.userName}</span>
                  <button type="button" onClick={() => void decide(row.userId, "remove")} className="text-sm text-danger">
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}
      {membership === "member" ? (
        <section className="mt-10">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-3xl">Students</h2>
            <button type="button" onClick={() => void leave()} className="text-sm text-danger">
              Leave
            </button>
          </div>
          <ul className="mt-3 grid gap-2">
            {classmates.map((row) => (
              <li key={row.userId} className="rounded-2xl border border-line px-3 py-2">
                {row.userName}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
