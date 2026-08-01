import { NextResponse } from "next/server";
import { getLetterByToken, setNoteFavorite } from "@/lib/data";

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
  return NextResponse.json({ note });
}
