import { NextResponse } from "next/server";
import { getLetterByToken, getOrCreatePet, listNotes, savePetStats } from "@/lib/data";
import { applyAction, decayedStats, tricksUnlockedFor, type PetAction } from "@/lib/pet";
import {
  captureServerEvent,
  distinctIdFromRequest,
  sessionIdFromRequest,
} from "@/lib/posthog-server";

type Params = { params: Promise<{ token: string }> };

const ACTIONS: PetAction[] = ["feed", "play", "trick"];

export async function POST(req: Request, { params }: Params) {
  const { token } = await params;
  const letter = await getLetterByToken(token);
  if (!letter) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { action } = await req.json();
  if (!ACTIONS.includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const pet = await getOrCreatePet(letter.id);
  const notes = await listNotes(letter.id);
  const unlocked = tricksUnlockedFor(notes);

  if (action === "trick" && unlocked === 0) {
    return NextResponse.json({ error: "No tricks learned yet" }, { status: 409 });
  }

  const current = decayedStats(pet, new Date(pet.updated_at));
  const next = applyAction(current, action);
  const saved = await savePetStats(letter.id, {
    ...next,
    fed: action === "feed",
    played: action === "play",
    tricks_unlocked: unlocked,
  });

  const distinctId = distinctIdFromRequest(req, `recipient:${token}`);
  await captureServerEvent(distinctId, "pet_action", {
    $session_id: sessionIdFromRequest(req),
    action,
    letter_id: letter.id,
    happiness: saved.happiness,
    hunger: saved.hunger,
    tricks_unlocked: unlocked,
  });

  return NextResponse.json({ pet: saved });
}
