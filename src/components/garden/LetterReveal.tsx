"use client";

import { useEffect, type CSSProperties } from "react";
import Sprite from "@/components/Sprite";
import { REVEAL, type Petal, type RevealPhase } from "@/lib/letter-reveal";

/**
 * Everything on screen during the ceremony except the letter itself: the garden
 * dimming, the envelope leaving the pig, the seal breaking and the petals.
 *
 * Presentation only — the phase it is handed comes from `useLetterReveal`, so
 * the timeline lives in one place and this file never schedules anything.
 */
export default function LetterReveal({
  phase,
  petals,
  originX,
  originBottom,
  isMobile,
  onSkip,
}: {
  phase: RevealPhase;
  petals: Petal[];
  /** Where the pig is standing, as a percentage across the scene. */
  originX: number;
  /** How far up the scene the pig stands, as a percentage. */
  originBottom: number;
  isMobile: boolean;
  onSkip: () => void;
}) {
  const flying = phase === "lifting" || phase === "sealed" || phase === "breaking";
  const visible = flying || phase === "reading" || phase === "closing";

  useEffect(() => {
    if (!flying) return;
    const onKey = () => onSkip();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flying, onSkip]);

  if (!visible) return null;

  const envelopeHeight = isMobile ? 44 : 56;

  return (
    /*
     * Sized to the scene rather than to `inset-0`, so the flight below can be
     * measured in viewport units and still land dead centre on a phone where
     * the browser chrome eats the bottom of the layout viewport.
     */
    <div
      className="fixed inset-x-0 top-0 h-svh z-30 overflow-clip"
      onClick={flying ? onSkip : undefined}
      role="presentation"
    >
      <div
        className="absolute inset-0 bg-ink"
        style={{
          animation:
            phase === "closing"
              ? `reveal-undim ${REVEAL.closing.duration}ms ease-in forwards`
              : `reveal-dim ${REVEAL.lift.scrim}ms ease-out both`,
        }}
      />

      {flying && (
        <div
          className="absolute -translate-x-1/2"
          style={
            {
              left: `${originX}%`,
              bottom: `${originBottom}%`,
              // The scene is exactly one viewport, so the trip to the middle of
              // it is the difference between the two percentages read as
              // viewport units — no measuring, and correct at any window size.
              "--fly-x": `${50 - originX}vw`,
              "--fly-y": `${-(50 - originBottom)}svh`,
              animation: `letter-fly ${REVEAL.lift.duration}ms cubic-bezier(0.34, 0.9, 0.36, 1) both`,
            } as CSSProperties
          }
        >
          {/* Light behind the seal: barely there while it floats, blinding as it gives way. */}
          <div
            aria-hidden
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none"
            style={{
              width: envelopeHeight * 6,
              height: envelopeHeight * 6,
              background:
                "radial-gradient(circle, rgba(255,247,214,0.95) 0%, rgba(247,201,72,0.45) 35%, rgba(247,201,72,0) 68%)",
              animation:
                phase === "breaking"
                  ? `seal-flash ${REVEAL.breaking.duration}ms ease-out forwards`
                  : `seal-glow 1.6s ease-in-out infinite`,
            }}
          />

          {/*
           * Nested so the envelope can bob and then burst on its own transform
           * while the wrapper above keeps hold of where the flight ended.
           */}
          <div
            style={{
              animation:
                phase === "breaking"
                  ? `letter-burst ${REVEAL.breaking.duration}ms ease-out forwards`
                  : "bob 1.4s ease-in-out infinite",
            }}
          >
            <Sprite name="envelope" alt="a letter for you" height={envelopeHeight} />
          </div>

          {phase === "breaking" &&
            petals.map((p) => (
              <span
                key={p.id}
                aria-hidden
                className="absolute left-1/2 top-1/2 block pointer-events-none"
                style={
                  {
                    width: p.size,
                    height: p.size,
                    background: p.colour,
                    "--petal-x": `${p.dx}px`,
                    "--petal-y": `${p.dy}px`,
                    "--petal-spin": `${p.spin}deg`,
                    animation: `petal-burst 1100ms ease-out ${p.delay}ms forwards`,
                  } as CSSProperties
                }
              />
            ))}
        </div>
      )}

      {flying && (
        <p
          className="absolute inset-x-0 bottom-8 text-center font-pixel text-xs text-cream/45"
          style={{ animation: `enter-fade 600ms ease-out 700ms both` }}
        >
          tap to skip
        </p>
      )}
    </div>
  );
}
