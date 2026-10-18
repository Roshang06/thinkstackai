"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useUser } from "./user";

export function AppHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading, refresh } = useUser();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    await refresh();
    router.push("/");
  }

  return (
    <header className="border-b border-line bg-paper/80">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-5 py-3">
        <Link href="/" className="font-display text-2xl tracking-tight text-foreground">
          Thinkstack
        </Link>
        <nav className="flex gap-4 text-sm text-muted">
          <Link href="/create" className={pathname === "/create" ? "text-foreground" : "hover:text-foreground"}>
            Create lesson
          </Link>
          <Link href="/explore" className={pathname === "/explore" ? "text-foreground" : "hover:text-foreground"}>
            Explore
          </Link>
        </nav>
        <div className="ml-auto flex items-center gap-4 text-sm">
          {loading ? null : user ? (
            <>
              <span className="text-muted">{user.name}</span>
              <button type="button" onClick={() => void logout()} className="text-muted hover:text-foreground">
                Log out
              </button>
            </>
          ) : (
            <Link href="/login" className="rounded-full bg-foreground px-3 py-1 text-paper">
              Log in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
