import { Suspense } from "react";
import { LessonStudio } from "@/components/LessonStudio";

export default function Page() {
  return (
    <Suspense fallback={<p className="mx-auto max-w-3xl px-5 py-16 text-muted">Opening lesson…</p>}>
      <LessonStudio />
    </Suspense>
  );
}
