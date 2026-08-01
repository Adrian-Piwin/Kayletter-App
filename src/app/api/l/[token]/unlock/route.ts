import { NextResponse } from "next/server";
import { getLetterByToken, listNotes, markNoteRead } from "@/lib/data";
import { getUnlockState } from "@/lib/unlock";
import {
  captureServerEvent,
  distinctIdFromRequest,
  sessionIdFromRequest,
} from "@/lib/posthog-server";

type Params = { params: Promise<{ token: string }> };

/** Recipient opens the next note, if the 24h cadence allows it. */
export async function POST(req: Request, { params }: Params) {
  const { token } = await params;
  const letter = await getLetterByToken(token);
  if (!letter) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const notes = await listNotes(letter.id);
  const state = getUnlockState(notes);
  if (!state.nextNote || !state.canUnlock) {
    return NextResponse.json(
      { error: "No note available yet", unlocksAt: state.unlocksAt },
      { status: 409 }
    );
  }

  const note = await markNoteRead(state.nextNote.id, letter.id);
  if (!note) return NextResponse.json({ error: "Note not found" }, { status: 404 });

  const deliveredCount = state.readNotes.length + 1;
  const distinctId = distinctIdFromRequest(req, `recipient:${token}`);
  await captureServerEvent(distinctId, "letter_unlocked", {
    $session_id: sessionIdFromRequest(req),
    letter_id: letter.id,
    note_id: note.id,
    delivery_index: deliveredCount,
    note_count: notes.length,
    author_user_id: letter.owner_clerk_id,
  });
  return NextResponse.json({ note });
}
