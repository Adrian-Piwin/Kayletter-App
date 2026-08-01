import { NextResponse } from "next/server";
import { getLetterByToken, listNotes, markNoteRead } from "@/lib/data";
import { getUnlockState } from "@/lib/unlock";

type Params = { params: Promise<{ token: string }> };

/** Recipient opens the next note, if the 24h cadence allows it. */
export async function POST(_req: Request, { params }: Params) {
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
  return NextResponse.json({ note });
}
