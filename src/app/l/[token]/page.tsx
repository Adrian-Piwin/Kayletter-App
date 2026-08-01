import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLetterByToken, getOrCreatePet, listNotes } from "@/lib/data";
import { decayedStats, tricksUnlockedFor } from "@/lib/pet";
import GardenScene from "@/components/garden/GardenScene";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const letter = await getLetterByToken(token);
  return { title: letter ? `${letter.title} — Kayletter` : "Kayletter" };
}

export default async function RecipientPage({ params }: Props) {
  const { token } = await params;
  const letter = await getLetterByToken(token);
  if (!letter) notFound();

  const [notes, pet] = await Promise.all([listNotes(letter.id), getOrCreatePet(letter.id)]);
  const stats = decayedStats(pet, new Date(pet.updated_at));

  // Server components render once per request, so reading the clock here is
  // safe; the client uses this to keep its first render identical to SSR.
  // eslint-disable-next-line react-hooks/purity
  const serverNow = Date.now();

  return (
    <GardenScene
      token={token}
      title={letter.title}
      petName={letter.pet_name}
      initialNotes={notes}
      initialPet={{ ...stats, tricks_unlocked: tricksUnlockedFor(notes) }}
      serverNow={serverNow}
    />
  );
}
