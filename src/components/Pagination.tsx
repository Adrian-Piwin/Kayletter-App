"use client";

import { useState } from "react";

/**
 * Client-side paging over an in-memory list. The lists here are small enough
 * (a handful to a few dozen notes) that paging on the server would cost a
 * round trip without saving any meaningful work.
 */
export function usePagination<T>(items: T[], perPage: number) {
  const [requestedPage, setRequestedPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(items.length / perPage));

  // Clamped on read so removing the last item on a page can't strand us past the end.
  const page = Math.min(Math.max(1, requestedPage), pageCount);
  const start = (page - 1) * perPage;
  const setPage = (next: number) => setRequestedPage(Math.min(Math.max(1, next), pageCount));

  return {
    page,
    pageCount,
    /** Index of the first visible item, so callers can keep absolute numbering. */
    start,
    visible: items.slice(start, start + perPage),
    setPage,
    /** Jump to whichever page holds the item at this index in the full list. */
    goToIndex: (index: number) => setRequestedPage(Math.floor(index / perPage) + 1),
  };
}

export default function Pagination({
  page,
  pageCount,
  onChange,
  label,
  className = "",
}: {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
  /** Describes the paged list for screen readers, e.g. "notes". */
  label: string;
  className?: string;
}) {
  if (pageCount <= 1) return null;

  const buttonClass =
    "font-pixel text-sm min-h-11 px-4 bg-cream-dark text-ink border-2 border-ink shadow-[3px_3px_0_0_var(--ink)] active:shadow-none active:translate-x-[3px] active:translate-y-[3px] transition-[transform,box-shadow,background-color] duration-100 hover:bg-[#eedabb] disabled:opacity-40 disabled:pointer-events-none cursor-pointer touch-manipulation";

  return (
    <nav
      aria-label={`${label} pagination`}
      className={`flex items-center justify-between gap-3 ${className}`}
    >
      <button
        type="button"
        onClick={() => onChange(page - 1)}
        disabled={page === 1}
        className={buttonClass}
        aria-label={`Previous page of ${label}`}
      >
        ‹ prev
      </button>
      <span aria-live="polite" className="font-pixel text-xs sm:text-sm text-ink/60">
        page {page} of {pageCount}
      </span>
      <button
        type="button"
        onClick={() => onChange(page + 1)}
        disabled={page === pageCount}
        className={buttonClass}
        aria-label={`Next page of ${label}`}
      >
        next ›
      </button>
    </nav>
  );
}
