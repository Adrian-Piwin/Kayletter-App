import type { CSSProperties } from "react";

/**
 * Timings for the garden's opening sequence, in milliseconds from the moment it
 * starts. The scene assembles outwards — sky, then the ground underfoot, then
 * the hills in the distance and the field sprouting row by row — while the pig
 * walks in from off screen and the heads-up display lands once the world
 * behind it has settled.
 */
export const INTRO = {
  /** Sun, moon, stars and clouds drifting down into an empty sky. */
  sky: { delay: 0, duration: 520, stagger: 60 },
  /** Grass and soil slide up into place. */
  ground: { delay: 60, duration: 520 },
  /**
   * Hills wait for the ground to land and then fade up on the horizon behind
   * it, a beat apart from one another, like distance coming into view.
   */
  hills: { delay: 560, duration: 520, stagger: 70 },
  /** Depth rows of the field, fading in from the back of the garden forwards. */
  row: { delay: 240, duration: 420, stagger: 60 },
  /**
   * Sunflowers spring out of the ground in a wave; `sweep` is how long that
   * wave takes to cross the screen from left to right.
   */
  flower: { delay: 520, duration: 520, sweep: 420 },
  /** The pig trots in from off screen and is the last to arrive. */
  pig: { delay: 300, duration: 1450, frameMs: 130 },
  /** Title, pet stats and mailbox drop in from the top. */
  hud: { delay: 1050, duration: 380, stagger: 90 },
  /** Status chip, action bar and field nav rise from the bottom. */
  controls: { delay: 1280, duration: 380 },
} as const;

/** How long the whole sequence runs, after which the scene drops its opening styles. */
export const INTRO_MS = 600000;

/**
 * Where the scene is in its opening. `waiting` covers the server render and
 * hydration: the world is held back until the client has settled on a layout,
 * so the sequence plays through once instead of restarting under itself.
 */
export type IntroPhase = "waiting" | "playing" | "done";

type Beat = { delay: number; duration: number };

const HIDDEN: CSSProperties = { opacity: 0 };

/**
 * Style for one beat of the opening: out of sight until the sequence starts,
 * animating while it plays, and untouched once it is over — so nothing is left
 * holding an animation's final frame over the scene's own styles.
 */
export function entrance(
  phase: IntroPhase,
  keyframes: string,
  { delay, duration }: Beat,
  { extraDelay = 0, easing = "ease-out" }: { extraDelay?: number; easing?: string } = {}
): CSSProperties | undefined {
  if (phase === "done") return undefined;
  if (phase === "waiting") return HIDDEN;
  return { animation: `${keyframes} ${duration}ms ${easing} ${delay + extraDelay}ms both` };
}
