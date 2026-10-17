"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type LocalUser = { id: string; name: string };

type UserContextValue = {
  user: LocalUser | null;
  setName: (name: string) => void;
};

const UserContext = createContext<UserContextValue>({ user: null, setName: () => undefined });
const STORAGE_KEY = "thinkstack-user";

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<LocalUser | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as LocalUser;
          if (parsed.id && parsed.name) {
            setUser(parsed);
            return;
          }
        } catch {
          localStorage.removeItem(STORAGE_KEY);
        }
      }
      const created = { id: crypto.randomUUID(), name: "Student" };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(created));
      setUser(created);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function setName(name: string) {
    setUser((current) => {
      if (!current) return current;
      const next = { ...current, name: name.slice(0, 40) };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  return <UserContext.Provider value={{ user, setName }}>{children}</UserContext.Provider>;
}

export function useUser() {
  return useContext(UserContext);
}

export function userHeaders(user: LocalUser): HeadersInit {
  return {
    "content-type": "application/json",
    "x-user-id": user.id,
    "x-user-name": encodeURIComponent(user.name || "Student"),
  };
}
