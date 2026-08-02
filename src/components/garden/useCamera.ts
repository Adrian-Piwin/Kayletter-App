"use client";

import { useEffect, useRef, useState } from "react";

export type CameraState = { x: number; max: number };
export type ScrollDirection = -1 | 0 | 1;
type Listener = (state: CameraState) => void;

/** Per-frame velocity decay while a flick coasts to a stop. */
const FRICTION = 0.9;
/** Below this per-frame speed the coast is over. */
const MIN_VELOCITY = 0.1;
/** Share of the remaining distance covered each frame when panning to a target. */
const PAN_EASE = 0.16;
/** Fastest a flick may throw the camera, in px per frame. Kept low so a swipe
 * glides the field along at a walking pace rather than whipping past it. */
const MAX_FLING = 32;
/** Horizontal movement before a press counts as a drag rather than a tap. */
const DRAG_THRESHOLD = 6;
/** Clicks fired this soon after a drag are swallowed. */
const CLICK_BLOCK_MS = 120;
/** Quiet time before the camera counts as stopped. */
const SETTLE_MS = 160;
/** Fraction of a screen covered by one arrow key press. */
const PAN_STEP = 0.7;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * Camera position lives outside React so scrolling never re-renders the field —
 * layers subscribe and write their own transforms. Only coarse changes (which
 * way the pig should face) are pushed back up as state.
 */
function createCamera() {
  const listeners = new Set<Listener>();
  let x = 0;
  let max = 0;
  let viewport = 0;
  let velocity = 0;
  let target: number | null = null;
  let frame = 0;
  let direction: ScrollDirection = 0;
  let settleTimer: ReturnType<typeof setTimeout> | undefined;
  let blockClicksUntil = 0;
  let dragging = false;
  let reduceMotion = false;
  let notifyDirection: (dir: ScrollDirection) => void = () => {};

  const emit = () => {
    const state: CameraState = { x, max };
    listeners.forEach((fn) => fn(state));
  };

  const setDirection = (next: ScrollDirection) => {
    clearTimeout(settleTimer);
    if (next !== 0) settleTimer = setTimeout(() => setDirection(0), SETTLE_MS);
    if (next === direction) return;
    direction = next;
    notifyDirection(next);
  };

  /** Returns false when the camera is already against that end of the world. */
  const moveTo = (next: number) => {
    const clamped = clamp(next, 0, max);
    if (clamped === x) return false;
    setDirection(clamped > x ? 1 : -1);
    x = clamped;
    emit();
    return true;
  };

  const run = () => {
    if (!frame) frame = requestAnimationFrame(step);
  };

  function step() {
    frame = 0;
    let moving = false;
    if (target !== null) {
      const remaining = target - x;
      if (Math.abs(remaining) < 0.5) {
        moveTo(target);
        target = null;
      } else {
        moving = moveTo(x + remaining * PAN_EASE);
        if (!moving) target = null;
      }
    } else if (Math.abs(velocity) > MIN_VELOCITY) {
      moving = moveTo(x + velocity);
      velocity = moving ? velocity * FRICTION : 0;
    }
    if (moving) run();
  }

  const stop = () => {
    velocity = 0;
    target = null;
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
  };

  const panTo = (next: number) => {
    velocity = 0;
    if (reduceMotion) {
      target = null;
      moveTo(next);
      return;
    }
    target = clamp(next, 0, max);
    run();
  };

  return {
    subscribe(fn: Listener) {
      listeners.add(fn);
      fn({ x, max });
      return () => {
        listeners.delete(fn);
      };
    },
    /** World size, derived from how many screens of field there are to walk. */
    resize(screens: number, viewportWidth: number) {
      viewport = viewportWidth;
      max = Math.max(0, (screens - 1) * viewportWidth);
      if (x > max) x = max;
      emit();
    },
    onDirection(fn: (dir: ScrollDirection) => void) {
      notifyDirection = fn;
    },
    setReduceMotion(value: boolean) {
      reduceMotion = value;
    },
    /** Immediate, un-eased movement — for wheels and drags that drive it directly. */
    nudge(dx: number) {
      stop();
      moveTo(x + dx);
    },
    fling(perFrameVelocity: number) {
      target = null;
      velocity = clamp(perFrameVelocity, -MAX_FLING, MAX_FLING);
      run();
    },
    panBy(dx: number) {
      panTo((target ?? x) + dx);
    },
    panScreens(screens: number) {
      panTo((target ?? x) + screens * viewport * PAN_STEP);
    },
    panToEnd() {
      panTo(max);
    },
    /**
     * Centres a point given as a percentage across a parallax band — used when
     * keyboard focus lands on a flower that is currently off screen.
     */
    revealAt(pct: number, widthScreens: number, factor: number) {
      const positionInBand = (pct / 100) * widthScreens * viewport;
      panTo((positionInBand - viewport / 2) / factor);
    },
    stop,
    setDragging(value: boolean) {
      dragging = value;
      if (!value) blockClicksUntil = performance.now() + CLICK_BLOCK_MS;
    },
    /** True while dragging, and briefly after, so a drag never opens a letter. */
    suppressClick() {
      return dragging || performance.now() < blockClicksUntil;
    },
    state: (): CameraState => ({ x, max }),
  };
}

export type CameraController = ReturnType<typeof createCamera>;

/**
 * Wires pointer, wheel and keyboard input on `surfaceRef` to a camera whose
 * world is `screens` viewports wide.
 */
export function useCamera({
  screens,
  viewportWidth,
  enabled,
  onDirection,
}: {
  screens: number;
  viewportWidth: number;
  enabled: boolean;
  onDirection: (dir: ScrollDirection) => void;
}) {
  // One camera for the lifetime of the scene; state gives us a stable instance
  // without reading a ref during render.
  const [camera] = useState(createCamera);
  const surfaceRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => camera.onDirection(onDirection), [camera, onDirection]);
  useEffect(() => camera.resize(screens, viewportWidth), [camera, screens, viewportWidth]);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => camera.setReduceMotion(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, [camera]);

  useEffect(() => {
    const el = surfaceRef.current;
    if (!el || !enabled) return;

    const onWheel = (e: WheelEvent) => {
      // Nothing on this page scrolls vertically, so a plain wheel walks the field.
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (!delta) return;
      e.preventDefault();
      camera.nudge(delta);
    };

    let pointerId: number | null = null;
    let startX = 0;
    let lastX = 0;
    let lastTime = 0;
    let velocity = 0;
    let dragging = false;

    const onPointerDown = (e: PointerEvent) => {
      if (pointerId !== null || (e.pointerType === "mouse" && e.button !== 0)) return;
      pointerId = e.pointerId;
      startX = lastX = e.clientX;
      lastTime = e.timeStamp;
      velocity = 0;
      camera.stop();
    };

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      if (!dragging) {
        if (Math.abs(e.clientX - startX) < DRAG_THRESHOLD) return;
        dragging = true;
        camera.setDragging(true);
        el.setPointerCapture(e.pointerId);
      }
      const dx = e.clientX - lastX;
      const elapsed = Math.max(1, e.timeStamp - lastTime);
      lastX = e.clientX;
      lastTime = e.timeStamp;
      // Grabbing the world: it follows the finger, so the camera goes the other way.
      camera.nudge(-dx);
      velocity = (-dx * 16) / elapsed;
    };

    const onPointerUp = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      pointerId = null;
      if (!dragging) return;
      dragging = false;
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
      camera.setDragging(false);
      camera.fling(velocity);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if ((e.target as HTMLElement | null)?.closest("input, textarea, [contenteditable]")) return;
      const step = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0;
      if (!step) return;
      e.preventDefault();
      camera.panScreens(step);
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", onPointerUp);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerUp);
      window.removeEventListener("keydown", onKeyDown);
      camera.stop();
    };
  }, [camera, enabled]);

  return { camera, surfaceRef };
}
