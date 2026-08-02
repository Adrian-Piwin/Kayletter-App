"use client";

import { memo } from "react";
import ParallaxLayer from "./ParallaxLayer";
import { entrance, INTRO, type IntroPhase } from "@/lib/garden-intro";
import type { CameraController } from "./useCamera";

export type SkyPhase = "day" | "sunset" | "night";

export const SKY_GRADIENT: Record<SkyPhase, string> = {
  day: "linear-gradient(#8ed3ee 0%, #aedef5 60%, #d9f3fa 100%)",
  sunset: "linear-gradient(#7ec8e3 0%, #f9c784 60%, #f4a7b4 100%)",
  night: "linear-gradient(#1d2a52 0%, #2b3a67 55%, #40518a 100%)",
};

/**
 * Sky share the scenery below was measured against. Everything in the sky is
 * placed as a fraction of this, so a scene with a high horizon — a phone, where
 * the grass takes most of the frame — keeps the same composition overhead
 * rather than burying its hills and clouds in the grass.
 */
const REFERENCE_SKY_PCT = 50;

/**
 * Distant scenery, back to front. Slower bands read as further away, and the
 * further band is the taller one so it still crests over the nearer. Both root
 * below the grass line — the ground is painted over them, and a hill that stops
 * short of it hangs in the sky rather than standing on the horizon.
 */
const HILL_BANDS = [
  { factor: 0.2, perScreen: 1.4, heightVh: 16, widthVw: 32, rootPct: -1.5 },
  { factor: 0.34, perScreen: 1.9, heightVh: 8, widthVw: 22, rootPct: -1 },
];

const HILL_COLORS: Record<SkyPhase, [string, string]> = {
  day: ["#a9cf8c", "#7fb069"],
  sunset: ["#b9b284", "#879659"],
  night: ["#37496f", "#2b3a57"],
};

const CLOUDS_PER_SCREEN = 1.3;
const CLOUD_FACTOR = 0.1;
const STAR_COUNT = 24;

/** Stepped silhouette — a smooth curve would fight the pixel art. */
function Hill({ widthVw, heightVh, color }: { widthVw: number; heightVh: number; color: string }) {
  const steps = 6;
  return (
    <span className="flex flex-col items-center" aria-hidden>
      {Array.from({ length: steps }, (_, i) => (
        <span
          key={i}
          style={{
            // Domed profile — rounder than a linear taper, without the flat
            // top a true circle would give at this few steps.
            width: `${widthVw * (1 - ((steps - 1 - i) / steps) ** 2) ** 0.9}vw`,
            height: `${heightVh / steps}vh`,
            background: color,
          }}
        />
      ))}
    </span>
  );
}

/** Sun or moon, stepped the same way as the hills so it stays on-style. */
function Disc({ size, color }: { size: number; color: string }) {
  const rows = 5;
  return (
    <span className="flex flex-col items-center" aria-hidden>
      {Array.from({ length: rows }, (_, i) => {
        // Chord width of a circle at this row's midpoint.
        const t = (i + 0.5) / rows;
        return (
          <span
            key={i}
            style={{
              width: Math.round(size * Math.sqrt(1 - (2 * t - 1) ** 2)),
              height: size / rows,
              background: color,
            }}
          />
        );
      })}
    </span>
  );
}

function Cloud({ scale, drift, delay }: { scale: number; drift: number; delay: number }) {
  const px = (n: number) => Math.round(n * scale);
  return (
    <span
      className="flex"
      style={{ animation: `cloud-float ${drift}s ease-in-out ${delay}s infinite alternate` }}
      aria-hidden
    >
      <span className="bg-white" style={{ width: px(40), height: px(24) }} />
      <span
        className="bg-white"
        style={{ width: px(56), height: px(36), marginLeft: -px(8), marginTop: -px(12) }}
      />
      <span className="bg-white" style={{ width: px(40), height: px(24), marginLeft: -px(8) }} />
    </span>
  );
}

/** Evenly spaced slots across a band, nudged so the spacing never looks ruled. */
function slots(count: number, jitter: number) {
  return Array.from({ length: count }, (_, i) => {
    const wobble = Math.sin(i * 12.9898) * 0.5;
    return { i, pct: ((i + 0.5) / count) * 100 + (wobble * jitter) / count };
  });
}

/**
 * Everything behind the flowers: stars, sun, clouds and rolling hills, each on
 * its own parallax band so walking the field reveals depth.
 */
function Backdrop({
  camera,
  phase,
  screens,
  horizonPct,
  isMobile,
  intro,
}: {
  camera: CameraController;
  phase: SkyPhase;
  /** World width in viewports, used to size each band to its parallax travel. */
  screens: number;
  horizonPct: number;
  isMobile: boolean;
  intro: IntroPhase;
}) {
  /**
   * A band only travels as far as its parallax rate takes it, so it is much
   * narrower than the world. Both its width and how much scenery it holds are
   * measured against that, otherwise a slow band gets the whole world's worth
   * of hills packed into a couple of screens and reads as one solid ridge.
   */
  const bandScreens = (factor: number) => 1 + (screens - 1) * factor;
  const bandWidth = (factor: number) => `${bandScreens(factor) * 100}%`;
  const bandCount = (factor: number, perScreen: number, least: number) =>
    Math.max(least, Math.round(bandScreens(factor) * perScreen));

  const skyPct = 100 - horizonPct;
  const skyScale = skyPct / REFERENCE_SKY_PCT;
  /** Height down the sky, given as a fraction of it, in scene percentage terms. */
  const inSky = (fraction: number) => `${skyPct * fraction}%`;

  return (
    <>
      {/* the stars fade in as one, so each keeps its own twinkle */}
      {phase === "night" && (
        <div className="absolute inset-0" style={entrance(intro, "enter-fade", INTRO.sky)}>
          {[...Array(STAR_COUNT)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-white [animation:twinkle_2.4s_ease-in-out_infinite]"
              style={{
                left: `${(i * 41) % 97}%`,
                top: `${(i * 17) % 45}%`,
                animationDelay: `${(i % 5) * 0.5}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* sun / moon — far enough away that walking never moves it, and low
          enough in the sky to stay clear of the heads-up display */}
      <div
        className="absolute right-[12%]"
        style={{ top: inSky(0.56), ...entrance(intro, "enter-drift", INTRO.sky) }}
      >
        <Disc size={isMobile ? 40 : 60} color={phase === "night" ? "#f0ead6" : "#ffd93d"} />
      </div>

      <ParallaxLayer
        camera={camera}
        factor={CLOUD_FACTOR}
        className="pointer-events-none"
        style={{ width: bandWidth(CLOUD_FACTOR), opacity: phase === "night" ? 0.25 : 0.85 }}
      >
        {slots(bandCount(CLOUD_FACTOR, CLOUDS_PER_SCREEN, 4), 40).map(({ i, pct }) => (
          <span
            key={i}
            className="absolute -translate-x-1/2"
            // Kept below the heads-up display, which owns the top of the sky.
            // The entrance goes on the cloud's slot rather than the cloud
            // itself, which is already busy drifting.
            style={{
              left: `${pct}%`,
              top: inSky(0.32 + (i % 4) * 0.16),
              ...entrance(intro, "enter-drift", INTRO.sky, {
                extraDelay: (i % 4) * INTRO.sky.stagger,
              }),
            }}
          >
            <Cloud scale={0.7 + ((i * 5) % 4) / 8} drift={26 + (i % 4) * 9} delay={-i * 4} />
          </span>
        ))}
      </ParallaxLayer>

      {HILL_BANDS.map((band, bandIndex) => (
        <ParallaxLayer
          key={band.factor}
          camera={camera}
          factor={band.factor}
          className="pointer-events-none"
          style={{ width: bandWidth(band.factor) }}
        >
          {slots(bandCount(band.factor, band.perScreen, 3), 60).map(({ i, pct }) => (
            <span
              key={i}
              className="absolute -translate-x-1/2"
              // Rooted around the grass line so the hills sit behind the field.
              style={{
                left: `${pct}%`,
                bottom: `${horizonPct + band.rootPct}%`,
                ...entrance(intro, "enter-fade", INTRO.hills, {
                  extraDelay: (i % 4) * INTRO.hills.stagger,
                }),
              }}
            >
              <Hill
                widthVw={band.widthVw * (0.75 + ((i * 7) % 5) / 8)}
                heightVh={band.heightVh * skyScale * (0.8 + ((i * 3) % 4) / 6)}
                color={HILL_COLORS[phase][bandIndex]}
              />
            </span>
          ))}
        </ParallaxLayer>
      ))}

      {/* the ground itself is flat colour, so it needs no parallax */}
      <div
        className="absolute inset-x-0 bottom-0 bg-leaf border-t-8 border-leaf-deep"
        style={{ height: `${horizonPct}%`, ...entrance(intro, "enter-ground", INTRO.ground) }}
      />
      <div
        className="absolute inset-x-0 bottom-0 h-[5%] bg-soil border-t-4 border-black/10"
        style={entrance(intro, "enter-ground", INTRO.ground)}
      />
    </>
  );
}

export default memo(Backdrop);
