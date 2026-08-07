/**
 * The ceremony around opening today's letter.
 *
 * Unlike the garden's opening sequence, these are durations of consecutive
 * beats rather than offsets from a single start: the sequence pauses at
 * `sealed` until the letter has actually come back from the server, so nothing
 * after that point sits at a fixed distance from the click.
 *
 * Only a fresh unlock is worth this. Re-reading a letter from a flower or the
 * mailbox opens straight into `reading`, because nobody wants to sit through a
 * seal breaking to look at a note they have already read.
 */
export const REVEAL = {
  /** The garden dims and the envelope leaves the pig for the middle of the screen. */
  lift: { duration: 900, scrim: 340 },
  /**
   * Sealed, hovering, lit from within. This is the beat the sequence waits on
   * when the network is slow — a letter held a moment longer reads as
   * anticipation, where a spinner would read as a fault.
   */
  sealed: { duration: 300 },
  /** The seal gives way: light burst, petals, the envelope coming apart. */
  breaking: { duration: 320 },
  /** Paper unfolding into the card, then the words writing themselves on. */
  reading: { unfold: 420, textDelay: 300, line: 120 },
  /** The card folds shut and drifts down towards the soil. */
  closing: { duration: 420 },
  /** The camera reaches the new flower and it breaks ground where the letter landed. */
  sprouting: { pan: 140, duration: 900 },
} as const;

/**
 * Where the ceremony is. `idle` covers both "no letter open" and every opening
 * that doesn't get the ceremony — the modal decides what to draw from whether
 * it was handed a phase at all.
 */
export type RevealPhase =
  | "idle"
  | "lifting"
  | "sealed"
  | "breaking"
  | "reading"
  | "closing"
  | "sprouting";

/**
 * How far above the pig's feet the envelope starts its flight, as a share of
 * the scene — near enough to the snout that it reads as being let go of rather
 * than rising off the ground.
 */
export const ENVELOPE_LIFT_PCT = 7;

/** Enough to fill the burst without turning the middle of the screen to soup. */
const PETAL_COUNT = 18;

/** One petal thrown by the seal breaking; distances are px from the envelope. */
export type Petal = {
  id: number;
  dx: number;
  dy: number;
  spin: number;
  size: number;
  delay: number;
  colour: string;
};

/**
 * A ring of petals thrown outwards and then pulled down, so the burst falls
 * like something the garden made rather than a firework. Called from an effect
 * rather than a render — the positions have to survive re-renders unchanged.
 */
export function scatterPetals(colours: readonly string[], count = PETAL_COUNT): Petal[] {
  return Array.from({ length: count }, (_, i) => {
    // Evenly spaced around the ring, then jittered, so the spread stays even
    // without looking measured.
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.55;
    const distance = 90 + Math.random() * 130;
    return {
      id: i,
      dx: Math.cos(angle) * distance,
      dy: Math.sin(angle) * distance * 0.6 + 70 + Math.random() * 60,
      spin: (Math.random() - 0.5) * 540,
      size: Math.random() < 0.35 ? 8 : 6,
      delay: Math.random() * 90,
      colour: colours[Math.floor(Math.random() * colours.length)],
    };
  });
}
