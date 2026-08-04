"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { PIG_CLIPS, type PigClip } from "@/lib/pig-anim.generated";

type Options = {
  /** Multiplier on the clip's per-frame ms. */
  speed?: number;
  /** Hold a representative frame when the user prefers reduced motion. */
  reducedMotion?: boolean;
  onComplete?: () => void;
};

/**
 * Steps through a named pig clip. Honours `visibilitychange` (pauses when the
 * tab is hidden) and `prefers-reduced-motion` (holds the first frame — the
 * global CSS rule can't reach JS steppers).
 */
export function useSpriteAnimation(clip: PigClip, options: Options = {}) {
  const def = PIG_CLIPS[clip];
  // The playhead is stored with the clip it belongs to, so switching clips
  // restarts from frame 0 during the same render instead of flashing the old
  // clip's frame index for one paint.
  const [playhead, setPlayhead] = useState({ clip, index: 0 });
  if (playhead.clip !== clip) setPlayhead({ clip, index: 0 });
  const index = playhead.clip === clip ? playhead.index : 0;
  const onComplete = useEffectEvent(() => options.onComplete?.());

  useEffect(() => {
    if (!def || def.frames <= 1) return;
    if (options.reducedMotion) return;

    const ms = Math.max(16, Math.round(def.ms / (options.speed ?? 1)));
    let i = 0;
    let timer: ReturnType<typeof setInterval> | undefined;
    const show = (frame: number) => setPlayhead({ clip, index: frame });

    const tick = () => {
      i += 1;
      if (i >= def.frames) {
        if (def.loop) {
          i = 0;
          show(0);
        } else {
          i = def.frames - 1;
          show(i);
          if (timer) clearInterval(timer);
          onComplete();
        }
        return;
      }
      show(i);
    };

    const start = () => {
      if (timer) return;
      timer = setInterval(tick, ms);
    };
    const stop = () => {
      if (!timer) return;
      clearInterval(timer);
      timer = undefined;
    };

    const onVis = () => {
      if (document.hidden) stop();
      else start();
    };

    start();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [clip, def, options.reducedMotion, options.speed]);

  if (!def) return { frame: 0, index: 0 };
  return { frame: def.start + index, index };
}
