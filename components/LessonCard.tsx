import Link from "next/link";
import type { LessonSummary } from "@/lib/types";

const PALETTE = ["#0f6b62", "#1d4e89", "#8d3b32", "#6b4c2a", "#3d4a3a", "#5c3d6e"];

function hash(value: string): number {
  let total = 0;
  for (let index = 0; index < value.length; index += 1) total = (total * 33 + value.charCodeAt(index)) >>> 0;
  return total;
}

export function LessonCover({ title, topic }: { title: string; topic: string }) {
  const seed = hash(`${title} ${topic}`);
  const color = PALETTE[seed % PALETTE.length];
  const letter = (title.trim()[0] ?? "T").toUpperCase();
  return (
    <svg viewBox="0 0 320 180" className="h-40 w-full" role="img" aria-label="">
      <rect width="320" height="180" fill={color} />
      <circle cx={40 + (seed % 80)} cy={30 + ((seed >> 3) % 50)} r={70} fill="#faf7f2" opacity="0.16" />
      <circle cx={260 - (seed % 40)} cy={150} r={90} fill="#1d1915" opacity="0.18" />
      <rect x={180} y={24} width={110} height={14} rx="7" fill="#faf7f2" opacity="0.35" />
      <text x="28" y="118" fill="#faf7f2" fontSize="72" fontFamily="Georgia, serif">
        {letter}
      </text>
    </svg>
  );
}

export function LessonCard({ lesson, meta }: { lesson: LessonSummary; meta?: string }) {
  return (
    <Link href={`/lessons/${lesson.id}`} className="overflow-hidden rounded-3xl border border-line bg-paper shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <LessonCover title={lesson.title} topic={lesson.topic} />
      <div className="grid gap-2 p-5">
        <h2 className="font-display text-2xl tracking-tight">{lesson.title}</h2>
        <p className="text-sm text-muted">{lesson.ownerName}</p>
        <p className="text-sm text-muted">{lesson.tags.length > 0 ? lesson.tags.join(" · ") : lesson.topic}</p>
        {meta ? <p className="text-sm text-accent">{meta}</p> : null}
      </div>
    </Link>
  );
}
