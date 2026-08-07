"use client";

import { memo } from "react";
import Sprite from "@/components/Sprite";
import ParallaxLayer from "./ParallaxLayer";
import { entrance, INTRO, type IntroPhase } from "@/lib/garden-intro";
import { REVEAL } from "@/lib/letter-reveal";
import { FLOWERS, flowerSprite, type FlowerType } from "@/lib/flowers";
import type { FieldLayout, FieldRow } from "@/lib/garden-layout";
import type { CameraController } from "./useCamera";
import type { Note } from "@/lib/types";

/** A few blades of grass, sized to the row's depth. */
function GrassTuft({ scale }: { scale: number }) {
  const blade = Math.max(1, Math.round(2 * scale));
  const tall = Math.max(4, Math.round(10 * scale));
  return (
    <span className="flex items-end" style={{ gap: blade }} aria-hidden>
      <span className="bg-leaf-deep/60" style={{ width: blade, height: tall * 0.6 }} />
      <span className="bg-leaf-deep/60" style={{ width: blade, height: tall }} />
      <span className="bg-leaf-deep/60" style={{ width: blade, height: tall * 0.7 }} />
    </span>
  );
}

/**
 * Sprouts a flower as part of the opening wave, given how far across the first
 * screen of its band it stands. The camera rests at the left edge on load, so
 * anything past that screen is off stage and simply fades in with its row.
 */
function sproutStyle(stagePct: number, intro: IntroPhase) {
  if (stagePct > 100) return undefined;
  return entrance(intro, "enter-sprout", INTRO.flower, {
    extraDelay: (stagePct / 100) * INTRO.flower.sweep,
  });
}

/**
 * The flower a letter just opened is planted the moment that letter is read,
 * because the mailbox count and the pig's envelope both depend on it. It is
 * kept out of sight until the reveal has finished with it, so it can break
 * ground in front of the reader instead of appearing behind the open card.
 */
export type Sprouting = { noteId: string; playing: boolean };

function newFlowerStyle({ playing }: Sprouting) {
  return playing
    ? { animation: `enter-sprout ${REVEAL.sprouting.duration}ms ease-out both` }
    : { visibility: "hidden" as const };
}

function FieldBand({
  row,
  depthIndex,
  flower,
  camera,
  onOpen,
  intro,
  sprout,
}: {
  row: FieldRow;
  /** Position of the row from the back of the field, which orders its entrance. */
  depthIndex: number;
  /** Species the whole garden grows. */
  flower: FlowerType;
  camera: CameraController;
  onOpen: (note: Note) => void;
  intro: IntroPhase;
  sprout: Sprouting | null;
}) {
  return (
    <ParallaxLayer
      camera={camera}
      factor={row.factor}
      className="pointer-events-none"
      style={{
        width: `${row.widthScreens * 100}%`,
        zIndex: row.zIndex,
        // Only the band's opacity is animated: the camera owns its transform.
        ...entrance(intro, "enter-fade", INTRO.row, {
          extraDelay: depthIndex * INTRO.row.stagger,
        }),
      }}
    >
      {row.tufts.map((tuft, i) => (
        <span
          key={i}
          className="absolute -translate-x-1/2"
          style={{ left: `${tuft.xPct}%`, bottom: `${tuft.bottomPct}%` }}
        >
          <GrassTuft scale={tuft.scale} />
        </span>
      ))}

      {row.flowers.map((placement) => (
        <div
          key={placement.note.id}
          className="absolute -translate-x-1/2 origin-bottom"
          style={{
            left: `${placement.xPct}%`,
            bottom: `${placement.bottomPct}%`,
            ...(sprout?.noteId === placement.note.id
              ? newFlowerStyle(sprout)
              : sproutStyle(placement.xPct * row.widthScreens, intro)),
          }}
        >
          <button
            // A drag across the field shouldn't count as tapping the flower it ended on.
            onClick={() => !camera.suppressClick() && onOpen(placement.note)}
            // Tabbing through the letters walks the camera along with it.
            onFocus={(e) =>
              e.currentTarget.matches(":focus-visible") &&
              camera.revealAt(placement.xPct, row.widthScreens, row.factor)
            }
            className="pointer-events-auto block origin-bottom cursor-pointer hover:brightness-110 touch-manipulation"
            style={
              placement.sways
                ? { animation: `sway 4s ease-in-out ${placement.swayDelay}s infinite` }
                : undefined
            }
            title="re-read this letter"
            aria-label="re-read this letter"
          >
            <Sprite
              name={flowerSprite(flower, placement.stage)}
              alt={`a ${FLOWERS[flower].label.toLowerCase()} grown from a letter`}
              height={placement.heightPx}
            />
            {placement.note.is_favorite && (
              <span
                className="absolute left-1/2 -translate-x-1/2 text-pig-deep leading-none"
                style={{
                  bottom: placement.heightPx,
                  fontSize: Math.max(9, placement.heightPx * 0.14),
                }}
              >
                ♥
              </span>
            )}
          </button>
        </div>
      ))}
    </ParallaxLayer>
  );
}

/**
 * Every delivered letter as a flower, spread across the depth rows of the
 * field. One species for the whole garden, chosen by its author. Memoised
 * because the scene above it re-renders on a one-second clock.
 */
function FlowerField({
  layout,
  flower,
  camera,
  onOpen,
  intro,
  sprout = null,
}: {
  layout: FieldLayout;
  flower: FlowerType;
  camera: CameraController;
  onOpen: (note: Note) => void;
  intro: IntroPhase;
  sprout?: Sprouting | null;
}) {
  return layout.rows.map((row, i) => (
    <FieldBand
      key={row.depth}
      row={row}
      depthIndex={i}
      flower={flower}
      camera={camera}
      onOpen={onOpen}
      intro={intro}
      sprout={sprout}
    />
  ));
}

export default memo(FlowerField);
