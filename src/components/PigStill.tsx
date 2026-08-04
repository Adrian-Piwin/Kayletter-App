"use client";

import SpriteSheet from "@/components/SpriteSheet";
import { PIG_CLIPS, type PigClip } from "@/lib/pig-anim.generated";

/** Static pose from the pig atlas for landing / 404 / dashboard cards. */
export default function PigStill({
  clip = "idle_breathe",
  alt,
  height,
  flip,
  className,
}: {
  clip?: PigClip | (string & {});
  alt: string;
  height: number;
  flip?: boolean;
  className?: string;
}) {
  const def = (clip in PIG_CLIPS ? PIG_CLIPS[clip as PigClip] : PIG_CLIPS.idle_breathe);
  return (
    <SpriteSheet
      frame={def.start}
      alt={alt}
      height={height}
      flip={flip}
      className={className}
    />
  );
}
