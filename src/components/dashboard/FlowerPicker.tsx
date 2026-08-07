"use client";

import Sprite from "@/components/Sprite";
import { FLOWERS, FLOWER_TYPES, flowerSprite, isFreeFlower, type FlowerType } from "@/lib/flowers";

/**
 * The six flowers a garden can grow. A free author sees all of them — the point
 * is to show what a dollar buys — but can only plant the sunflower, so the rest
 * are dimmed and locked. Clicking a locked one is not a no-op: it's the moment
 * to offer the upgrade, so it calls back rather than silently doing nothing.
 *
 * The gate itself lives on the server (PATCH /api/letter); this is the shop
 * window, not the lock.
 */
export default function FlowerPicker({
  value,
  onChange,
  isPremium,
  onLockedClick,
}: {
  value: FlowerType;
  onChange: (flower: FlowerType) => void;
  isPremium: boolean;
  onLockedClick: (flower: FlowerType) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm text-ink/70">Flower</legend>
      <div className="flex flex-wrap gap-2">
        {FLOWER_TYPES.map((flower) => {
          const locked = !isPremium && !isFreeFlower(flower);
          const selected = value === flower;
          return (
            <button
              key={flower}
              type="button"
              // Locked swatches stay focusable so a keyboard can reach the
              // upgrade prompt they carry; `disabled` would hide it entirely.
              aria-disabled={locked}
              aria-pressed={selected}
              onClick={() => (locked ? onLockedClick(flower) : onChange(flower))}
              title={locked ? `${FLOWERS[flower].label} — part of the $1 upgrade` : FLOWERS[flower].label}
              className={`relative flex w-[4.5rem] flex-col items-center gap-1 px-1 py-2 cursor-pointer touch-manipulation ${
                selected
                  ? "bg-sunflower/40 border-2 border-ink shadow-[3px_3px_0_0_var(--ink)]"
                  : "border-2 border-transparent hover:bg-cream"
              } ${locked ? "opacity-50" : ""}`}
            >
              <span className="flex h-12 items-end">
                <Sprite name={flowerSprite(flower, "bloom")} alt="" height={48} />
              </span>
              <span className="font-pixel text-[0.65rem] leading-none text-ink">
                {FLOWERS[flower].label}
              </span>
              {locked && (
                <span className="absolute right-0.5 top-0.5 text-xs leading-none" aria-hidden>
                  🔒
                </span>
              )}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
