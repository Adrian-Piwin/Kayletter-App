import "server-only";
import { nanoid } from "nanoid";
import sql from "./db";
import type { Letter, Note, Pet, Profile } from "./types";

/** Length of the unguessable recipient share token. */
const SHARE_TOKEN_LENGTH = 24;

export function newShareToken() {
  return nanoid(SHARE_TOKEN_LENGTH);
}

/**
 * Upsert the author's profile and claim any migrated letters whose
 * claim_email matches their sign-in email (relinks legacy Firebase authors).
 */
export async function ensureProfile(clerkUserId: string, email: string): Promise<Profile> {
  const [profile] = await sql<Profile[]>`
    insert into profiles (clerk_user_id, email)
    values (${clerkUserId}, ${email})
    on conflict (clerk_user_id) do update set email = excluded.email, updated_at = now()
    returning *
  `;
  await sql`
    update letters
    set owner_clerk_id = ${clerkUserId}, updated_at = now()
    where owner_clerk_id is null and lower(claim_email) = lower(${email})
  `;
  return profile;
}

/**
 * The author's letter page, created on first visit.
 * Prefer a migrated legacy letter over an auto-created empty one, in case the
 * author signed in before their old page was claimed (or even migrated).
 */
export async function getOrCreateLetter(clerkUserId: string): Promise<Letter> {
  const existing = await sql<Letter[]>`
    select * from letters where owner_clerk_id = ${clerkUserId}
    order by (legacy_display_id is not null) desc, created_at asc
    limit 1
  `;
  if (existing.length) return existing[0];

  const [letter] = await sql<Letter[]>`
    insert into letters (owner_clerk_id, share_token)
    values (${clerkUserId}, ${newShareToken()})
    returning *
  `;
  return letter;
}

export async function getLetterByToken(token: string): Promise<Letter | null> {
  const [letter] = await sql<Letter[]>`select * from letters where share_token = ${token}`;
  return letter ?? null;
}

export async function getLetterByLegacyDisplayId(displayId: string): Promise<Letter | null> {
  const [letter] = await sql<Letter[]>`select * from letters where legacy_display_id = ${displayId}`;
  return letter ?? null;
}

export async function updateLetter(
  letterId: string,
  ownerClerkId: string,
  fields: { title?: string; pet_name?: string }
): Promise<Letter | null> {
  const [letter] = await sql<Letter[]>`
    update letters set
      title = coalesce(${fields.title ?? null}, title),
      pet_name = coalesce(${fields.pet_name ?? null}, pet_name),
      updated_at = now()
    where id = ${letterId} and owner_clerk_id = ${ownerClerkId}
    returning *
  `;
  return letter ?? null;
}

export async function listNotes(letterId: string): Promise<Note[]> {
  return sql<Note[]>`select * from notes where letter_id = ${letterId} order by position asc, created_at asc`;
}

export async function countNotes(letterId: string): Promise<number> {
  const [row] = await sql<{ count: string }[]>`select count(*) from notes where letter_id = ${letterId}`;
  return Number(row.count);
}

export async function addNote(letterId: string, content: string): Promise<Note> {
  const [note] = await sql<Note[]>`
    insert into notes (letter_id, content, position)
    values (
      ${letterId},
      ${content},
      coalesce((select max(position) + 1 from notes where letter_id = ${letterId}), 0)
    )
    returning *
  `;
  return note;
}

/** Update a note's content; only unread notes may be edited. */
export async function updateNoteContent(noteId: string, letterId: string, content: string): Promise<Note | null> {
  const [note] = await sql<Note[]>`
    update notes set content = ${content}
    where id = ${noteId} and letter_id = ${letterId} and read_at is null
    returning *
  `;
  return note ?? null;
}

export async function deleteNote(noteId: string, letterId: string): Promise<boolean> {
  const result = await sql`
    delete from notes where id = ${noteId} and letter_id = ${letterId} and read_at is null
  `;
  return result.count > 0;
}

export async function reorderNotes(letterId: string, orderedIds: string[]): Promise<void> {
  await sql.begin(async (tx) => {
    for (let i = 0; i < orderedIds.length; i++) {
      await tx`update notes set position = ${i} where id = ${orderedIds[i]} and letter_id = ${letterId} and read_at is null`;
    }
  });
}

export async function markNoteRead(noteId: string, letterId: string): Promise<Note | null> {
  const [note] = await sql<Note[]>`
    update notes set read_at = now()
    where id = ${noteId} and letter_id = ${letterId} and read_at is null
    returning *
  `;
  return note ?? null;
}

export async function setNoteFavorite(noteId: string, letterId: string, isFavorite: boolean): Promise<Note | null> {
  const [note] = await sql<Note[]>`
    update notes set is_favorite = ${isFavorite}
    where id = ${noteId} and letter_id = ${letterId} and read_at is not null
    returning *
  `;
  return note ?? null;
}

export async function getOrCreatePet(letterId: string): Promise<Pet> {
  const [existing] = await sql<Pet[]>`select * from pets where letter_id = ${letterId}`;
  if (existing) return existing;
  const [pet] = await sql<Pet[]>`
    insert into pets (letter_id) values (${letterId})
    on conflict (letter_id) do update set updated_at = pets.updated_at
    returning *
  `;
  return pet;
}

export async function savePetStats(
  letterId: string,
  fields: { happiness: number; hunger: number; fed?: boolean; played?: boolean; tricks_unlocked?: number }
): Promise<Pet> {
  const [pet] = await sql<Pet[]>`
    update pets set
      happiness = ${fields.happiness},
      hunger = ${fields.hunger},
      last_fed_at = case when ${fields.fed ?? false} then now() else last_fed_at end,
      last_played_at = case when ${fields.played ?? false} then now() else last_played_at end,
      tricks_unlocked = coalesce(${fields.tricks_unlocked ?? null}, tricks_unlocked),
      updated_at = now()
    where letter_id = ${letterId}
    returning *
  `;
  return pet;
}

export async function getProfile(clerkUserId: string): Promise<Profile | null> {
  const [profile] = await sql<Profile[]>`select * from profiles where clerk_user_id = ${clerkUserId}`;
  return profile ?? null;
}

export async function setPremium(clerkUserId: string, stripeCustomerId: string | null): Promise<void> {
  await sql`
    update profiles set is_premium = true, stripe_customer_id = ${stripeCustomerId}, updated_at = now()
    where clerk_user_id = ${clerkUserId}
  `;
}
