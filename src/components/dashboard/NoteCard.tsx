"use client";

import { useState } from "react";
import PixelButton from "@/components/PixelButton";
import { MAX_NOTE_LENGTH } from "@/lib/plan";
import type { Note } from "@/lib/types";

const chipClass =
  "font-pixel text-xs min-h-9 px-2.5 border-2 border-ink bg-cream-dark text-ink hover:bg-[#eedabb] cursor-pointer touch-manipulation";

export default function NoteCard({
  note,
  number,
  isEditing,
  onEditStart,
  onEditCancel,
  onSave,
  onDelete,
}: {
  note: Note;
  /** Delivery position in the full list, not the current page. */
  number: number;
  isEditing: boolean;
  onEditStart: () => void;
  onEditCancel: () => void;
  onSave: (content: string) => void;
  onDelete: () => void;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  return (
    <li className={`border-2 border-ink p-3 ${note.read_at ? "bg-cream" : "bg-white"}`}>
      <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <span className="font-pixel text-xs text-ink/50">#{number}</span>
        {note.read_at ? (
          <span className="font-pixel text-xs bg-leaf text-white px-2 py-0.5 border border-ink">
            delivered
          </span>
        ) : (
          <span className="font-pixel text-xs bg-cream-dark text-ink px-2 py-0.5 border border-ink">
            waiting
          </span>
        )}
        {note.is_favorite && (
          <span className="font-pixel text-xs bg-pig text-ink px-2 py-0.5 border border-ink">
            ♥ favorited
          </span>
        )}

        {/* Delivered notes are already read, so they can no longer be changed. */}
        {!note.read_at && !isEditing && (
          <span className="ml-auto flex items-center gap-2">
            {confirmingDelete ? (
              <>
                <span className="font-pixel text-xs text-ink/60">delete?</span>
                <button onClick={onDelete} className={`${chipClass} bg-pig hover:bg-pig-deep`}>
                  yes
                </button>
                <button onClick={() => setConfirmingDelete(false)} className={chipClass}>
                  no
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={onEditStart}
                  className={chipClass}
                  aria-label={`Edit note ${number}`}
                >
                  edit
                </button>
                <button
                  onClick={() => setConfirmingDelete(true)}
                  className={chipClass}
                  aria-label={`Delete note ${number}`}
                >
                  delete
                </button>
              </>
            )}
          </span>
        )}
      </div>

      {isEditing ? (
        <NoteEditor initialContent={note.content} onSave={onSave} onCancel={onEditCancel} />
      ) : (
        <p className="whitespace-pre-wrap break-words text-ink/90">{note.content}</p>
      )}
    </li>
  );
}

/** Mounted only while editing, so its draft always starts from the saved note. */
function NoteEditor({
  initialContent,
  onSave,
  onCancel,
}: {
  initialContent: string;
  onSave: (content: string) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(initialContent);

  return (
    <div className="flex flex-col gap-2">
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        maxLength={MAX_NOTE_LENGTH}
        rows={3}
        autoFocus
        aria-label="Edit note"
        className="w-full resize-y border-2 border-ink bg-white px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-pig-deep"
      />
      <div className="flex flex-wrap gap-2">
        <PixelButton
          variant="leaf"
          onClick={() => onSave(draft.trim())}
          disabled={!draft.trim()}
          className="min-h-11"
        >
          Save
        </PixelButton>
        <PixelButton variant="ghost" onClick={onCancel} className="min-h-11">
          Cancel
        </PixelButton>
      </div>
    </div>
  );
}
