# Flower Types Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a premium author choose which of six flowers their garden grows, with five new species drawn to match the existing sunflower.

**Architecture:** A catalogue module (`src/lib/flowers.ts`) is the single source of truth for the six types; `letters.flower_type` stores the choice; the dashboard picker writes it through the existing `PATCH /api/letter`, which enforces premium server-side; `FlowerField` reads it to pick sprite paths. Sprites are generated with PixelLab against hand-built palettes that keep the sunflower's green ramp.

**Tech Stack:** Next.js 16 (App Router), React 19, Clerk v7, Postgres via `postgres` (Supabase), Tailwind v4, PixelLab MCP, Python 3 + Pillow for sprite post-processing.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-07-flower-types-design.md`.
- **Read `node_modules/next/dist/docs/` before writing Next.js code** — this Next version has breaking changes (per `AGENTS.md`).
- No test runner exists in this repo. Verification is `npx tsc --noEmit`, `npm run build`, `npm run lint`, and named manual exercises. Do not invent a test framework.
- Flower ids, exact strings: `sunflower`, `rose`, `tulip`, `daisy`, `lily`, `lavender`. Stages, exact strings: `sprout`, `bud`, `bloom`.
- Sprite path convention: `public/sprites/flowers/<type>-<stage>.png`. All six species live there, sunflower included.
- Free flower: `sunflower` only. Gate status code for a non-premium author asking for a paid flower: **402** (matches the note limit).
- Sprite generation follows `docs/pixellab-notes.md`: forced palette via `color_image`, canvas matched to the sunflower stage it replaces, four candidates per sprite, trim + alpha-harden before shipping, provenance recorded.

---

### Task 1: Generate and ship the flower sprites

**Files:**
- Create: `scripts/flowers/palettes.py` (builds one palette PNG per species)
- Create: `scripts/flowers/finish.py` (trim, alpha-harden, contact sheet)
- Create: `public/sprites/flowers/<type>-<stage>.png` × 18
- Create: `assets/pixellab/flowers/flowers.json` (provenance)
- Delete: `public/sprites/sunflower-{sprout,bud,bloom}.png` (moved via `git mv`)

**Interfaces:**
- Produces: 18 sprite files at `public/sprites/flowers/<type>-<stage>.png`, every one trimmed to its artwork with alpha hardened to 0 or 255.

- [ ] **Step 1: Move the sunflower sprites**

```bash
mkdir -p public/sprites/flowers
git mv public/sprites/sunflower-sprout.png public/sprites/flowers/sunflower-sprout.png
git mv public/sprites/sunflower-bud.png    public/sprites/flowers/sunflower-bud.png
git mv public/sprites/sunflower-bloom.png  public/sprites/flowers/sunflower-bloom.png
```

- [ ] **Step 2: Build a palette PNG per species**

`scripts/flowers/palettes.py` writes an 8-swatch PNG per species. Greens and stem
browns are copied verbatim from the sunflower's own ramp so every garden shares a
stem; only the petal ramp changes:

```python
GREENS = ["#0e4923", "#397530", "#4e8934", "#76aa38", "#a8c848"]
PETALS = {
    "rose":     ["#8c1f3a", "#c23a56", "#e46a80", "#f8b7c2"],
    "tulip":    ["#a32a2f", "#d84b3f", "#f27a4e", "#fbc06d"],
    "daisy":    ["#c9962a", "#f6d64a", "#fdf3d6", "#ffffff"],
    "lily":     ["#b8683f", "#e89a5c", "#fbd9b0", "#fffaf0"],
    "lavender": ["#4b2d7a", "#7a52b8", "#a985dd", "#d8c6f2"],
}
```

Each palette is `GREENS[0], GREENS[2], GREENS[4]` plus the four petal steps plus
`#894929` (the sunflower's stem brown) — 8 colours, which is what the notes say
holds cleanly. Write to `assets/pixellab/flowers/palette-<species>.png`.

Run: `python3 scripts/flowers/palettes.py`
Expected: five PNGs written, each 8×1 px.

- [ ] **Step 3: Submit generation jobs**

For each species × stage, call `mcp__pixellab__create_image_pixflux` with the
stage canvas (`bloom` 174×244, `bud` 136×219, `sprout` 109×77), `no_background=True`,
`view="side"`, `outline="single color outline"`, `shading="basic shading"`,
`color_image_base64` = that species' palette, and a description naming a single
stem, e.g. `"one rose on a single green stem, side view, layered petals, two
leaves"`. Four seeds per sprite. Rate limit is 8 jobs in flight — submit in
batches of 8, then collect.

- [ ] **Step 4: Pick candidates at true display size**

`scripts/flowers/finish.py` composites every candidate for a stage at its display
height (`sprout` 34px, `bud` 66px, `bloom` 92px — from `STAGE_HEIGHT` in
`src/lib/garden-layout.ts`) beside the sunflower of the same stage, and writes
`docs/previews/flowers-<stage>.png`. Judge at that size, not zoomed. Regenerate
any sprite whose silhouette does not read at 34px.

- [ ] **Step 5: Trim, harden, ship**

`finish.py` also, for the chosen candidate: hardens alpha to 0/255, drops
detached pixel islands, trims to the artwork bounding box, and writes
`public/sprites/flowers/<type>-<stage>.png`.

Run: `python3 scripts/flowers/finish.py`
Expected: 15 new files; `python3 -c "from PIL import Image; ..."` reports no
partial alpha.

- [ ] **Step 6: Record provenance and commit**

Write `assets/pixellab/flowers/flowers.json` in the shape of
`assets/pixellab/props/props.json`: per sprite the job id, seed, canvas,
description, palette, and a `rejected` block saying which candidates lost and why.

```bash
git add public/sprites/flowers assets/pixellab/flowers scripts/flowers docs/previews
git commit -m "Draw five more flowers to match the sunflower"
```

---

### Task 2: The flower catalogue

**Files:**
- Create: `src/lib/flowers.ts`
- Modify: `src/app/page.tsx` (three `Sprite name="sunflower-*"` references)
- Modify: `src/components/garden/FlowerField.tsx` (sprite name only)

**Interfaces:**
- Produces:
  - `type FlowerType = "sunflower" | "rose" | "tulip" | "daisy" | "lily" | "lavender"`
  - `FLOWERS: Record<FlowerType, { label: string; free?: true }>` — insertion order is picker order
  - `DEFAULT_FLOWER: FlowerType`
  - `isFlowerType(value: unknown): value is FlowerType`
  - `isFreeFlower(type: FlowerType): boolean`
  - `flowerSprite(type: FlowerType, stage: FlowerStage): string` → e.g. `"flowers/rose-bloom"`
  - `asFlowerType(value: string | null | undefined): FlowerType` — unknown values fall back to `DEFAULT_FLOWER`

- [ ] **Step 1: Write the catalogue**

```ts
import type { FlowerStage } from "./garden-layout";

/** Every flower a garden can grow. Order here is the order in the picker. */
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

/** Only the sunflower is free; the rest are part of the $1 upgrade. */
export function isFreeFlower(type: FlowerType): boolean {
  return "free" in FLOWERS[type];
}

/** A stored value, trusted only as far as the catalogue. */
export function asFlowerType(value: string | null | undefined): FlowerType {
  return isFlowerType(value) ? value : DEFAULT_FLOWER;
}

export function flowerSprite(type: FlowerType, stage: FlowerStage): string {
  return `flowers/${type}-${stage}`;
}
```

- [ ] **Step 2: Update the moved sunflower references**

In `src/app/page.tsx` the footer renders `sunflower-bloom`, `sunflower-bud` and
`sunflower-sprout`; each becomes `flowers/sunflower-<stage>`. In
`FlowerField.tsx`, `name={`sunflower-${flower.stage}`}` becomes
`name={flowerSprite(type, flower.stage)}` once Task 5 threads `type` through —
for now change it to `flowers/sunflower-${flower.stage}` so the app is never
broken between tasks.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean. Then `npm run dev` and confirm the landing page footer still
draws its flowers.

- [ ] **Step 4: Commit**

```bash
git add src/lib/flowers.ts src/app/page.tsx src/components/garden/FlowerField.tsx
git commit -m "Add the flower catalogue"
```

---

### Task 3: Store the choice

**Files:**
- Create: `supabase/migrations/20260807120000_letters_flower_type.sql`
- Modify: `supabase/schema.sql` (the `letters` table)
- Modify: `src/lib/types.ts` (`Letter`)
- Modify: `src/lib/data.ts` (`updateLetter`)

**Interfaces:**
- Consumes: `FlowerType` from Task 2.
- Produces: `Letter.flower_type: string`; `updateLetter(letterId, ownerClerkId, { title?, pet_name?, flower_type? })`.

- [ ] **Step 1: Write the migration**

```sql
-- Which flower a garden grows. Premium authors can change it; everyone else
-- keeps the sunflower.
alter table letters
  add column if not exists flower_type text not null default 'sunflower';
```

Add the same column to the `letters` block in `supabase/schema.sql`.

- [ ] **Step 2: Apply it**

Run it against the database the same way `20260802120000_pet_last_petted_at.sql`
was applied (Supabase SQL editor or `psql "$DATABASE_URL" -f <file>`).
Expected: `select flower_type from letters limit 1;` returns `sunflower`.

- [ ] **Step 3: Widen the type and the update**

`Letter` gains `flower_type: string` (string, not `FlowerType` — it is whatever
the database holds, and readers narrow it with `asFlowerType`).

In `updateLetter`, add the third coalesced field:

```ts
fields: { title?: string; pet_name?: string; flower_type?: string }
...
      flower_type = coalesce(${fields.flower_type ?? null}, flower_type),
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add supabase src/lib/types.ts src/lib/data.ts
git commit -m "Store which flower a garden grows"
```

---

### Task 4: Enforce the gate on the server

**Files:**
- Modify: `src/app/api/letter/route.ts`

**Interfaces:**
- Consumes: `isFlowerType`, `isFreeFlower` (Task 2); `updateLetter` (Task 3).

- [ ] **Step 1: Validate and gate**

After the existing title/petName parsing, before the update:

```ts
  let flowerType: string | undefined;
  if (body.flower_type !== undefined) {
    if (!isFlowerType(body.flower_type)) {
      return NextResponse.json({ error: "Unknown flower" }, { status: 400 });
    }
    // The dimmed swatch in the picker is a courtesy; this is the actual gate.
    if (!isFreeFlower(body.flower_type) && !ctx.profile.is_premium) {
      return NextResponse.json({ error: "Upgrade to plant this flower" }, { status: 402 });
    }
    flowerType = body.flower_type;
  }
```

Pass `flower_type: flowerType` into `updateLetter`, and add
`changed_flower: flowerType !== undefined` plus `flower: flowerType` to the
`letter_settings_saved` PostHog event.

- [ ] **Step 2: Verify by exercise**

With the dev server running and signed in as a **free** author:

```bash
curl -i -X PATCH localhost:3000/api/letter -H 'Content-Type: application/json' \
  -b "<session cookie>" -d '{"flower_type":"rose"}'
```
Expected: `HTTP/1.1 402`. With `{"flower_type":"daffodil"}`: `400`. With
`{"flower_type":"sunflower"}`: `200`.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/letter/route.ts
git commit -m "Gate paid flowers behind the upgrade"
```

---

### Task 5: Grow the chosen flower

**Files:**
- Modify: `src/app/l/[token]/page.tsx`
- Modify: `src/components/garden/GardenScene.tsx`
- Modify: `src/components/garden/FlowerField.tsx`

**Interfaces:**
- Consumes: `asFlowerType`, `flowerSprite`, `FlowerType` (Task 2); `Letter.flower_type` (Task 3).
- Produces: `GardenScene` prop `flower: FlowerType`; `FlowerField` prop `flower: FlowerType`.

- [ ] **Step 1: Thread the type through**

`RecipientPage` passes `flower={asFlowerType(letter.flower_type)}`. `GardenScene`
takes `flower: FlowerType` and hands it to `<FlowerField flower={flower} ... />`.
`FieldBand` takes it too, and the sprite becomes:

```tsx
            <Sprite
              name={flowerSprite(flower, flower_stage_here)}
              alt={`a ${FLOWERS[flower].label.toLowerCase()} grown from a letter`}
              height={placement.heightPx}
            />
```

Note `FlowerField` is `memo`'d — `flower` is a string, so the memo still works
without a comparator.

- [ ] **Step 2: Verify by exercise**

Set a letter's `flower_type` to `rose` directly in the database, open its
`/l/<token>` page, and confirm roses grow at all three stages (a note read
minutes ago is a sprout, one read 2 days ago a bud, a favourite a bloom).
Expected: no 404s in the network panel for `/sprites/flowers/rose-*.png`.

- [ ] **Step 3: Commit**

```bash
git add src/app/l src/components/garden
git commit -m "Grow the garden's chosen flower"
```

---

### Task 6: The picker

**Files:**
- Create: `src/components/dashboard/FlowerPicker.tsx`
- Modify: `src/components/dashboard/Dashboard.tsx` (Garden settings section, `saveSettings`, state)
- Modify: `src/app/notes/page.tsx` (nothing — `letter` already carries the new column)

**Interfaces:**
- Consumes: `FLOWERS`, `FLOWER_TYPES`, `FlowerType`, `isFreeFlower`, `flowerSprite`, `asFlowerType` (Task 2).
- Produces: `<FlowerPicker value onChange isPremium onLockedClick />`.

- [ ] **Step 1: Write the picker**

A `<fieldset>` of six swatches. Each is a `<button type="button">` showing the
species' **bloom** sprite at 48px over its label. The selected one gets the
project's pixel border (`border-2 border-ink shadow-[3px_3px_0_0_var(--ink)]`);
the rest get `border-2 border-transparent`. A locked swatch renders at
`opacity-50` with a `🔒` badge, carries `aria-disabled` (not `disabled`, so it
stays focusable and explains itself), and calls `onLockedClick()` instead of
`onChange()`.

- [ ] **Step 2: Wire it into Garden settings**

Add `const [flower, setFlower] = useState(asFlowerType(letter.flower_type))` to
`Dashboard`, render `<FlowerPicker>` inside the settings card under the two text
inputs, and add `flower_type: flower` to the `saveSettings` PATCH body. On a 402
response show the toast `"Upgrade to plant that flower"` and reset the selection
to `asFlowerType(letter.flower_type)`.

`onLockedClick` sets a `showFlowerUpsell` state that reveals, under the picker,
an "Unlock every flower — $1" `PixelButton` calling the existing `upgrade()`, and
tracks `flower_locked_clicked` with `{ flower }`. Track `flower_selected` with
`{ flower }` on a successful change.

- [ ] **Step 3: Verify by exercise**

Signed in as a free author: six swatches show, five dimmed with a lock; clicking
a locked one leaves the selection alone and reveals the upgrade button; saving
still works. As a premium author: clicking a swatch selects it, **Save settings**
persists it, a reload keeps it, and the recipient garden grows it.

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard
git commit -m "Let premium authors pick their garden's flower"
```

---

### Task 7: Land on /notes after signing in

**Files:**
- Modify: `src/components/LandingCtas.tsx`

- [ ] **Step 1: Confirm the prop**

Check the installed Clerk version's docs for `SignInButton` / `SignUpButton`
redirect props before writing (`node_modules/@clerk/nextjs` types, or
`grep -r "forceRedirectUrl" node_modules/@clerk/types/dist/index.d.ts`). Use
whatever that version names it; do not guess from memory.

- [ ] **Step 2: Set it on both buttons**

`SignInButton` gets `forceRedirectUrl="/notes"`; `SignUpButton` gets
`forceRedirectUrl="/notes"`. Both are modal-mode, so the redirect happens on
completion without leaving the page first.

- [ ] **Step 3: Verify by exercise**

Sign out, click **Sign in** on the landing page, complete it: the app lands on
`/notes`. Repeat with **Write your first note** and a new account. Then visit `/`
while signed in and confirm the landing page still renders.

- [ ] **Step 4: Commit**

```bash
git add src/components/LandingCtas.tsx
git commit -m "Send authors to their notes after signing in"
```

---

## Self-Review

**Spec coverage:** catalogue → Task 2; sprites and their generation recipe →
Task 1; `flower_type` column → Task 3; server-side 402 gate → Task 4; garden
rendering with sunflower fallback → Tasks 2 and 5; picker with locked swatches
and inline upsell → Task 6; sign-in redirect → Task 7; verification commands →
each task's exercise step.

**Placeholders:** none — every code step carries its actual content, and the one
lookup left open (Task 7's prop name) is deliberate, because guessing a Clerk API
from memory is what the constraint forbids.

**Type consistency:** `FlowerType`, `FlowerStage`, `flowerSprite`, `asFlowerType`,
`isFreeFlower` and `isFlowerType` are named identically in Tasks 2, 4, 5 and 6.
`Letter.flower_type` is `string` everywhere and narrowed only at the edges.
