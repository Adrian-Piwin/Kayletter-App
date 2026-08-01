"use client";

import { useState, type KeyboardEvent, type Ref } from "react";
import PixelButton from "@/components/PixelButton";
import { MAX_NOTE_LENGTH } from "@/lib/plan";

/**
 * The "write a note" box. Lives at the top of the notes list so adding a note
 * never requires scrolling past the ones already written.
 */
export default function NoteComposer({
  ref,
  onSubmit,
  busy,
}: {
  ref?: Ref<HTMLTextAreaElement>;
  /** Resolves true when the note was saved, so the draft can be cleared. */
  onSubmit: (content: string) => Promise<boolean>;
  busy: boolean;
}) {
  const [draft, setDraft] = useState("");
  const canSubmit = !busy && draft.trim().length > 0;

  async function submit() {
    if (!canSubmit) return;
    if (await onSubmit(draft.trim())) setDraft("");
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="flex flex-col gap-2 border-2 border-dashed border-ink/30 bg-cream/50 p-3">
      <textarea
        ref={ref}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        maxLength={MAX_NOTE_LENGTH}
        rows={3}
        placeholder="Write a little letter..."
        aria-label="New note"
        className="w-full resize-y border-2 border-ink bg-white px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-pig-deep"
      />
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-ink/50">
          {draft.length > MAX_NOTE_LENGTH - 400 ? (
            `${draft.length}/${MAX_NOTE_LENGTH}`
          ) : (
            <span className="hidden sm:inline">⌘/Ctrl + Enter to add</span>
          )}
        </span>
        <PixelButton onClick={submit} disabled={!canSubmit} className="min-h-11">
          Add note
        </PixelButton>
      </div>
    </div>
  );
}
