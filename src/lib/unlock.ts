import type { Note } from "./types";

/** Hours between note unlocks for the recipient (same cadence as the old site). */
export const UNLOCK_INTERVAL_MS = 24 * 60 * 60 * 1000;

export type UnlockState = {
  /** Notes already read, in order. */
  readNotes: Note[];
  /** The next unread note if one exists. */
  nextNote: Note | null;
  /** True when the next note can be opened right now. */
  canUnlock: boolean;
  /** Epoch ms when the next note becomes available (null if none left or available now). */
  unlocksAt: number | null;
};

/**
 * Unlock cadence: the first note is available immediately; each subsequent
 * note unlocks 24h after the previous one was read.
 */
export function getUnlockState(notes: Note[]): UnlockState {
  const ordered = [...notes].sort((a, b) => a.position - b.position);
  const readNotes = ordered.filter((n) => n.read_at !== null);
  const nextNote = ordered.find((n) => n.read_at === null) ?? null;

  if (!nextNote) {
    return { readNotes, nextNote: null, canUnlock: false, unlocksAt: null };
  }

  const lastReadAt = readNotes.length
    ? Math.max(...readNotes.map((n) => new Date(n.read_at!).getTime()))
    : null;

  if (lastReadAt === null) {
    return { readNotes, nextNote, canUnlock: true, unlocksAt: null };
  }

  const unlocksAt = lastReadAt + UNLOCK_INTERVAL_MS;
  const canUnlock = Date.now() >= unlocksAt;
  return { readNotes, nextNote, canUnlock, unlocksAt: canUnlock ? null : unlocksAt };
}
