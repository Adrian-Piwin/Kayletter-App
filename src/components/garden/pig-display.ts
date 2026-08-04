import { PIG_SHEET } from "@/lib/pig-anim.generated";

/** On-screen pig box heights — optically match the pre-sheet 102/110px look. */
export const DISPLAY_HEIGHT = 110;
export const DISPLAY_HEIGHT_MOBILE = 102;

/**
 * Where the snout sits, as a fraction of the frame width in from the pig's
 * leading edge. The art is drawn facing left and `flip` mirrors it, so this is
 * measured off the left of `pig-idle.png`: the snout occupies x 0-42 of 189, and
 * food reads best just outside it, since the feed clips lean the pig further in.
 */
const SNOUT_INSET = 0.05;

/** The pig's box on screen. Width follows from the sheet's frame aspect. */
export function pigSize(isMobile: boolean) {
  const height = isMobile ? DISPLAY_HEIGHT_MOBILE : DISPLAY_HEIGHT;
  return { height, width: (height * PIG_SHEET.frameW) / PIG_SHEET.frameH };
}

/**
 * How far the snout is from the pig's centre, in px. Anything the pig eats or
 * sniffs is placed from here rather than a hand-tuned offset, so it stays on the
 * snout at both display sizes.
 */
export function snoutOffset(isMobile: boolean) {
  return (0.5 - SNOUT_INSET) * pigSize(isMobile).width;
}
