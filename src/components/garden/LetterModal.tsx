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
      <div
        className="relative w-full max-w-md bg-[#fffaf0] border-4 border-ink shadow-[6px_6px_0_0_var(--ink)] p-6 origin-top [animation:letter-open_0.5s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-pig-deep text-white font-pixel text-xs px-3 py-1 border-2 border-ink">
          {readDate ? `opened ${readDate}` : "just for you"}
        </div>
        <p className="font-pixel-body text-2xl leading-relaxed text-ink whitespace-pre-wrap min-h-24 pt-2">
          {note.content}
        </p>
        <div className="flex items-center justify-between mt-6">
          <button
            onClick={() => onToggleFavorite(note)}
            className="font-pixel text-sm px-3 py-1.5 border-2 border-ink cursor-pointer transition-colors bg-white hover:bg-pig/30"
            aria-pressed={note.is_favorite}
          >
            {note.is_favorite ? "♥ favorited" : "♡ favorite"}
          </button>
          <button
            onClick={onClose}
            className="font-pixel text-sm px-3 py-1.5 bg-cream-dark border-2 border-ink hover:bg-[#eedabb] cursor-pointer"
          >
            close
          </button>
        </div>
      </div>
    </div>
  );
}
