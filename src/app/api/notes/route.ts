import { NextResponse } from "next/server";
import { getAuthorContext } from "@/lib/author";
import { addNote, countNotes, listNotes } from "@/lib/data";
import { FREE_NOTE_LIMIT } from "@/lib/plan";

export async function GET() {
  const ctx = await getAuthorContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const notes = await listNotes(ctx.letter.id);
  return NextResponse.json({ notes });
}

export async function POST(req: Request) {
  const ctx = await getAuthorContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { content } = await req.json();
  if (typeof content !== "string" || !content.trim()) {
    return NextResponse.json({ error: "Note can't be empty" }, { status: 400 });
  }
  if (content.length > 2000) {
    return NextResponse.json({ error: "Note is too long (2000 characters max)" }, { status: 400 });
  }

  if (!ctx.profile.is_premium) {
    const count = await countNotes(ctx.letter.id);
    if (count >= FREE_NOTE_LIMIT) {
      return NextResponse.json(
        { error: "Free limit reached", code: "limit_reached" },
        { status: 402 }
      );
    }
  }

  const note = await addNote(ctx.letter.id, content.trim());
  return NextResponse.json({ note }, { status: 201 });
}
