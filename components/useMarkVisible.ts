"use client";

import { useEffect, useRef } from "react";

export function useMarkVisible(onSeen: () => void, enabled: boolean) {
  const ref = useRef<HTMLDivElement | null>(null);
  const seen = useRef(false);

  useEffect(() => {
    const element = ref.current;
    if (!enabled || !element || seen.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting || seen.current) return;
        seen.current = true;
        onSeen();
        observer.disconnect();
      },
      { threshold: 0.5 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [enabled, onSeen]);

  return ref;
}
