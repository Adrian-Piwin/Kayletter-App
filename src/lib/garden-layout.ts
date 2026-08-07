import type { Note } from "./types";

/* ------------------------------------------------------------------ *
 * Flower growth
 * ------------------------------------------------------------------ */

export type FlowerStage = "sprout" | "bud" | "bloom";

const HOUR_MS = 3_600_000;
/** Hours a letter must have been read before its flower reaches each stage. */
const STAGE_AGE_HOURS = { bud: 24, bloom: 72 };
const STAGE_HEIGHT: Record<FlowerStage, number> = { sprout: 34, bud: 66, bloom: 92 };
/** Favourited letters grow the tallest sunflower. */
const FAVORITE_HEIGHT = 110;

/** How far along a letter's sunflower is. Favourites bloom straight away. */
export function flowerStage(note: Note, now: number): FlowerStage {
  const ageHours = note.read_at ? (now - new Date(note.read_at).getTime()) / HOUR_MS : Infinity;
  if (note.is_favorite || ageHours > STAGE_AGE_HOURS.bloom) return "bloom";
  return ageHours > STAGE_AGE_HOURS.bud ? "bud" : "sprout";
}

/** Sprite height in px at full (front row) size, before depth scaling. */
export function flowerHeight(stage: FlowerStage, isFavorite: boolean): number {
  return stage === "bloom" && isFavorite ? FAVORITE_HEIGHT : STAGE_HEIGHT[stage];
}

/* ------------------------------------------------------------------ *
 * Field layout
 * ------------------------------------------------------------------ */

/**
 * The garden is a side-scrolling world made of depth rows. Every row is wider
 * than the viewport and slides at its own parallax rate, so the back of the
 * field drifts slowly while the front rushes past. A row's band is only as wide
 * as its parallax rate lets it travel, which guarantees every flower in it can
 * be brought on screen by scrolling from one end of the world to the other.
 */
const FIELD = {
  // A phone shows the garden closer up: the grass takes most of the frame and
  // everything in it is drawn larger, so flowers and pig stay comfortably
  // tappable on a screen a third the width of a desktop one.
  mobile: {
    // As many rows as the desktop field, despite the narrower screen: the deep
    // grass band needs them to fill it, or the rows stand too far apart and the
    // field reads as a lawn with a few flowers dotted over it.
    rows: 5,
    /** Where the grass starts, as a fraction of scene height measured from the bottom. */
    horizon: 0.65,
    /** Baseline of the nearest row, same units. */
    nearBottom: 0.1,
    /** Horizontal gap between neighbouring flowers at full size, in px. */
    spacing: 140,
    /** Every sprite in the field is scaled by this on small screens. */
    sizeScale: 0.85,
    /** Empty margin kept at each end of a row, as a percentage of the band. */
    margin: 6,
    /** Grass tufts scattered per screen-width of each row. */
    tuftsPerScreen: 20,
    /** Roughly how many flowers fill one screen — sets how fast the field grows. */
    flowersPerScreen: 12,
    /** Nominal viewport used for the very first (pre-measurement) render. */
    nominalWidth: 390,
    nominalHeight: 844,
  },
  desktop: {
    rows: 5,
    horizon: 0.5,
    nearBottom: 0.075,
    spacing: 175,
    sizeScale: 1,
    margin: 4,
    tuftsPerScreen: 20,
    flowersPerScreen: 45,
    nominalWidth: 1280,
    nominalHeight: 800,
  },
} as const;

/** Sprite scale at the very back of a full field, and at the front of one. */
const DEPTH_SCALE = { min: 0.4, max: 1.15 };
/**
 * Scroll rate from far to near depth, chosen so a full field's rate is exactly
 * 1 at the pig's depth — the pig holds its place on screen while the world
 * slides past, which is what makes it read as walking.
 */
const PARALLAX = { min: 0.45, max: 1.236 };
/**
 * Depth the pig stands at: a little back from the front of the field, so it
 * walks through the garden rather than along its near edge, with the nearest
 * row of all still in front of it. `PARALLAX.max` is set from this — the rate
 * here has to come out at exactly 1, so move the two together.
 */
const PIG_DEPTH = 0.7;
/**
 * The pig walks a clear path along the front of the field: the planted rows
 * stop at this depth, leaving the ground between here and the nearest row
 * unplanted. That gap is what stops a flower ever standing fully in front of
 * the pig — the one row beyond the path is rooted low enough (see
 * `FRONT_ROW_REACH`) that its heads only fringe the pig's legs.
 */
const BACK_ROWS_END = 0.615;
/** A field needs this many rows before one of them is spared for the front. */
const ROWS_FOR_A_FRONT_ROW = 3;
/**
 * Depth of that one row ahead of the path. It stops short of the very front of
 * the ramp, so the nearest flowers sit back off the bottom edge of the scene
 * and are drawn a touch smaller instead of looming over it.
 */
const FRONT_ROW_DEPTH = 0.9;
/**
 * How far past the pig's feet the tallest sunflower in the front row may reach,
 * in px at full size — about the height of its legs. The row is rooted from
 * this rather than from the depth ramp alone: its flowers are the biggest in
 * the field, and the ramp on its own leaves the tallest of them climbing well
 * up the pig's body instead of fringing it. Measured in px because that is what
 * a sprite's height is: the ramp works in shares of the scene, so the same drop
 * expressed there would let the overlap grow with the size of the screen.
 */
const FRONT_ROW_REACH = 29;
/**
 * Safety valve on that reach: however tall the flowers or short the screen, the
 * front row is never rooted more than this share of the gap between rows below
 * the ramp, so it can't sink off the bottom of the scene behind the controls.
 */
const FRONT_ROW_MAX_DROP = 0.35;
/**
 * A garden of a few letters is a shallow patch right in front of you rather
 * than a field stretching to the horizon: the back row stays large and close,
 * and the grass takes up a little less of the screen. A sparse field also keeps
 * its front row well clear of the bottom of the screen — with a whole field in
 * front of them the nearest blooms can happily run behind the buttons, but when
 * there are only a handful every one of them has to be visible. These are the
 * shallowest values, eased towards the full-field ones as the rows fill up.
 */
const SHALLOW = {
  scale: 0.8,
  factor: 0.85,
  horizon: { mobile: 0.58, desktop: 0.42 },
  nearBottom: { mobile: 0.22, desktop: 0.17 },
};
/** Only the nearer rows sway; distant flowers are too small for it to read. */
const SWAY_FROM_DEPTH = 0.5;
/** Upper bound on world width, so an enormous garden stays walkable. */
const MAX_SCREENS = 10;
/** Safety valve on DOM size for gardens far beyond any realistic letter count. */
const MAX_FLOWERS = 600;

/** Stage changes are hours apart, so the field only needs re-planning rarely. */
export const FIELD_REFRESH_MS = 600_000;

export type FlowerPlacement = {
  note: Note;
  /** Position across this row's band, as a percentage of the band width. */
  xPct: number;
  /** Distance above the bottom of the scene, as a percentage of its height. */
  bottomPct: number;
  stage: FlowerStage;
  heightPx: number;
  sways: boolean;
  swayDelay: number;
};

export type FieldRow = {
  depth: number;
  /** Fraction of the camera's movement this row travels. */
  factor: number;
  /** Band width as a multiple of the viewport width. */
  widthScreens: number;
  zIndex: number;
  flowers: FlowerPlacement[];
  tufts: { xPct: number; bottomPct: number; scale: number }[];
};

export type FieldLayout = {
  /** World width as a multiple of the viewport width; 1 means nothing to scroll. */
  screens: number;
  rows: FieldRow[];
  /** Where the pig stands and how it stacks against the rows. */
  pig: { bottomPct: number; zIndex: number };
  /** Grass band height as a percentage of scene height. */
  horizonPct: number;
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** `count` evenly spaced values from `from` to `to`, both ends included. */
function spread(count: number, from: number, to: number): number[] {
  return Array.from({ length: count }, (_, i) => from + ((to - from) * i) / (count - 1));
}

/** Stable 0–1 value from a string, so a flower never jumps position between renders. */
function hash01(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

/** Nominal viewport to assume before the scene has been measured. */
export function nominalViewport(isMobile: boolean) {
  const cfg = isMobile ? FIELD.mobile : FIELD.desktop;
  return { width: cfg.nominalWidth, height: cfg.nominalHeight };
}

/**
 * Plans where every read letter's flower grows.
 *
 * The world only grows once a screen is full, so a garden of five letters sits
 * entirely in view with nothing to scroll, while two hundred letters spread
 * into a field several screens wide.
 */
export function planField(
  notes: Note[],
  {
    isMobile,
    viewportWidth,
    viewportHeight,
    now,
  }: { isMobile: boolean; viewportWidth: number; viewportHeight: number; now: number }
): FieldLayout {
  const cfg = isMobile ? FIELD.mobile : FIELD.desktop;
  const planted = notes.length > MAX_FLOWERS ? notes.slice(-MAX_FLOWERS) : notes;
  const count = planted.length;

  // Depth is earned: rows are added only as the garden has flowers to fill
  // them, so a handful of letters stays a shallow patch rather than a few
  // specks scattered over an empty field.
  const fill = clamp(count / cfg.flowersPerScreen, 0, 1);
  const rowsUsed = clamp(Math.round(1 + fill * (cfg.rows - 1)), count >= 3 ? 2 : 1, cfg.rows);
  /** 0 for the emptiest garden, 1 once every row is planted. */
  const density = (rowsUsed - 1) / (cfg.rows - 1);

  const key = isMobile ? "mobile" : "desktop";
  const minScale = lerp(SHALLOW.scale, DEPTH_SCALE.min, density);
  const minFactor = lerp(SHALLOW.factor, PARALLAX.min, density);
  const horizon = lerp(SHALLOW.horizon[key], cfg.horizon, density);
  const nearBottom = lerp(SHALLOW.nearBottom[key], cfg.nearBottom, density);

  const scaleAt = (depth: number) => lerp(minScale, DEPTH_SCALE.max, depth);
  const factorAt = (depth: number) => lerp(minFactor, PARALLAX.max, depth);

  // Only a field with rows to spare gives one up to the front of the path; a
  // shallow one keeps them all behind the pig, as there is no room ahead of it
  // to root a flower low enough to pass it without swallowing it whole.
  const hasFrontRow = rowsUsed >= ROWS_FOR_A_FRONT_ROW;
  /**
   * Depth of each row, far to near. The planted rows crowd into the back of the
   * field and stop at the path; the one row beyond it sits ahead of the pig,
   * just short of the front of the ramp.
   */
  const depths =
    rowsUsed === 1
      ? [PIG_DEPTH]
      : hasFrontRow
        ? [...spread(rowsUsed - 1, 0, BACK_ROWS_END), FRONT_ROW_DEPTH]
        : spread(rowsUsed, 0, 1);

  const usableWidth = viewportWidth * (1 - cfg.margin / 50);

  // How many flowers sit comfortably on one screen, summed across the rows in use.
  const perScreen = depths.reduce(
    (total, depth) => total + Math.max(1, Math.floor(usableWidth / (cfg.spacing * scaleAt(depth)))),
    0
  );
  const screens = clamp(Math.ceil(count / perScreen), 1, MAX_SCREENS);
  /** Flowers in the busiest row, so every row commits to the same spread. */
  const perRow = Math.ceil(count / rowsUsed);

  const topBottomPct = (horizon - 0.035) * 100;
  const nearBottomPct = nearBottom * 100;
  const rowGapPct = (topBottomPct - nearBottomPct) / Math.max(rowsUsed - 1, 1);
  const bottomAt = (depth: number) => lerp(topBottomPct, nearBottomPct, depth);

  const rowsBehindPig = hasFrontRow ? rowsUsed - 1 : rowsUsed;
  // With no row in front of it, the pig leads the field and walks just below
  // the nearest flowers, so an overlap still resolves the way depth says it
  // should. Otherwise it stands on its path, between the field and its front row.
  const pigBottomPct = hasFrontRow ? bottomAt(PIG_DEPTH) : bottomAt(1) - rowGapPct * 0.2;
  /** How far back a flower must stay to leave the pig's path clear. */
  const behindFloorPct = hasFrontRow ? bottomAt(BACK_ROWS_END) : pigBottomPct;

  /** A px measurement as the share of the scene's height it covers. */
  const heightPct = (px: number) => (px / viewportHeight) * 100;
  /** Tallest sunflower the front row can grow, at the size it draws them. */
  const tallestFront = flowerHeight("bloom", true) * scaleAt(FRONT_ROW_DEPTH) * cfg.sizeScale;
  /**
   * Where the front row is rooted. Low enough that even its tallest flower tops
   * out around the pig's legs, but never below the ramp's own baseline (short
   * flowers need no drop) nor so far below it that the row leaves the scene.
   */
  const frontRowBottomPct = clamp(
    pigBottomPct + heightPct(FRONT_ROW_REACH * cfg.sizeScale - tallestFront),
    bottomAt(FRONT_ROW_DEPTH) - rowGapPct * FRONT_ROW_MAX_DROP,
    bottomAt(FRONT_ROW_DEPTH)
  );

  /** Grass scattered across a band, so no stretch of ground reads as bare. */
  const scatterTufts = (
    seedKey: string,
    bottomPct: number,
    spanPct: number,
    scale: number,
    widthScreens: number
  ) => {
    const count = Math.round(widthScreens * cfg.tuftsPerScreen);
    return Array.from({ length: count }, (_, i) => {
      const seed = `${seedKey}:${i}`;
      return {
        xPct: ((i + 0.5) / count) * 100 + (hash01(seed) - 0.5) * (120 / count),
        bottomPct: bottomPct + (hash01(`${seed}y`) - 0.5) * spanPct,
        scale: scale * (0.7 + hash01(`${seed}s`) * 0.9),
      };
    });
  };

  const rows: FieldRow[] = [];
  for (const [row, depth] of depths.entries()) {
    const factor = factorAt(depth);
    const scale = scaleAt(depth) * cfg.sizeScale;
    const widthScreens = 1 + (screens - 1) * factor;
    const behindPig = row < rowsBehindPig;
    // The front row is rooted off the pig rather than off the ramp, so its
    // grass drops with its flowers and the two stay planted in the same ground.
    const rowBottomPct = behindPig ? bottomAt(depth) : frontRowBottomPct;
    // Rows are painted far to near with the pig and its path slotted in at
    // their own depth, so a flower rooted nearer than the pig passes in front
    // of it instead of the pig punching a hole through it.
    const zIndex = 2 + row + (behindPig ? 0 : 2);

    // Round-robin from the front backwards: letters stay roughly chronological
    // left to right while zig-zagging through depth, and a garden too small to
    // fill every row plants the flowers nearest the viewer first.
    const bucket: Note[] = [];
    for (let i = rowsUsed - 1 - row; i < count; i += rowsUsed) bucket.push(planted[i]);

    // Margins are given in screen terms, so converting them to a share of this
    // row's band keeps the gap at each end the same size on screen however wide
    // the band is — a near row is many screens long, and a percentage of it
    // would open up half a viewport of bare grass.
    const marginPct = cfg.margin / widthScreens;
    // A row with more flowers than it can space out uses its whole band; one
    // with only a few gathers them around the middle, near the pig, rather than
    // flinging them to opposite corners of an empty field.
    const comfortablePct = ((cfg.spacing * scale) / (widthScreens * viewportWidth)) * 100;
    const fullSpan = 100 - marginPct * 2;
    const span = Math.min(fullSpan, Math.max(perRow, 1) * comfortablePct * 1.5);
    const start = (100 - span) / 2;
    const slot = span / Math.max(bucket.length, 1);
    // Offsetting each row breaks up the grid that even spacing would produce.
    const phase = ((row * 0.37) % 1) - 0.5;

    const flowers = bucket.map((note, i) => {
      const stage = flowerStage(note, now);
      const jitter = (hash01(note.id) - 0.5) * slot * 0.5;
      const xPct = clamp(
        start + (i + 0.5 + phase * 0.5) * slot + jitter,
        marginPct * 0.5,
        100 - marginPct * 0.5
      );
      // Vertical jitter keeps a row from reading as a ruled line, but it never
      // carries a flower into the pig's path: those behind stay behind, and the
      // front row only ever wanders further forward, away from the pig.
      const wander = rowBottomPct + (hash01(`${note.id}y`) - 0.5) * rowGapPct * 0.45;
      return {
        note,
        xPct,
        bottomPct: behindPig
          ? Math.max(wander, behindFloorPct)
          : Math.min(wander, rowBottomPct),
        stage,
        heightPx: Math.round(flowerHeight(stage, note.is_favorite) * scale),
        sways: depth >= SWAY_FROM_DEPTH,
        swayDelay: hash01(`${note.id}s`) * 4,
      };
    });

    // Paint the row back to front so a flower never sits on top of one nearer
    // than it when the vertical jitter makes them overlap.
    flowers.sort((a, b) => b.bottomPct - a.bottomPct);

    rows.push({
      depth,
      factor,
      widthScreens,
      zIndex,
      flowers,
      tufts: scatterTufts(String(row), rowBottomPct, rowGapPct * 0.8, scale, widthScreens),
    });
  }

  // The pig's path is unplanted, not bare: it gets a band of grass of its own,
  // travelling at the pig's depth so the ground keeps pace with its walk.
  if (hasFrontRow) {
    const factor = factorAt(PIG_DEPTH);
    const widthScreens = 1 + (screens - 1) * factor;
    rows.push({
      depth: PIG_DEPTH,
      factor,
      widthScreens,
      zIndex: 2 + rowsBehindPig,
      flowers: [],
      tufts: scatterTufts(
        "path",
        pigBottomPct,
        (behindFloorPct - nearBottomPct) * 0.9,
        scaleAt(PIG_DEPTH) * cfg.sizeScale,
        widthScreens
      ),
    });
  }

  return {
    screens,
    rows,
    pig: { bottomPct: pigBottomPct, zIndex: 3 + rowsBehindPig },
    horizonPct: horizon * 100,
  };
}
