# Changelog

## [0.3.0] - 2026-08-05

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


### Fix pig animations with a reliable generation recipe

Clips stay the same pig end to end, the feed is a real bend and chew rather than a squash, and the strawberry matches the art.

#### Changes
- Pin every clip to the idle pose at both ends and draw the whole motion in one PixelLab job, so the pig cannot drift or end as a different character.
- Collapse the two feed clips into one drawn 6-frame loop; drop the pose/squash and mouth-patch path that warped the snout.
- Restyle the strawberry at true display size with a palette that matches the pig (coloured outline, no eye-black edge).
- Standardise on 6 frames (8 for gaits only), clean frames mechanically, and fail the build on strays or partial alpha.
- Root the front flower row from the pig's legs so blooms fringe them instead of climbing the body.

##### **sprites**
- Generated clips use the pinned first+last recipe; compose only for rigid rotations (`trick_spin`, `trick_backflip`, `play_roll`).
- `pixels.py` hardens alpha, drops strays and re-grounds; airborne clips skip re-ground so hops land.
- `review.py` gates `npm run sprites`; chomp beats are measured off the open mouth and carried in the manifest.

##### **garden**
- Single `feed` clip; strawberry always draws 1:1 at 34px.
- Front-row placement uses viewport height so flower reach stays consistent across screens.

##### **docs**
- Document the recipe, frame-count finding, prop styling, and retired patch/squash approaches in the PixelLab and pig-sprite notes.


### Let premium authors pick their garden's flower

Gardens can grow roses, tulips, daisies, lilies or lavender instead of sunflowers, and signing in now lands you on your notes.

#### Changes
- Draw five new flowers at all three growth stages, matched to the sunflower's palette and pixel size.
- Add a flower picker to Garden settings. Everyone sees all six; a free author can plant only the sunflower, and reaching for a locked one offers the $1 upgrade.
- Signing in or signing up from the landing page now goes straight to `/notes` instead of back to the pitch.

##### **garden**
- The field plants whichever species the letter names, falling back to the sunflower for a value the app doesn't recognise, so a garden never breaks.

##### **dashboard**
- `FlowerPicker` shows each species by its bloom sprite; locked ones stay focusable so a keyboard can reach the upgrade they carry.

##### **api**
- `PATCH /api/letter` validates `flower_type` against the catalogue and answers 402 to a non-premium author asking for a paid flower — the dimmed swatch is the shop window, not the lock.

##### **data**
- New `letters.flower_type` column, defaulting to `sunflower`, with a migration.

##### **sprites**
- All flower art moves to `public/sprites/flowers/`, the sunflower included, so there is one convention.
- `scripts/flowers/` builds the forced palettes, cleans the generated art, and composites contact sheets at true display height.

##### **docs**
- Record in the PixelLab notes that a forced palette silently overrides `no_background`, and that a white-petalled subject therefore can't use one.


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
