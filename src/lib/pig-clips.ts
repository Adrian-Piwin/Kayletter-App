import { PIG_CLIPS, type PigClip } from "@/lib/pig-anim.generated";
import type { Trick } from "@/lib/pet";

export type PigActorState =
  | "idle"
  | "walk"
  | "eat"
  | "play"
  | "spin"
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
  mood: "happy" | "okay" | "sad" | "hungry";
  hasLetter: boolean;
  flourish?: ClipName | null;
}): PigClip {
  const { state, mood, hasLetter, flourish } = args;

  switch (state) {
    case "walk":
      return available(["walk", "play_chase", "idle_breathe"]);
    case "eat":
      return available(["feed", "idle_breathe"]);
    case "play":
      return available(["play_chase", "walk", "idle_breathe"]);
    case "spin":
      return available(["trick_spin", "idle_breathe"]);
    case "backflip":
      return available(["trick_backflip", "trick_spin", "idle_breathe"]);
    case "sit":
      return available(["trick_sit", "idle_breathe"]);
    case "dance":
      return available(["trick_dance", "trick_spin", "idle_breathe"]);
    case "pet":
      return available(["pet_enjoy", "idle_breathe"]);
    case "idle":
    default:
      if (hasLetter) return available(["idle_letter", "idle_breathe"]);
      if (flourish) return available([flourish, "idle_breathe"]);
      if (mood === "hungry") return available(["idle_hungry", "idle_sad", "idle_breathe"]);
      if (mood === "sad") return available(["idle_sad", "idle_breathe"]);
      return available(["idle_breathe"]);
  }
}

/**
 * Times, in ms from the clip's start, at which the pig takes a bite — repeated for
 * as long as the clip is held on screen.
 *
 * Which frames those are is recorded against the generation that produced them
 * (`chomps` in jobs.json) and carried into the manifest by the build, so retiming
 * the clip moves the beats with it rather than leaving hand-typed numbers behind
 * in the scene. Note they have to be *measured* off a generated clip — the model
 * decides where the mouth opens — so jobs.json records the pixel counts that
 * justify them.
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
  return "spin";
}

/** One-shot flourishes the idle scheduler may inject. Blink is rare on purpose. */
const FLOURISH_WEIGHTS: { name: ClipName; weight: number }[] = [
  { name: "idle_sniff", weight: 3 },
  { name: "idle_look", weight: 3 },
  { name: "idle_scratch", weight: 2 },
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
 * Every clip is 6 frames, so these are all longer than the clip they cover. Since
 * each clip is generated with the idle pose pinned as its own last frame, the
 * remainder holds on that pose — the pig has already settled by the time the state
 * changes, so returning to the idle loop cannot snap.
 */
export function actionHoldMs(state: PigActorState): number {
  switch (state) {
    // Two whole cycles of the 6-frame, 167ms feed loop. Holding a multiple of the
    // cycle matters: the clip starts and ends upright on the idle pose, so every
    // cycle boundary is a safe place to stop and the pig is never yanked out of
    // the bend mid-chew.
    case "eat":
      return 2000;
    // Covers the three-leg run plus whichever finisher clip plays at the end.
    case "play":
      return 3300;
    case "sit":
      return 1700;
    case "backflip":
      return 1000;
    case "spin":
    case "dance":
      return 1100;
    case "pet":
      return 0; // gesture-driven
    default:
      return 0;
  }
}
