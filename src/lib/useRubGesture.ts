"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Pixels of pointer travel across the target before a rub counts. */
const TRAVEL_PX = 44;
/** Back-and-forth changes of direction required, so merely crossing the target
 *  on the way somewhere else never reads as petting. */
const REVERSALS = 2;
/** Direction changes smaller than this are pointer jitter, not a stroke. */
const JITTER_PX = 2;
/** Quiet time before an in-progress rub is considered finished. */
const QUIET_MS = 420;

type Options = {
  /** When false the gesture is inert — no tracking, no callbacks. */
  enabled: boolean;
  onStart?: () => void;
  onEnd?: () => void;
};

/**
 * Recognises a "rub": stroking back and forth over an element.
 *
 * A mouse rubs by hovering — no button held — because that is what reads as
 * stroking with a cursor. Touch and pen have no hover, so they rub by holding
 * and dragging. Either way it takes both distance and a couple of direction
 * changes to trigger, which keeps a pointer passing over the element quiet.
 *
 * The element must also opt out of any ancestor drag handling (see NO_PAN_ATTR),
 * or the ancestor will capture the pointer mid-stroke.
 */
export function useRubGesture({ enabled, onStart, onEnd }: Options) {
  const [rubbing, setRubbing] = useState(false);

  const travel = useRef(0);
  const reversals = useRef(0);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const lastSign = useRef(0);
  const contact = useRef(false);
  const active = useRef(false);
  /** Set while a stroke is in progress so a click can be told from a rub. */
  const strokedRef = useRef(false);
  const quiet = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearQuiet = () => {
    if (quiet.current) {
      clearTimeout(quiet.current);
      quiet.current = null;
    }
  };

  const reset = useCallback(() => {
    travel.current = 0;
    reversals.current = 0;
    lastPoint.current = null;
    lastSign.current = 0;
  }, []);

  const end = useCallback(() => {
    clearQuiet();
    reset();
    if (!active.current) return;
    active.current = false;
    setRubbing(false);
    onEnd?.();
  }, [onEnd, reset]);

  useEffect(() => {
    if (!enabled && active.current) end();
  }, [enabled, end]);

  useEffect(() => () => clearQuiet(), []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    contact.current = true;
    // A press is the start of a fresh stroke, not a continuation of a hover.
    lastPoint.current = { x: e.clientX, y: e.clientY };
    travel.current = 0;
    reversals.current = 0;
    lastSign.current = 0;
    strokedRef.current = false;
  }, []);

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!enabled) return;
      // Only a mouse can rub without touching down; touch needs contact.
      if (e.pointerType !== "mouse" && !contact.current) return;

      const point = { x: e.clientX, y: e.clientY };
      const previous = lastPoint.current;
      lastPoint.current = point;
      if (!previous) return;

      const dx = point.x - previous.x;
      travel.current += Math.hypot(dx, point.y - previous.y);

      if (Math.abs(dx) > JITTER_PX) {
        const sign = Math.sign(dx);
        if (lastSign.current !== 0 && sign !== lastSign.current) reversals.current += 1;
        lastSign.current = sign;
      }

      if (!active.current && travel.current >= TRAVEL_PX && reversals.current >= REVERSALS) {
        active.current = true;
        strokedRef.current = true;
        setRubbing(true);
        onStart?.();
      }

      // Any movement keeps the rub alive; going still ends it.
      clearQuiet();
      quiet.current = setTimeout(active.current ? end : reset, QUIET_MS);
    },
    [enabled, onStart, end, reset]
  );

  const onPointerUp = useCallback(() => {
    contact.current = false;
    if (active.current) end();
    else reset();
  }, [end, reset]);

  const onPointerLeave = useCallback(() => {
    contact.current = false;
    if (active.current) end();
    else reset();
  }, [end, reset]);

  const consumeStroke = useCallback(() => {
    const stroked = strokedRef.current;
    strokedRef.current = false;
    return stroked;
  }, []);

  return {
    rubbing,
    /** True if a stroke happened since it was last checked, and clears it — a
     *  click that follows a rub should be swallowed, not treated as a tap. */
    consumeStroke,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
      onPointerLeave,
    },
  };
}
