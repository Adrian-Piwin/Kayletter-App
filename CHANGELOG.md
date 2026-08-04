# Changelog

## [0.3.0] - 2026-08-04

### Animate the pig from a generated sprite sheet and add petting

The pig now breathes, walks, eats, plays, does tricks, and leans into being rubbed — all drawn from one sprite sheet instead of a handful of stills.

#### Changes
- Replace the static pig images with 20 animation clips packed into a single atlas, so the pig moves everywhere it appears (garden, landing page, dashboard, 404).
- Add petting: rub the pig with a cursor or a dragged finger for a little happiness, with a server-side cooldown so the public endpoint can't be farmed.
- Feeding now sets a strawberry on the ground in front of the snout, crouches the pig to it, and flicks crumbs on each chew.
- Redraw the strawberry to match the pig's palette and pixel size — the old one was drawn far too finely for the size it displays at.
- Add a repeatable pipeline (`npm run sprites`) that turns PixelLab output into the atlas and a typed manifest.

##### **garden**
- `PigActor` picks its clip from mood, hunger, and the current action, with occasional idle flourishes; blinking is rare on purpose.
- Rub detection lives in `useRubGesture` (travel and direction-change thresholds, quiet timer) and suppresses the click that would otherwise open a letter.
- The camera ignores pointers on elements marked `data-no-pan`, so dragging on the pig no longer pans the field.
- Food and crumbs ride a shared anchor with the pig and sit at `snoutOffset()`, measured off the sprite rather than nudged by eye.
- Action visuals are scheduled from the click, not the API reply, so a slow round-trip can't stretch one part of the timeline past another.

##### **sprites**
- `scripts/pig/` composes clips from one canonical pose: inpainted feature patches for faces, code-driven squash/lift/rotation for body motion. The build asserts patch footprints are disjoint and don't bleed outside their mask.
- The build exports frame counts, timings, looping, and the frames where the jaw shuts, so the app never restates them.
- `Sprite` sets `max-w-none`: a height-sized image inside an absolutely positioned wrapper was collapsing to zero width.

##### **pet**
- New `pet` action and `last_petted_at` column, with a migration.

##### **docs**
- `docs/pixellab-notes.md` on what does and doesn't work when generating pixel art, and `docs/pig-sprite-rework.md` for how each clip is produced.

## [0.2.0] - 2026-08-02

### Add a parallax scrolling flower field for gardens of any size

Gardens now grow into a walkable field — swipe or drag to wander, with the pig staying on screen while depth layers slide past.

#### Changes
- Plan flowers across depth rows so five letters sit in view and hundreds stretch into a multi-screen field.
- Pan by swipe, drag, wheel, or arrow keys; drop the edge scroll arrows.
- Keep a clear path for the pig so flowers only partially overlap it.
- Zoom the mobile scene in (taller grass, larger sprites) and centre the title on desktop.
- Root backdrop hills under the grass line so they no longer float.

##### **garden**
- New layout planner, camera controller, and parallax layers (`Backdrop`, `FlowerField`, `FieldNav`, intro timing).
- Pig walks with scroll direction; HUD and progress bar stay fixed while the world moves.
- Local seed script for tiny / small / medium / huge test gardens.

##### **shared**
- `useElementWidth` for live scene measurement.
- Entrance and cloud-float animations in global CSS.

### Fix the garden opening never ending, leaving the pig walking on the spot

A debug value shipped in place of the opening sequence's real length, so the scene never finished arriving.

#### Changes
- Restore the opening to 1.85s so the garden drops its entrance styles once the sequence is over.

##### **garden**
- Pig settles into its idle bob on arrival instead of cycling walk frames for ten minutes.
