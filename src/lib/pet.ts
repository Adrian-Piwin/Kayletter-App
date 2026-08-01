import type { Note, Pet } from "./types";

/** Pig stats drift while nobody visits: gets hungrier and a bit lonely. */
const HUNGER_PER_HOUR = 2;
const HAPPINESS_DECAY_PER_HOUR = 1.5;

/** A new trick is unlocked for every N notes read. */
export const NOTES_PER_TRICK = 2;
export const TRICKS = ["spin", "backflip", "dance", "sit"] as const;
export type Trick = (typeof TRICKS)[number];

const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

/** Apply time-based decay since the pet row was last saved. */
export function decayedStats(pet: Pet, updatedAt: Date): { happiness: number; hunger: number } {
  const hours = Math.max(0, (Date.now() - updatedAt.getTime()) / 3_600_000);
  return {
    happiness: clamp(pet.happiness - hours * HAPPINESS_DECAY_PER_HOUR),
    hunger: clamp(pet.hunger + hours * HUNGER_PER_HOUR),
  };
}

export function tricksUnlockedFor(notes: Note[]): number {
  const readCount = notes.filter((n) => n.read_at !== null).length;
  return Math.min(TRICKS.length, Math.floor(readCount / NOTES_PER_TRICK));
}

export type PetAction = "feed" | "play" | "trick";

/** Stat changes for each interaction. Feeding a full pig barely helps. */
export function applyAction(stats: { happiness: number; hunger: number }, action: PetAction) {
  switch (action) {
    case "feed": {
      const effective = stats.hunger < 10 ? 5 : 30;
      return { happiness: clamp(stats.happiness + 5), hunger: clamp(stats.hunger - effective) };
    }
    case "play":
      return { happiness: clamp(stats.happiness + 20), hunger: clamp(stats.hunger + 10) };
    case "trick":
      return { happiness: clamp(stats.happiness + 10), hunger: clamp(stats.hunger + 5) };
  }
}

/** Mood drives which idle animation the pig plays. */
export function petMood(stats: { happiness: number; hunger: number }): "happy" | "okay" | "sad" | "hungry" {
  if (stats.hunger >= 70) return "hungry";
  if (stats.happiness >= 70) return "happy";
  if (stats.happiness >= 35) return "okay";
  return "sad";
}
