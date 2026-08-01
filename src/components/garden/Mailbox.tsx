"use client";

import Sprite from "@/components/Sprite";
import type { Note } from "@/lib/types";

/** Drawer listing every letter already delivered, for re-reading. */
export default function Mailbox({
  notes,
  onClose,
  onOpen,
}: {
  notes: Note[];
  onClose: () => void;
  onOpen: (note: Note) => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md max-h-[80vh] overflow-y-auto bg-cream border-4 border-ink shadow-[6px_6px_0_0_var(--ink)] p-5 [animation:pop-in_0.25s_ease-out]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-pixel text-lg text-ink">your letters</h2>
          <button
            onClick={onClose}
            className="font-pixel text-sm px-2 py-1 bg-cream-dark border-2 border-ink hover:bg-[#eedabb] cursor-pointer"
          >
            close
          </button>
        </div>
        {notes.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <Sprite name="envelope" alt="" height={56} />
            <p className="text-ink/60 text-sm">
              No letters opened yet — when the pig brings one, it will be kept here.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {[...notes].reverse().map((n, i) => (
              <li key={n.id}>
                <button
                  onClick={() => onOpen(n)}
                  className="w-full text-left bg-white border-2 border-ink p-3 hover:bg-pig/10 cursor-pointer"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-pixel text-xs text-ink/50">
                      letter {notes.length - i}
                    </span>
                    {n.is_favorite && <span className="text-pig-deep text-sm">♥</span>}
                    <span className="ml-auto text-xs text-ink/40">
                      {n.read_at && new Date(n.read_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="font-pixel-body text-lg text-ink/80 line-clamp-2">{n.content}</p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
