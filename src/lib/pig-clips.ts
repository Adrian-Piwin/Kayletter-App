import { PIG_CLIPS, type PigClip } from "@/lib/pig-anim.generated";
import type { Trick } from "@/lib/pet";

export type PigActorState =
  | "idle"
  | "walk"
  | "eat"
  | "play"
  | "playdead"
  | "backflip"
  | "sit"
  | "dance"
  | "pet";

/** Clip names we plan to ship — may not all be in the atlas yet. */
type ClipName = PigClip | (string & {});

function isPigClip(name: string): name is PigClip {
  return name in PIG_CLIPS;
}

/** Pick a clip that exists in the generated manifest, with a safe fallback. */
function available(preferred: ClipName[], fallback: ClipName = "idle_breathe"): PigClip {
  for (const name of preferred) {
    if (isPigClip(name)) return name;
  }
  if (isPigClip(fallback)) return fallback;
  return Object.keys(PIG_CLIPS)[0] as PigClip;
}

/** Map mood + actor state → the clip the pig should be playing. */
export function clipForState(args: {
  state: PigActorState;
  /** Kept in the signature even though no branch reads it — see the idle case. */
  mood: "happy" | "okay" | "sad" | "hungry";
  hasLetter: boolean;
  flourish?: ClipName | null;
}): PigClip {
  const { state, hasLetter, flourish } = args;

  switch (state) {
    case "walk":
      // Delivery walk keeps the envelope; bare walk is for roaming without a letter.
      if (hasLetter) return available(["walk_letter", "idle_letter", "walk", "idle_breathe"]);
      return available(["walk", "play_chase", "idle_breathe"]);
    case "eat":
      // One clip, not two. Two variants of the same chew is twice the surface to
      // keep consistent for a difference nobody can see at 110px, and it forced a
      // hunger argument through the actor and the scene to choose between them.
      return available(["feed", "idle_breathe"]);
    case "play":
      return available(["play_chase", "walk", "idle_breathe"]);
    case "backflip":
      return available(["trick_backflip", "idle_breathe"]);
    case "sit":
      return available(["trick_sit", "idle_breathe"]);
    case "dance":
      return available(["trick_dance", "idle_breathe"]);
    case "playdead":
      return available(["trick_playdead", "play_roll", "idle_breathe"]);
    case "pet":
      return available(["pet_enjoy", "idle_breathe"]);
    case "idle":
    default:
      if (hasLetter) return available(["idle_letter", "idle_breathe"]);
      if (flourish) return available([flourish, "idle_breathe"]);
      // Mood no longer picks a clip. The two mood idles this replaces were prompted
      // as adjectives rather than postures and came back as a differently
      // proportioned pig; mood reads from the stat bars instead. `mood` stays in the
      // signature so a properly drawn mood pose has an obvious home.
      return available(["idle_breathe"]);
  }
}

/**
 * Times, in ms from the clip's start, at which the pig's jaw shuts — repeated for
 * as long as the clip is held on screen.
 *
 * The chewing frames are marked by the build (see `chomp_frames` in derive.py) and
 * carried in the manifest, so retiming or re-cutting a feed clip moves the beats
 * with it instead of leaving hand-typed numbers behind.
 */
export function chompTimes(clip: PigClip, holdMs: number): number[] {
  const info = PIG_CLIPS[clip];
  const chomps: readonly number[] = "chomps" in info ? info.chomps : [];
  if (chomps.length === 0) return [];

  const cycle = info.frames * info.ms;
  const times: number[] = [];
  for (let start = 0; start < holdMs; start += cycle) {
    for (const frame of chomps) {
      const at = start + frame * info.ms;
      if (at < holdMs) times.push(at);
    }
    if (!info.loop) break;
  }
  return times;
}

export function clipForTrick(trick: Trick): PigActorState {
  if (trick === "backflip") return "backflip";
  if (trick === "sit") return "sit";
  if (trick === "dance") return "dance";
  return "playdead";
}

/** One-shot flourishes the idle scheduler may inject. Blink is rare on purpose. */
const FLOURISH_WEIGHTS: { name: ClipName; weight: number }[] = [
  { name: "idle_sniff", weight: 3 },
  { name: "idle_scratch", weight: 3 },
  { name: "idle_blink", weight: 1 },
];

export function randomFlourish(): PigClip | null {
  const ready = FLOURISH_WEIGHTS.filter((f) => isPigClip(f.name));
  if (ready.length === 0) return null;
  const total = ready.reduce((sum, f) => sum + f.weight, 0);
  let roll = Math.random() * total;
  for (const f of ready) {
    roll -= f.weight;
    if (roll <= 0) return f.name as PigClip;
  }
  return ready[0]?.name as PigClip;
}

/**
 * How long the scene stays in an action before returning to idle.
 *
 * Clips are short on purpose, so these are a little longer than the clip: the
 * last frame holds for the remainder, which lets a pose land instead of
 * snapping straight back to the idle loop.
 */
export function actionHoldMs(state: PigActorState): number {
  switch (state) {
    // Two whole cycles of the 8-frame, 150ms feed loop. Holding a multiple of the
    // cycle matters: the clip starts and ends upright on the idle pose, so the pig
    // is never yanked out of the crouch mid-chew.
    case "eat":
      return 2400;
    // Covers the three-leg run plus whichever finisher clip plays at the end.
    case "play":
      return 3300;
    case "sit":
      return 1400;
    case "playdead":
      return 1400;
    case "backflip":
      return 1000;
    case "dance":
      return 1200;
    case "pet":
      return 0; // gesture-driven
    default:
      return 0;
  }
}
