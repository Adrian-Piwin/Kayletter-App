import type { FlowerStage } from "./garden-layout";

/**
 * Every flower a garden can grow. Order here is the order they appear in the
 * picker, and only the sunflower is free — the rest come with the $1 upgrade.
 */
export const FLOWERS = {
  sunflower: { label: "Sunflower", free: true },
  rose: { label: "Rose" },
  tulip: { label: "Tulip" },
  daisy: { label: "Daisy" },
  lily: { label: "Lily" },
  lavender: { label: "Lavender" },
} as const satisfies Record<string, { label: string; free?: true }>;

export type FlowerType = keyof typeof FLOWERS;

/** What a garden grows until its author picks something else. */
export const DEFAULT_FLOWER: FlowerType = "sunflower";

export const FLOWER_TYPES = Object.keys(FLOWERS) as FlowerType[];

export function isFlowerType(value: unknown): value is FlowerType {
  return typeof value === "string" && value in FLOWERS;
}

export function isFreeFlower(type: FlowerType): boolean {
  return "free" in FLOWERS[type];
}

/**
 * A value out of the database, trusted only as far as the catalogue: a garden
 * planted with a flower this build no longer knows about grows sunflowers
 * rather than breaking the page.
 */
export function asFlowerType(value: string | null | undefined): FlowerType {
  return isFlowerType(value) ? value : DEFAULT_FLOWER;
}

/** Sprite name for `Sprite`, which resolves it under /sprites. */
export function flowerSprite(type: FlowerType, stage: FlowerStage): string {
  return `flowers/${type}-${stage}`;
}
