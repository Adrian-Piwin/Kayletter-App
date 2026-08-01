"use client";

import type { Note } from "@/lib/types";

/** The opened letter: pixel paper with the note text and a favorite toggle. */
export default function LetterModal({
  note,
  onClose,
  onToggleFavorite,
}: {
  note: Note;
  onClose: () => void;
  onToggleFavorite: (note: Note) => void;
}) {
  const readDate = note.read_at
    ? new Date(note.read_at).toLocaleDateString(undefined, {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-ink/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      {/* The date badge overhangs the card, so scrolling lives on the inner region */}
      <div
        className="relative flex flex-col w-full max-w-md max-h-[85svh] bg-[#fffaf0] border-4 border-ink shadow-[6px_6px_0_0_var(--ink)] p-5 sm:p-6 origin-top [animation:letter-open_0.5s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-pig-deep text-white font-pixel text-xs px-3 py-1 border-2 border-ink whitespace-nowrap">
          {readDate ? `opened ${readDate}` : "just for you"}
        </div>
        <p className="flex-1 min-h-24 overflow-y-auto font-pixel-body text-xl sm:text-2xl leading-relaxed text-ink whitespace-pre-wrap break-words pt-2">
          {note.content}
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
