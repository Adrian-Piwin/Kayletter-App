import { NextResponse } from "next/server";
import { getAuthorContext } from "@/lib/author";
import { deleteNote, updateNoteContent } from "@/lib/data";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const ctx = await getAuthorContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { content } = await req.json();
  if (typeof content !== "string" || !content.trim()) {
    return NextResponse.json({ error: "Note can't be empty" }, { status: 400 });
  }

  const note = await updateNoteContent(id, ctx.letter.id, content.trim());
  if (!note) {
    return NextResponse.json({ error: "Note not found or already delivered" }, { status: 404 });
  }
  return NextResponse.json({ note });
}

export async function DELETE(_req: Request, { params }: Params) {
  const ctx = await getAuthorContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const deleted = await deleteNote(id, ctx.letter.id);
  if (!deleted) {
    return NextResponse.json({ error: "Note not found or already delivered" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
