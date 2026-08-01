import { NextResponse } from "next/server";
import { getAuthorContext } from "@/lib/author";
import { addNote, countNotes, listNotes } from "@/lib/data";
import { FREE_NOTE_LIMIT, MAX_NOTE_LENGTH } from "@/lib/plan";
import { captureServerEvent, sessionIdFromRequest } from "@/lib/posthog-server";

export async function GET() {
  const ctx = await getAuthorContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const notes = await listNotes(ctx.letter.id);
  return NextResponse.json({ notes });
}

export async function POST(req: Request) {
  const ctx = await getAuthorContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Same id as posthog.identify(clerkUserId) on the client.
  const distinctId = ctx.profile.clerk_user_id;
  const sessionId = sessionIdFromRequest(req);

  const { content } = await req.json();
  if (typeof content !== "string" || !content.trim()) {
    return NextResponse.json({ error: "Note can't be empty" }, { status: 400 });
  }
  if (content.length > MAX_NOTE_LENGTH) {
    return NextResponse.json(
      { error: `Note is too long (${MAX_NOTE_LENGTH} characters max)` },
      { status: 400 }
    );
  }

  if (!ctx.profile.is_premium) {
    const count = await countNotes(ctx.letter.id);
    if (count >= FREE_NOTE_LIMIT) {
      await captureServerEvent(distinctId, "note_limit_reached", {
        $session_id: sessionId,
        note_count: count,
        free_limit: FREE_NOTE_LIMIT,
        is_premium: false,
      });
      return NextResponse.json(
        { error: "Free limit reached", code: "limit_reached" },
        { status: 402 }
      );
    }
  }

  const note = await addNote(ctx.letter.id, content.trim());
  const noteCount = await countNotes(ctx.letter.id);
  await captureServerEvent(distinctId, "note_created", {
    $session_id: sessionId,
    note_id: note.id,
    note_count: noteCount,
    content_length: note.content.length,
    is_premium: ctx.profile.is_premium,
    first_note: noteCount === 1,
  });
  return NextResponse.json({ note }, { status: 201 });
}
