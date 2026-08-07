import { NextResponse } from "next/server";
import { getAuthorContext } from "@/lib/author";
import { updateLetter } from "@/lib/data";
import { isFlowerType, isFreeFlower, type FlowerType } from "@/lib/flowers";
import { captureServerEvent, sessionIdFromRequest } from "@/lib/posthog-server";

export async function PATCH(req: Request) {
  const ctx = await getAuthorContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 80) : undefined;
  const petName = typeof body.pet_name === "string" ? body.pet_name.trim().slice(0, 24) : undefined;
  if (title === "" || petName === "") {
    return NextResponse.json({ error: "Fields can't be empty" }, { status: 400 });
  }

  // The dimmed swatches in the picker are a courtesy; this is the actual gate.
  let flowerType: FlowerType | undefined;
  if (body.flower_type !== undefined) {
    if (!isFlowerType(body.flower_type)) {
      return NextResponse.json({ error: "Unknown flower" }, { status: 400 });
    }
    if (!isFreeFlower(body.flower_type) && !ctx.profile.is_premium) {
      return NextResponse.json({ error: "Upgrade to plant this flower" }, { status: 402 });
    }
    flowerType = body.flower_type;
  }

  const letter = await updateLetter(ctx.letter.id, ctx.profile.clerk_user_id, {
    title,
    pet_name: petName,
    flower_type: flowerType,
  });

  await captureServerEvent(ctx.profile.clerk_user_id, "letter_settings_saved", {
    $session_id: sessionIdFromRequest(req),
    changed_title: title !== undefined,
    changed_pet_name: petName !== undefined,
    changed_flower: flowerType !== undefined,
    flower: flowerType,
  });

  return NextResponse.json({ letter });
}
