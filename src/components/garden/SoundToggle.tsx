"use client";

import { useSyncExternalStore, type CSSProperties } from "react";
import { isMuted, mutedOnServer, subscribeMuted, toggleMuted } from "@/lib/sound";

/**
 * Quiets the whole garden. Worth a control of its own now the reveal has a
 * sequence rather than a blip: a letter is as likely to be opened at a desk as
 * on a sofa, and the preference is remembered across visits.
 */
export default function SoundToggle({ style }: { style?: CSSProperties }) {
  const muted = useSyncExternalStore(subscribeMuted, isMuted, mutedOnServer);

  return (
    <button
      onClick={toggleMuted}
      style={style}
      className="pointer-events-auto min-h-11 px-2.5 bg-cream/90 border-2 border-ink shadow-[3px_3px_0_0_var(--ink)] font-pixel text-xs sm:text-sm text-ink hover:bg-cream cursor-pointer touch-manipulation"
      aria-label={muted ? "turn sound on" : "turn sound off"}
      title={muted ? "sound off" : "sound on"}
    >
      {muted ? "🔇" : "🔊"}
    </button>
  );
}
