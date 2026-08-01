import { NextResponse } from "next/server";
import { getLetterByToken, setNoteFavorite } from "@/lib/data";
import {
  captureServerEvent,
  distinctIdFromRequest,
  sessionIdFromRequest,
} from "@/lib/posthog-server";

type Params = { params: Promise<{ token: string }> };

export async function POST(req: Request, { params }: Params) {
  const { token } = await params;
  const letter = await getLetterByToken(token);
  if (!letter) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { noteId, isFavorite } = await req.json();
  if (typeof noteId !== "string" || typeof isFavorite !== "boolean") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const note = await setNoteFavorite(noteId, letter.id, isFavorite);
  if (!note) return NextResponse.json({ error: "Note not found" }, { status: 404 });

  const distinctId = distinctIdFromRequest(req, `recipient:${token}`);
  await captureServerEvent(distinctId, isFavorite ? "letter_favorited" : "letter_unfavorited", {
    $session_id: sessionIdFromRequest(req),
    letter_id: letter.id,
    note_id: note.id,
    author_user_id: letter.owner_clerk_id,
  });

  return NextResponse.json({ note });
}
