"use client";

import { useMemo } from "react";
import Pagination, { usePagination } from "@/components/Pagination";
import Sprite from "@/components/Sprite";
import type { Note } from "@/lib/types";

const LETTERS_PER_PAGE = 6;

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
  // Newest letter first — the one most likely to be re-read.
  const newestFirst = useMemo(() => [...notes].reverse(), [notes]);
  const { page, pageCount, start, visible, setPage } = usePagination(
    newestFirst,
    LETTERS_PER_PAGE
  );

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-ink/50 p-4"
      onClick={onClose}
    >
      <div
        className="flex flex-col gap-4 w-full max-w-md max-h-[85svh] bg-cream border-4 border-ink shadow-[6px_6px_0_0_var(--ink)] p-4 sm:p-5 [animation:pop-in_0.25s_ease-out]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between gap-3 shrink-0">
          <h2 className="font-pixel text-base sm:text-lg text-ink">your letters</h2>
          <button
            onClick={onClose}
            className="font-pixel text-sm min-h-11 px-3 bg-cream-dark border-2 border-ink hover:bg-[#eedabb] cursor-pointer touch-manipulation"
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
          <>
            <ul className="flex flex-col gap-2 flex-1 min-h-0 overflow-y-auto">
              {visible.map((n, i) => (
                <li key={n.id}>
                  <button
                    onClick={() => onOpen(n)}
                    className="w-full text-left bg-white border-2 border-ink p-3 hover:bg-pig/10 cursor-pointer touch-manipulation"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-pixel text-xs text-ink/50">
                        letter {notes.length - (start + i)}
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
            <Pagination
              page={page}
              pageCount={pageCount}
              onChange={setPage}
              label="letters"
              className="shrink-0"
            />
          </>
        )}
      </div>
    </div>
  );
}
