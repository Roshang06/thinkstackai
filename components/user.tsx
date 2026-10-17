"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type SessionUser = { id: string; name: string; email: string };

type UserContextValue = {
  user: SessionUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
};

const UserContext = createContext<UserContextValue>({
  user: null,
  loading: true,
  refresh: async () => undefined,
});

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/auth/session");
    if (!response.ok) {
      setUser(null);
      setLoading(false);
      return;
    }
    const body = (await response.json()) as { user: SessionUser | null };
    setUser(body.user);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  return <UserContext.Provider value={{ user, loading, refresh }}>{children}</UserContext.Provider>;
}

export function useUser() {
  return useContext(UserContext);
}

export function jsonHeaders(): HeadersInit {
  return { "content-type": "application/json" };
}
