import "server-only";
import { auth, currentUser } from "@clerk/nextjs/server";
import { ensureProfile, getOrCreateLetter } from "./data";
import type { Letter, Profile } from "./types";

export type AuthorContext = { profile: Profile; letter: Letter };

/**
 * Resolve the signed-in author's profile and letter page.
 * Creates both on first visit and claims migrated letters by email.
 */
export async function getAuthorContext(): Promise<AuthorContext | null> {
  const { userId } = await auth();
  if (!userId) return null;
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? "";
  const profile = await ensureProfile(userId, email);
  const letter = await getOrCreateLetter(userId);
  return { profile, letter };
}
