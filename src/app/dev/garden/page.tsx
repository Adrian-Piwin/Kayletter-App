"use client";

import { useCallback, useMemo, useState } from "react";

import GardenScene from "@/components/garden/GardenScene";
import type { SkyPhase } from "@/components/garden/Backdrop";
import { FLOWERS, FLOWER_TYPES, type FlowerType } from "@/lib/flowers";
import type { Note } from "@/lib/types";

const SKIES: SkyPhase[] = ["day", "sunset", "night"];

/**
 * How old each note's `read_at` is made, and so which stage its flower grows to.
 * The thresholds live in `garden-layout.ts` (bud at 24h, bloom at 72h); these sit
 * clear of them on either side so a choice here is never a coin flip.
 */
const AGES = {
  sprout: () => 1,
  bud: () => 36,
  bloom: () => 120,
  /** What a real garden looks like: mostly grown, with recent arrivals at the front. */
  mixed: (i: number, n: number) => (n <= 1 ? 120 : (1 - i / (n - 1)) * 200),
} as const;
type AgeMix = keyof typeof AGES;

const HOUR_MS = 3_600_000;

/**
 * Whether a letter is waiting, and how long it has been waiting for.
 *
 * A garden has a letter ready when its newest note was read more than
 * `UNLOCK_INTERVAL_MS` ago and an unread one is queued behind it, so these are
 * expressed as an age floor on the read notes rather than as a flag — that is
 * the actual shape of the state, and faking it any other way would let the
 * sandbox show a garden the product cannot produce.
 *
 * The coupling is real and worth knowing: growth stage is read off the *same*
 * `read_at`, so a garden with a letter ready cannot also be all sprouts. A
 * sprout means you read it under 24h ago, which is exactly when the next letter
 * is not due yet.
 */
const LETTER = {
  none: null,
  /** Last read comfortably over the 24h cadence, so the pig brings it now. */
  ready: 25,
  /** Read 18h ago — 6h still on the countdown. */
  waiting: 18,
} as const;
type LetterState = keyof typeof LETTER;

/**
 * Note counts worth looking at rather than a free slider. `planField` earns depth
 * from the count — rows are added only as there are flowers to fill them — so the
 * interesting values are the ones either side of a row being added, not every
 * integer in between. 45 is a desktop screenful; 200 is a garden years deep.
 */
const COUNTS = [0, 1, 3, 8, 20, 45, 120, 200];

/** Read notes are the planted ones — `planField` only plants those. */
function makeNotes(
  count: number,
  mix: AgeMix,
  favourites: boolean,
  letter: LetterState,
  now: number
): Note[] {
  const floor = LETTER[letter];
  const notes: Note[] = Array.from({ length: count }, (_, i) => {
    const raw = mix === "mixed" ? AGES.mixed(i, count) : AGES[mix]();
    // The floor applies to every note, not just the newest, because the cadence
    // keys off the *most recent* read — one fresher note would cancel it.
    const hours = floor === null ? raw : Math.max(raw, floor);
    return {
      id: `dev-${i}`,
      letter_id: "dev",
      content: `Sandbox note ${i + 1}.`,
      position: i,
      created_at: new Date(now - hours * HOUR_MS).toISOString(),
      read_at: new Date(now - hours * HOUR_MS).toISOString(),
      // Favourites grow the tallest flower, so a few is enough to see the effect.
      is_favorite: favourites && i % 5 === 0,
    };
  });

  // The letter itself: unread, so it grows no flower until it is opened.
  if (letter !== "none") {
    notes.push({
      id: "dev-letter",
      letter_id: "dev",
      content: "This is the letter the pig is carrying.",
      position: count,
      created_at: new Date(now).toISOString(),
      read_at: null,
      is_favorite: false,
    });
  }
  return notes;
}

export default function GardenDevPage() {
  const [flower, setFlower] = useState<FlowerType>("sunflower");
  const [sky, setSky] = useState<SkyPhase>("day");
  const [count, setCount] = useState(20);
  const [mix, setMix] = useState<AgeMix>("mixed");
  const [favourites, setFavourites] = useState(false);
  const [letter, setLetter] = useState<LetterState>("none");
  const [open, setOpen] = useState(true);

  // Frozen once. `serverNow` is meant to be the SSR timestamp, and a clock that
  // advanced would re-plan the field underneath whatever is being looked at.
  const [now] = useState(() => Date.now());
  const notes = useMemo(
    () => makeNotes(count, mix, favourites, letter, now),
    [count, mix, favourites, letter, now]
  );

  /**
   * Stands in for `POST /api/l/<token>/unlock`, which would 404 here.
   *
   * Returning the note marked read is the whole contract: the scene swaps it in,
   * the ceremony lands, and the letter becomes a fresh sprout at the front of the
   * field — the same thing a real unlock does, without a row to write.
   */
  const unlock = useCallback(async () => {
    const next = notes.find((n) => n.read_at === null);
    return next ? { ...next, read_at: new Date().toISOString() } : null;
  }, [notes]);

  // GardenScene seeds its own state from `initialNotes`, so a changed prop alone
  // would not reach it — remounting is the honest way to re-seed, and it replays
  // the opening sequence, which is worth seeing anyway.
  const sceneKey = `${flower}-${sky}-${count}-${mix}-${favourites}-${letter}`;

  return (
    <>
      <GardenScene
        key={sceneKey}
        token="dev-sandbox"
        title="Sandbox garden"
        petName="Pig"
        flower={flower}
        initialNotes={notes}
        initialPet={{ happiness: 80, hunger: 30, tricks_unlocked: 4 }}
        serverNow={now}
        dev={{ sky, unlock }}
      />

      {/*
       * Floated over the scene rather than laid out beside it: GardenScene's root
       * is `fixed h-svh`, so it owns the viewport no matter what wraps it.
       * Collapsible because the bar sits where the garden keeps its own title and
       * mailbox, and the point of the sandbox is to look at the garden.
       */}
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed top-2 left-2 z-50 rounded border-2 border-ink bg-cream px-2 py-1 font-pixel text-xs"
        >
          dev
        </button>
      ) : (
        <div className="fixed inset-x-0 top-0 z-50 flex flex-wrap items-center gap-x-6 gap-y-2 border-b-2 border-ink bg-cream/95 px-4 py-2 font-sans text-sm text-ink">
          <span className="font-pixel text-xs">garden</span>

          <Group label="flower">
            {FLOWER_TYPES.map((f) => (
              <Chip key={f} on={f === flower} onClick={() => setFlower(f)}>
                {FLOWERS[f].label}
              </Chip>
            ))}
          </Group>

          <Group label="sky">
            {SKIES.map((s) => (
              <Chip key={s} on={s === sky} onClick={() => setSky(s)}>
                {s}
              </Chip>
            ))}
          </Group>

          <Group label="notes">
            {COUNTS.map((c) => (
              <Chip key={c} on={c === count} onClick={() => setCount(c)}>
                {c}
              </Chip>
            ))}
          </Group>

          <Group label="growth">
            {(Object.keys(AGES) as AgeMix[]).map((m) => (
              <Chip key={m} on={m === mix} onClick={() => setMix(m)}>
                {m}
              </Chip>
            ))}
          </Group>

          <Group label="letter">
            {(Object.keys(LETTER) as LetterState[]).map((l) => (
              <Chip key={l} on={l === letter} onClick={() => setLetter(l)}>
                {l}
              </Chip>
            ))}
          </Group>

          <Chip on={favourites} onClick={() => setFavourites((v) => !v)}>
            ★ favourites
          </Chip>

          <span className="ml-auto flex items-center gap-3 text-xs opacity-60">
            <a className="underline" href="/dev/pig">
              pig clips →
            </a>
            pet actions will fail (no such letter)
          </span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded border border-ink/20 px-2 py-1 text-xs hover:bg-ink/5"
          >
            hide
          </button>
        </div>
      )}
    </>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-xs opacity-50">{label}</span>
      {children}
    </div>
  );
}

function Chip({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded border px-2 py-1 text-xs ${
        on ? "border-ink bg-ink text-cream" : "border-ink/20 hover:bg-ink/5"
      }`}
    >
      {children}
    </button>
  );
}
