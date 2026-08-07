"use client";

import { useMemo } from "react";
import { REVEAL } from "@/lib/letter-reveal";
import type { Note } from "@/lib/types";

/**
 * Longest the words may take to finish arriving. Without a ceiling a long
 * letter would still be writing itself on well after the reader started
 * reading it, so the stagger is squeezed to fit rather than paid per word.
 */
const WRITE_ON_MS = 900;
/** Pace for a short note, before that ceiling starts compressing it. */
const WRITE_ON_PER_WORD = 45;

/**
 * Splits into words while keeping the whitespace between them, so the note's
 * own line breaks survive `whitespace-pre-wrap`. Only the words are animated —
 * spaces have nothing to fade.
 */
function writeOn(content: string) {
  const tokens = content.split(/(\s+)/);
  const words = tokens.filter((t) => t.trim().length > 0).length;
  const total = Math.min(WRITE_ON_MS, words * WRITE_ON_PER_WORD);
  let seen = 0;
  return tokens.map((token) => {
    if (!token.trim()) return { token, delay: null };
    const delay = words > 1 ? (seen / (words - 1)) * total : 0;
    seen += 1;
    return { token, delay };
  });
}

/** The opened letter: pixel paper with the note text and a favorite toggle. */
export default function LetterModal({
  note,
  onClose,
  onToggleFavorite,
  ceremonial = false,
  closing = false,
}: {
  note: Note;
  onClose: () => void;
  onToggleFavorite: (note: Note) => void;
  /** Freshly unlocked: unfolds like paper and writes itself on. */
  ceremonial?: boolean;
  /** Folding away at the end of the ceremony. */
  closing?: boolean;
}) {
  const readDate = note.read_at
    ? new Date(note.read_at).toLocaleDateString(undefined, {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  const parts = useMemo(
    () => (ceremonial ? writeOn(note.content) : null),
    [ceremonial, note.content]
  );

  return (
    <div
      className={`fixed inset-0 z-40 flex items-center justify-center p-4 ${
        // During the ceremony the reveal overlay behind this owns the dimming,
        // so a second scrim here would double it and then flash on the handover.
        ceremonial ? "" : "bg-ink/50"
      }`}
      onClick={closing ? undefined : onClose}
      role="dialog"
      aria-modal="true"
    >
      {/* The date badge overhangs the card, so scrolling lives on the inner region */}
      <div
        className="relative flex flex-col w-full max-w-md max-h-[85svh] bg-[#fffaf0] border-4 border-ink shadow-[6px_6px_0_0_var(--ink)] p-5 sm:p-6 origin-top"
        style={{
          animation: closing
            ? `letter-fold ${REVEAL.closing.duration}ms ease-in forwards`
            : ceremonial
              ? `letter-unfold ${REVEAL.reading.unfold}ms ease-out both`
              : "letter-open 0.5s ease-out",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-pig-deep text-white font-pixel text-xs px-3 py-1 border-2 border-ink whitespace-nowrap">
          {ceremonial ? "just for you" : readDate ? `opened ${readDate}` : "just for you"}
        </div>
        <p className="flex-1 min-h-24 overflow-y-auto font-pixel-body text-xl sm:text-2xl leading-relaxed text-ink whitespace-pre-wrap break-words pt-2">
          {parts
            ? parts.map(({ token, delay }, i) =>
                delay === null ? (
                  token
                ) : (
                  /* Inline, never inline-block: a block would break the wrapping
                     mid-sentence. Fading opacity is all an inline box can do
                     anyway, which is the effect we want. */
                  <span
                    key={i}
                    style={{
                      animation: `enter-fade 260ms ease-out ${REVEAL.reading.textDelay + delay}ms both`,
                    }}
                  >
                    {token}
                  </span>
                )
              )
            : note.content}
        </p>
        <div className="flex items-center justify-between gap-3 mt-6 shrink-0">
          <button
            onClick={() => onToggleFavorite(note)}
            className="font-pixel text-sm min-h-11 px-3 border-2 border-ink cursor-pointer transition-colors bg-white hover:bg-pig/30 touch-manipulation"
            aria-pressed={note.is_favorite}
          >
            {note.is_favorite ? "♥ favorited" : "♡ favorite"}
          </button>
          <button
            onClick={onClose}
            className="font-pixel text-sm min-h-11 px-3 bg-cream-dark border-2 border-ink hover:bg-[#eedabb] cursor-pointer touch-manipulation"
          >
            close
          </button>
        </div>
      </div>
    </div>
  );
}
