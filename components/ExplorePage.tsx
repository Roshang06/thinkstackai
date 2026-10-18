"use client";

import { useEffect, useState } from "react";
import { LessonCard } from "./LessonCard";
import type { LessonSummary } from "@/lib/types";

export function ExplorePage() {
  const [query, setQuery] = useState("");
  const [instructor, setInstructor] = useState("");
  const [institution, setInstitution] = useState("");
  const [lessons, setLessons] = useState<LessonSummary[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (instructor.trim()) params.set("instructor", instructor.trim());
      if (institution.trim()) params.set("institution", institution.trim());
      const search = params.toString();
      void fetch(search ? `/api/explore?${search}` : "/api/explore")
        .then((response) => response.json())
        .then((body: { lessons: LessonSummary[] }) => {
          setLessons(body.lessons ?? []);
          setLoaded(true);
        });
    }, 200);
    return () => window.clearTimeout(timer);
  }, [institution, instructor, query]);

  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <h1 className="font-display text-5xl tracking-tight">Explore</h1>
      <p className="mt-3 max-w-2xl text-lg text-muted">Lessons and courses from instructors and students. Open one, then remix it if you want a copy.</p>
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search lessons, topics, or people"
        className="mt-8 w-full rounded-full border border-line bg-paper px-5 py-3 text-lg shadow-sm outline-none focus:border-accent"
      />
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <input
          value={instructor}
          onChange={(event) => setInstructor(event.target.value)}
          placeholder="Instructor"
          className="rounded-full border border-line bg-paper px-5 py-2 outline-none focus:border-accent"
        />
        <input
          value={institution}
          onChange={(event) => setInstitution(event.target.value)}
          placeholder="Institution"
          className="rounded-full border border-line bg-paper px-5 py-2 outline-none focus:border-accent"
        />
      </div>
      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {lessons.map((lesson) => (
          <LessonCard key={lesson.id} lesson={lesson} />
        ))}
      </div>
      {loaded && lessons.length === 0 ? <p className="mt-8 text-muted">No public lessons match that search.</p> : null}
    </div>
  );
}
