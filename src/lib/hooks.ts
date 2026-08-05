"use client";

import { useCallback, useEffect, useState, useSyncExternalStore, type RefObject } from "react";

// window.location.origin never changes, so subscribing is a no-op; this just
// gives us "" during SSR and the real origin after hydration without a
// mismatch or an extra effect.
const subscribeNever = () => () => {};

/** The browser origin, or "" while rendering on the server. */
export function useOrigin() {
  return useSyncExternalStore(
    subscribeNever,
    () => window.location.origin,
    () => ""
  );
}

/**
 * Matches a CSS media query. Used only for things CSS can't express (e.g. how
 * many sprites to render); prefer Tailwind breakpoints for pure styling.
 * Renders as "no match" on the server, then corrects on hydration.
 */
export function useMediaQuery(query: string) {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    [query]
  );

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false
  );
}

/** Tailwind's `sm` breakpoint, for the JS side of responsive behaviour. */
export const useIsMobile = () => useMediaQuery("(max-width: 639px)");

/** For motion CSS can't tone down on its own, such as scripted animation. */
export const usePrefersReducedMotion = () => useMediaQuery("(prefers-reduced-motion: reduce)");

export type Size = { width: number; height: number };

/**
 * Live size of an element in px. Stays at `fallback` until the element is
 * measured, so server and first client render agree before it corrects.
 */
export function useElementSize(ref: RefObject<HTMLElement | null>, fallback: Size) {
  const [size, setSize] = useState(fallback);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      // Kept identical when nothing moved: a fresh object on every observation
      // would have anything measuring off this re-run for no reason.
      setSize((prev) =>
        prev.width === width && prev.height === height ? prev : { width, height }
      );
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);

  return size;
}
