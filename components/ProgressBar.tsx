import { progressPercent } from "@/lib/document";

export function ProgressBar({ completed, total }: { completed: number; total: number }) {
  const percent = progressPercent(completed, total);
  return (
    <div className="flex items-center gap-3">
      <div className="h-1.5 w-28 overflow-hidden rounded-full bg-line">
        <div className="h-full bg-accent" style={{ width: `${percent}%` }} />
      </div>
      <span className="text-xs text-muted">
        {completed}/{total}
      </span>
    </div>
  );
}
