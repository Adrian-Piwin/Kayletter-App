"use client";

import { useCallback, useEffect, useState } from "react";
import SpriteSheet from "@/components/SpriteSheet";
import { usePrefersReducedMotion } from "@/lib/hooks";
import { useSpriteAnimation } from "@/lib/useSpriteAnimation";
import { useRubGesture } from "@/lib/useRubGesture";
import {
  clipForState,
  clipForTrick,
  randomFlourish,
  type PigActorState,
} from "@/lib/pig-clips";
import { PIG_CLIPS, type PigClip } from "@/lib/pig-anim.generated";
import { TRICKS, type Trick } from "@/lib/pet";
import { NO_PAN_ATTR } from "./useCamera";
import { pigSize } from "./pig-display";

function asClip(name: string | null | undefined): PigClip | null {
  if (name && name in PIG_CLIPS) return name as PigClip;
  return null;
}

type Mood = "happy" | "okay" | "sad" | "hungry";

type Props = {
  name: string;
  mood: Mood;
  hunger: number;
  hasLetter: boolean;
  state: PigActorState;
  flip: boolean;
  isMobile: boolean;
  opening: boolean;
  /** Finisher clip while play is winding down (bounce/roll at the end of a run). */
  playFinisher?: string | null;
  onClipComplete?: (clip: string) => void;
  onOpenLetter?: () => void;
  /** Fired once when a rub gesture starts (for +1 happiness / analytics). */
  onPet?: () => void;
  disabled?: boolean;
};

/**
 * The pig on screen: clip selection, idle flourishes, facing, letter button.
 * Motion comes from atlas frames — the outer wrapper only owns `left`.
 *
 * Petting is owned here rather than by the scene: the rub gesture drives the
 * clip directly so it responds on the first stroke instead of waiting for the
 * server round-trip that credits the happiness.
 */
export default function PigActor({
  name,
  mood,
  hunger,
  hasLetter,
  state,
  flip,
  isMobile,
  opening,
  playFinisher = null,
  onClipComplete,
  onOpenLetter,
  onPet,
  disabled,
}: Props) {
  const reduceMotion = usePrefersReducedMotion();
  const [flourish, setFlourish] = useState<PigClip | null>(null);
  /** One-shot played on the way out of a rub, so it doesn't cut to idle. */
  const [petOutro, setPetOutro] = useState<PigClip | null>(null);

  const canRub = !disabled && !hasLetter && !opening && !petOutro;

  const onRubStart = useCallback(() => {
    setFlourish(null);
    onPet?.();
  }, [onPet]);

  const onRubEnd = useCallback(() => {
    const end = asClip("pet_end");
    if (end) setPetOutro(end);
    else onClipComplete?.("pet_end");
  }, [onClipComplete]);

  const rub = useRubGesture({ enabled: canRub, onStart: onRubStart, onEnd: onRubEnd });
  const petting = rub.rubbing;

  useEffect(() => {
    if (state !== "idle" || hasLetter || opening || reduceMotion || petting || petOutro) return;
    // Long gaps between flourishes; blink is weighted low inside randomFlourish.
    const delay = 7000 + Math.random() * 8000;
    const t = setTimeout(() => setFlourish(randomFlourish()), delay);
    return () => clearTimeout(t);
  }, [state, hasLetter, opening, reduceMotion, flourish, petting, petOutro]);

  const clip =
    asClip(playFinisher) ??
    petOutro ??
    (petting ? asClip("pet_enjoy") : null) ??
    clipForState({ state: petting ? "pet" : state, mood, hasLetter, hunger, flourish });

  const { frame } = useSpriteAnimation(clip, {
    reducedMotion: reduceMotion,
    onComplete: () => {
      if (petOutro && clip === petOutro) {
        setPetOutro(null);
        onClipComplete?.("pet_end");
        return;
      }
      if (flourish && clip === flourish) setFlourish(null);
      onClipComplete?.(clip);
    },
  });

  const { height } = pigSize(isMobile);
  const cursor = hasLetter ? "cursor-pointer" : petting ? "cursor-grabbing" : "cursor-grab";

  return (
    <button
      type="button"
      // Never the `disabled` attribute: a disabled button stops receiving
      // pointer events, which would kill a rub the moment it starts.
      aria-disabled={disabled && !hasLetter ? true : undefined}
      onClick={(e) => {
        // A rub shouldn't open the letter.
        if (rub.consumeStroke() || petting || petOutro) {
          e.preventDefault();
          return;
        }
        if (hasLetter) onOpenLetter?.();
      }}
      {...{ [NO_PAN_ATTR]: "" }}
      {...rub.handlers}
      className={`block touch-none select-none ${cursor}`}
      aria-label={hasLetter ? "open today's letter" : `rub ${name}`}
    >
      <SpriteSheet frame={frame} alt={name} height={height} flip={flip} />
    </button>
  );
}

export function trickToState(trick: Trick): PigActorState {
  return clipForTrick(trick);
}

export function pickTrick(unlocked: number): Trick {
  const learned = TRICKS.slice(0, unlocked);
  return learned[Math.floor(Math.random() * learned.length)] ?? "spin";
}
