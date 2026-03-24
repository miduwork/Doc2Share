"use client";

import { useEffect, useRef } from "react";

const defaultOptions: IntersectionObserverInit = {
  root: null,
  rootMargin: "0px 0px -8% 0px",
  threshold: 0.1,
};

/**
 * Gắn class "is-visible" khi element vào viewport (dùng với .reveal-on-scroll).
 */
export function useRevealOnScroll<T extends HTMLElement>(options?: Partial<IntersectionObserverInit>) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
          }
        });
      },
      { ...defaultOptions, ...options }
    );

    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- options intentionally stable
  }, []);

  return ref;
}

