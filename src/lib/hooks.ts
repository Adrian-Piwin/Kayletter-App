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

/**
 * Live width of an element in px. Stays at `fallback` until the element is
 * measured, so server and first client render agree before it corrects.
 */
export function useElementWidth(ref: RefObject<HTMLElement | null>, fallback: number) {
  const [width, setWidth] = useState(fallback);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);

  return width;
}
