import { Suspense } from "react";
import { CoursePage } from "@/components/CoursePage";

export default function Page() {
  return (
    <Suspense fallback={<p className="mx-auto max-w-3xl px-5 py-16 text-muted">Opening course…</p>}>
      <CoursePage />
    </Suspense>
  );
}
