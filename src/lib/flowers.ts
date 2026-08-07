import type { FlowerStage } from "./garden-layout";

/**
 * Every flower a garden can grow. Order here is the order they appear in the
 * picker, and only the sunflower is free — the rest come with the $1 upgrade.
 *
 * `petals` are sampled from each bloom sprite's own palette — the same trick
 * the strawberry crumbs use — so the burst when a letter opens is made of the
 * flower this particular garden grows. Greens are left out: they read as leaves
 * rather than petals once they are in the air.
 */
export const FLOWERS = {
  sunflower: { label: "Sunflower", free: true, petals: ["#fdd932", "#fdc623", "#fcb91b"] },
  rose: { label: "Rose", petals: ["#de3c3d", "#951517", "#6a0f07"] },
  tulip: { label: "Tulip", petals: ["#d92e28", "#f16f49", "#710120"] },
  daisy: { label: "Daisy", petals: ["#f4f3f3", "#e5e5e2", "#bdbab9"] },
  lily: { label: "Lily", petals: ["#e47891", "#faced5", "#ca4862"] },
  lavender: { label: "Lavender", petals: ["#c497f3", "#9a64d6", "#dac0f3"] },
} as const satisfies Record<string, { label: string; free?: true; petals: readonly string[] }>;

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

/** Colours to throw when this garden's letter is opened. */
export function petalColours(type: FlowerType): readonly string[] {
  return FLOWERS[type].petals;
}

/** Sprite name for `Sprite`, which resolves it under /sprites. */
export function flowerSprite(type: FlowerType, stage: FlowerStage): string {
  return `flowers/${type}-${stage}`;
}
