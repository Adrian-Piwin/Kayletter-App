# Choosing a flower for your garden

Today every letter grows a sunflower. This adds five more flowers — rose, tulip,
daisy, lily, lavender — and lets a **premium** author pick which one their garden
grows. Free authors see all six and can select only the sunflower.

A second, unrelated change ships alongside it: signing in lands you on `/notes`
rather than the landing page.

## Scope

The choice belongs to the **letter**, not the note: one flower type per garden,
set in the dashboard's "Garden settings" card. A field of one species reads as a
garden; a field of six reads as a seed catalogue, and per-note choice would need
UI on every note card for a decision nobody makes twice.

Heights do not change per species. `garden-layout.ts` is untouched: the same
`STAGE_HEIGHT` and depth ramp apply whichever flower is planted, so a lavender
garden lays out exactly like a sunflower one.

## The catalogue

`src/lib/flowers.ts` is the single source of truth, consumed by the picker, the
renderer and the API validator:

```ts
export const FLOWERS = {
  sunflower: { label: "Sunflower", free: true },
  rose:      { label: "Rose" },
  tulip:     { label: "Tulip" },
  daisy:     { label: "Daisy" },
  lily:      { label: "Lily" },
  lavender:  { label: "Lavender" },
} as const;
```

with `FlowerType`, `DEFAULT_FLOWER = "sunflower"`, `isFlowerType()` and
`flowerSprite(type, stage)`. Order in the record is the order in the picker.

## Sprites

15 new PNGs at `public/sprites/flowers/<type>-<stage>.png`. The three existing
sunflower files move into the same directory so there is one convention; the
landing page's three references follow.

Generated with `create_image_pixflux`, per the recipe in
[pixellab-notes.md](../../pixellab-notes.md):

- **Forced palette.** Each flower gets a hand-built palette PNG that keeps the
  sunflower's own green ramp (`#0e4923 → #a8c848`) and stem browns unchanged, and
  swaps only the petal ramp for the species' hue — mid saturation, 3 shading
  steps, outline a darker version of the fill and never near-black. Shared greens
  are what make six species read as one garden.
- **Pixel density.** Each stage is generated at the canvas size of the sunflower
  it stands beside (bloom 174×244, bud 136×219, sprout 109×77), so at the same
  display height it has the same apparent pixel size. Density is the thing that
  makes an asset look like it came from a different game.
- **Four candidates per sprite**, varying seed. Reviewed composited at true
  display height next to the sunflower — not zoomed — then trimmed and
  alpha-hardened before shipping. Budget for throwing candidates away.
- Provenance (job id, seed, canvas, palette, rejects and why) recorded in
  `assets/pixellab/flowers/flowers.json`, matching `props.json`.

## Data

```sql
alter table letters add column if not exists flower_type text not null default 'sunflower';
```

as a new file in `supabase/migrations/`, mirrored into `supabase/schema.sql`. No
check constraint: the catalogue lives in the app, and an unknown value read back
falls back to the sunflower rather than failing the page.

`Letter` gains `flower_type`; `updateLetter` accepts it alongside title and pet
name.

## Rendering

`RecipientPage` passes `letter.flower_type` to `GardenScene`, which passes it to
`FlowerField`; the `Sprite` name becomes `flowers/${type}-${stage}`. A value not
in the catalogue renders as sunflower.

## The picker, and the gate

In "Garden settings", a row of six swatches, each the flower's bloom sprite over
its name. The selected one carries the card's pixel border; the rest are plain.

Every author sees all six. For a free author the five paid ones render dimmed
with a small lock badge, and clicking one does not select it — it tracks
`flower_locked_clicked` and reveals an inline "Unlock every flower — $1" button
wired to the existing `/api/checkout`. Selection is saved by the existing **Save
settings** button, through the existing `PATCH /api/letter`.

The gate that matters is server-side: `PATCH /api/letter` validates
`flower_type` against the catalogue (400 if unknown) and rejects any non-free
flower from a non-premium author with **402**, the same status the note limit
uses. The dimmed swatch is a convenience, not the enforcement.

A premium author who somehow lost premium keeps whatever is already planted —
the gate is on writing, not on reading, so a garden never silently reverts.

## Sign-in redirect

`SignInButton` and `SignUpButton` on the landing page get
`forceRedirectUrl="/notes"` (exact prop confirmed against the installed Clerk
v7). `/` itself remains reachable while signed in, so the landing page can still
be seen and shared.

## Testing

The project has no test runner, so verification is by exercise, matching how the
pig work was checked:

- Sprites reviewed as a composited contact sheet at true display height, each
  species against the sunflower.
- `npm run build` and `npx tsc --noEmit` clean.
- Manually: free account sees six swatches with five locked, clicking a locked
  one shows the upgrade button and does not change the selection; a direct
  `PATCH /api/letter {flower_type:"rose"}` from a free account returns 402;
  premium account saves a rose and the recipient garden grows roses at all three
  stages; sign-in from the landing page lands on `/notes`.
