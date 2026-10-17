"use client";

import Link from "next/link";
import { useUser } from "./user";

export function AppHeader() {
  const { user, setName } = useUser();

  return (
    <header className="border-b border-line bg-paper/80">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-5 py-3">
        <Link href="/" className="font-display text-2xl tracking-tight text-foreground">
          Thinkstack
        </Link>
        <nav className="flex gap-4 text-sm text-muted">
          <Link href="/" className="hover:text-foreground">
            Lessons
          </Link>
          <Link href="/explore" className="hover:text-foreground">
            Explore
          </Link>
        </nav>
        <label className="ml-auto flex items-center gap-2 text-sm text-muted">
          Name
          <input
            aria-label="Display name"
            value={user?.name ?? ""}
            disabled={!user}
            onChange={(event) => setName(event.target.value)}
            className="w-32 border-b border-line bg-transparent px-1 py-0.5 text-foreground outline-none focus:border-accent"
          />
        </label>
      </div>
    </header>
  );
}
