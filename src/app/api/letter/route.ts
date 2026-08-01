import { NextResponse } from "next/server";
import { getAuthorContext } from "@/lib/author";
import { updateLetter } from "@/lib/data";

export async function PATCH(req: Request) {
  const ctx = await getAuthorContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 80) : undefined;
  const petName = typeof body.pet_name === "string" ? body.pet_name.trim().slice(0, 24) : undefined;
  if (title === "" || petName === "") {
    return NextResponse.json({ error: "Fields can't be empty" }, { status: 400 });
  }

  const letter = await updateLetter(ctx.letter.id, ctx.profile.clerk_user_id, {
    title,
    pet_name: petName,
  });
  return NextResponse.json({ letter });
}
