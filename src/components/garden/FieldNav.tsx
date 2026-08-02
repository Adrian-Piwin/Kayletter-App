"use client";

import { useEffect, useRef } from "react";
import { entrance, INTRO, type IntroPhase } from "@/lib/garden-intro";
import type { CameraController } from "./useCamera";

/**
 * Read-outs for a field wider than the screen: a bar showing how far along the
 * garden you are, and a hint on how to move. Walking is done by swiping the
 * field itself, so there is nothing to click here — the bar updates straight
 * from camera events, keeping panning off React's render path.
 */
export default function FieldNav({
  camera,
  intro,
}: {
  camera: CameraController;
  intro: IntroPhase;
}) {
  const thumb = useRef<HTMLDivElement>(null);

  useEffect(
    () =>
      camera.subscribe(({ x, max }) => {
        if (!thumb.current) return;
        const progress = max > 0 ? x / max : 0;
        thumb.current.style.left = `${progress * 100}%`;
        thumb.current.style.transform = `translateX(${progress * -100}%)`;
      }),
    [camera]
  );

  return (
    <div
      className="pointer-events-none absolute inset-0 z-20"
      style={entrance(intro, "enter-fade", INTRO.controls)}
    >
      {/* how far along the garden you are */}
      <div className="absolute bottom-0 inset-x-0 h-2 bg-ink/40">
        <div ref={thumb} className="absolute top-0 h-full w-[16%] min-w-10 bg-sunflower" />
      </div>

      {/* sits below the header, clear of the status chip and action bar */}
      <p className="absolute top-32 sm:top-24 left-1/2 -translate-x-1/2 whitespace-nowrap bg-cream/90 border-2 border-ink px-2.5 py-1 font-pixel text-[10px] sm:text-xs text-ink [animation:hint-fade_6s_ease-out_forwards]">
        swipe to walk the field ◀ ▶
      </p>
    </div>
  );
}
