"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { LessonSummary } from "@/lib/types";

export function ExplorePage() {
  const [query, setQuery] = useState("");
  const [lessons, setLessons] = useState<LessonSummary[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const url = query.trim() ? `/api/explore?q=${encodeURIComponent(query.trim())}` : "/api/explore";
      void fetch(url)
        .then((response) => response.json())
        .then((body: { lessons: LessonSummary[] }) => {
          setLessons(body.lessons);
          setLoaded(true);
        });
    }, 200);
    return () => window.clearTimeout(timer);
  }, [query]);

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="font-display text-5xl tracking-tight">Explore</h1>
      <p className="mt-3 text-lg text-muted">Public lessons from this app. Open one, then remix it to make it yours.</p>
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search topics"
        className="mt-8 w-full border-b border-line bg-transparent py-2 text-xl outline-none focus:border-accent"
      />
      <ul className="mt-6 divide-y divide-line border-y border-line">
        {lessons.map((lesson) => (
          <li key={lesson.id}>
            <Link href={`/lessons/${lesson.id}`} className="block py-4">
              <span className="block text-lg">{lesson.title}</span>
              <span className="text-sm text-muted">
                {lesson.ownerName} · {lesson.summary}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {loaded && lessons.length === 0 ? <p className="mt-4 text-muted">No public lessons match that search.</p> : null}
    </div>
  );
}
