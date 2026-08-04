# Pig sprite rework — real animation sheets

Status: **Shipped — all catalogue clips via PixelLab in `pig-v2` atlas**
Owner: agent + Adrian
Target version: `0.3.0` (new user-facing capability)

Replaces the old 8 one-off pig PNGs and CSS-transform "animations" with a
PixelLab-generated sprite sheet: one atlas (`public/sprites/pig/pig-v2.png`),
uniform 189×199 frames, a generated manifest, and a small runtime that plays
named clips. Rebuild with `npm run sprites`.

**Decisions taken:** keep the current pig's look exactly (no style variants);
4 trick animations, one per entry in `TRICKS`; petting grants +1 happiness on a
60s server-side cooldown; the landing page, 404 and dashboard pig all move to
the new art in the same pass.

---

## 1. Where we are today

| Thing | Today | Problem |
|---|---|---|
| Art | 8 separate PNGs, AI-generated then background-removed (`scripts/process-sprites.py`) | 43–63 colours each, soft/fringed edges, no shared palette |
| Frame size | Every file different (185×204 … 211×162) | The pig visibly jumps size and baseline between states |
| Scale | Rendered at `height: 102/110px` from ~199px sources | Non-integer downscale — the pixels are already mush |
| Idle | CSS `bob` translateY on the wrapper `<button>` | One motion, reads as "sticker on a spring" |
| Walk | `setInterval` toggling `pig-walk1`/`pig-walk2` every 170ms | 2 frames, no contact/pass poses, moonwalks against the 2500ms slide |
| Tricks | CSS `rotate()` on the DOM node | Rotating pixel art off-axis = interpolated blur; `dance` has no visual and reuses spin |
| Feed / sit / sad | Single static PNG held for 1.4–2s | Dead air |
| Petting | Does not exist | — |

Everything funnels through two places, which is what makes this tractable:
`src/components/Sprite.tsx` (renderer) and the `pigSprite` ternary in
`src/components/garden/GardenScene.tsx`.

---

## 2. Approach — keep the pig, rebuild how it moves

The style is **locked to the existing pig**. Nothing about its design changes;
what changes is that it becomes real pixel art on a real grid, and gains a rig.

Three steps, each with a script and a preview:

**Trace** (`trace.py`) — the shipped PNGs were drawn at 4×, so a "pixel" is a 4×4
block. Downscale to the native grid, snap every pixel to the 8-colour ramp the
art already uses, drop semi-transparent fringe, then re-register all eight poses
on one canvas with a shared ground line and centre column. Result: the same pig,
8 colours instead of 43–63, no baseline jump.

**Cut** (`parts.py`) — the traced idle is one merged blob, so there is nothing to
pose until it is taken apart. Every opaque pixel is claimed by exactly one of
nine parts, which makes recomposition lossless *by construction*: stack the parts
at rest and you get the traced pig back pixel for pixel. `verify()` asserts that
on every run, so a bad mask cannot reach the sheet.

**Pose** (`clips.py`) — a frame is a per-part pixel offset. Whole pixels only: no
rotation, no scaling. Any resample would smear the art straight back into the
mush the tracer just cleaned up.

Expressions that a translation cannot produce — a blink, an ear flick, a happy
squint — are **hand-drawn part variants** that get swapped in, which is how real
sprite sheets do it anyway. See §4.

### What the rig can and cannot move

Learned the hard way, each one from a visible seam:

| Move | Safe? | Why |
|---|---|---|
| Whole pig, any direction | yes | It is a translate; nothing can tear |
| Body + face + tail over planted legs | yes | Reads as a crouch or a rise, and the legs are what should stay put |
| Legs sliding ±2px | yes | Body colour is painted behind them, so they reveal belly |
| Snout, eye, blush drifting ±1–2px | yes | Same backfill — they reveal cheek |
| Tail | yes | It sticks into open air; nothing depends on it |
| **Ears moving on their own** | **no** | The far ear is drawn *behind* the body, so any relative move bites a notch out of the head outline. The near ear is welded to the head on a diagonal the body cannot be painted behind, so lifting it opens a gap at the base. Ear motion needs drawn variants |

The backfill rule that makes most of this work: repaint the body underneath every
part, but **only** one step inside the silhouette, and **only** for parts drawn
in front of the body. The first clause stops a part that swings over open air
from leaving a pig-coloured ghost; the second stops the body being painted over
the tail and the far ear.

### Tooling

- **`pixel-art-sprites` skill** — silhouette-first, limited palette, integer
  scaling, "4 great frames beat 12 mediocre ones". Its `sharp_edges` and
  `validations` references became the build checks in §7.
- **Pillow** — the drawing engine. Preview GIFs so clips get reviewed as
  *motion*, not as stills.

---

## 3. Frame contract (locked — `scripts/pig/frame.py`)

| Spec | Value | Why |
|---|---|---|
| Frame | **64 × 64 px**, uniform, transparent | Traced pig is ~51×51; leaves room for ears, a reaching snout and some lift |
| Ground line | **y = 57** | Every pose puts its feet here, so the pig never floats between clips |
| Anchor x | **32** | No lateral jitter when clips change |
| Display scale | **2× everywhere** → 128px box, pig ≈ 100px | Integer only. Optically matches today's 102/110px and drops the mobile/desktop split |
| Palette | **8 colours, build-enforced** | The ramp the art already uses. No black — the darkest line is a deep pink |
| Alpha | Strictly 0 or 255 | No halos over the sky gradient or grass |
| Big vertical travel | Per-frame offset in the manifest, not baked into the frame | A backflip arc can be as tall as it likes while frames stay tight |

---

## 4. Animation catalogue

Frame counts follow the skill's guidance — key poses over in-betweens.
✅ = built and previewable today.

### How each clip is produced

#### Why generating whole clips fails on this character

The pig is a **blob**: head and body are one round mass, no neck, stub legs. Ask
a model for "lowers its head and chews" and there is nothing to articulate, so
you get one of two failures — it barely moves, or it invents a *different pig*.
`edit_image` on the idle pose with "lower the head, open the mouth" came back
with a giant round body and stubby legs; nothing about the character survived.

What does read as an action here is a **small drawn change to one feature** over a
**whole-body lean or turn**. That splits the work along the line each tool is
actually good at, and it is the strategy every redone clip uses.

#### The strategy: inpaint features, compose clips

1. **Author feature patches with `inpaint_image`, never `edit_image`.** Mask one
   feature on `pig-idle.png` and describe what fills it. Everything outside the
   mask is frozen, so the body cannot drift. Register the job id in
   `scripts/pig/faces.py`.
2. **Keep only the region you asked for.** Inpainting still leaked ~150 changed
   pixels outside the mask, so `faces.py` keeps just that region and asserts zero
   drift elsewhere. Outside its footprint each patch is byte-identical to the idle
   pose — that is what pins the pig's size across every clip.
3. **Keep less than you generate.** The mask sent to the model and the region kept
   from the result are separate knobs. This face is tiny, so a mask tight enough
   to leave the eye alone is too tight for the model to draw a decent open mouth
   in. `mouth_open` is generated with the whole `face` box and then has `eye`
   reverted to idle: the model gets room to draw, and a frame that only opens the
   mouth cannot restyle the eye. That failure was visible — a `face` mask clipping
   the eye came back with the round eye redrawn as a slit.
4. **One patch per feature, footprints disjoint.** A frame layers the patches it
   needs (`mouth_open`, or `eye_shut`, or both) and `faces.py` fails the build if
   two footprints overlap, so layering order can never matter.
5. **Compose the clip from patches + body poses.** A frame is a set of patches
   plus a `Pose` in `derive.py`. No AI in the loop, so timing is tunable in
   seconds rather than minutes.
6. **Bookend with the idle pose.** A one-shot clip starts and ends on `idle`, so
   it settles into `idle_breathe` with no snap, and the scene can hold the last
   frame as long as it likes.
7. **Reuse patches across the swing.** `open → chew → open` is two generations and
   reads as two chomps. Going out and back through the same poses is free and
   lands exactly where it started.

| Kind | Clips | How |
|---|---|---|
| Composed | feed (2), `trick_spin`, `trick_backflip`, `play_roll` | No generation per clip — feature patches and/or the idle pose under a per-frame `Pose` |
| Generated | idle + `walk` | PixelLab, 4 frames, a numbered instruction per frame |
| Posed *(legacy)* | play (chase/bounce), sit, dance, pet | Generated frames with gross motion layered on. Weakest path — candidates for redoing as Composed |

Rules that keep the pig from changing size or shape mid-clip:

- **A crouch is a squash, and it has to commit.** A blob has no neck to bend, so
  bending down to the food is a vertical squash anchored at the feet: `scale_y=0.90`
  drops the top of the head ~20px and the snout ~10px, which reads as intent. A
  shallow 0.93 reads as a rendering glitch — the same distortion with none of the
  meaning. There is no room to widen in compensation (187px sprite, 189px frame),
  so squashes are vertical only.
- **At most two drawings of any one feature per clip, alternating.** A third snout
  reads as the face changing shape rather than the mouth working, which is why the
  chew beat closes the eye over the *idle* snout instead of drawing a new one.
- **Every source is cropped to the idle pose's bounding box**, never its own, so a
  patch whose open mouth juts further down does not shift the whole pig.
- **Lifts need headroom the idle pose does not have.** Its silhouette is 197px in
  a 199px frame, so any real lift trips the fit guard and shrinks the pig ~1%.
  That is why the tricks pair a lift with a constant `scale`, and the feed clips
  do not lift at all.
- **Rotations stick to multiples of 90°.** The idle pose's diagonal is 272px
  against a 189×199 frame, so a 45° turn would have to shrink ~30%.

Pipeline, one-directional — `npm run sprites` runs all four:

```
public/sprites/pig-idle.png    the base pose
assets/pixellab/faces/raw/     inpaint results, cached
  -> faces.py                  keeps each patch's footprint, asserts no drift
assets/pixellab/faces/<p>.png  feature patches
assets/pixellab/raw/<clip>/    generated frames, exactly as downloaded
  -> derive.py                 composes clips / poses generated frames
assets/pixellab/clips/<clip>/  what the atlas is packed from
  -> build.py                  pig-v2.png + pig-anim.generated.ts
```

Because both derive steps read from cached inputs, nothing downstream is lost by
re-running, and re-downloading a clip never loses its posing.

#### Feature patches

Boxes are measured off the idle pose — `python3 scripts/pig/faces.py --preview`
draws them over the sprite at `docs/previews/pig-mask-regions.png`.

| Region | Box (x, y, w, h) | Covers |
|---|---|---|
| `face` | (4, 66, 66, 74) | Snout, mouth area, eye, blush |
| `eye` | (52, 74, 26, 32) | The eye alone, 1px margin on its dark pixels |
| `legs` | (30, 140, 130, 59) | All four legs |

| Patch | Generated with | Kept | Content |
|---|---|---|---|
| `mouth_open` ✅ | `face` | `face` minus `eye` | Snout with the mouth wide open, tongue showing |
| `eye_shut` ✅ | `eye` | `eye` | Eye closed to a short curved line, a contented squint |

Nothing about this is specific to faces. `legs` is registered and unused because
it is what `trick_sit` needs: the pig reads as sitting once the hind legs are
drawn folded, which no amount of rotating the whole body achieves.

### Idle — a resting loop plus flourishes

| Clip | Frames | fps | Loop | Description |
|---|---|---|---|---|
| `idle_breathe` ✅ | 8 | 6 | ∞ | Swells up off the legs, tail drifting on its own beat |
| `idle_sniff` ✅ | 12 | 8 | once | Crouches into the grass, nose twitches, straightens up |
| `idle_look` ✅ | 16 | 8 | once | Leans forward for a glance, settles back |
| `idle_blink` ✅ | 4 | 8 | once | Quick blink |
| `idle_scratch` ✅ | 8 | 7 | once | Sits back, hind leg scratches behind the ear |

A scheduler holds `idle_breathe` and injects a random flourish every 4–9s. That's
what makes a pet read as alive rather than looped.

### Mood + state idles

| Clip | Frames | Replaces |
|---|---|---|
| `idle_sad` ✅ | 4 | head low, ears drooped, slow tail |
| `idle_hungry` ✅ | 4 | tummy rumble, stares at you |
| `idle_letter` ✅ | 6 | holds the envelope, wiggles, taps a hoof |

The traced `pig-sad`, `pig-sit`, `pig-happy`, `pig-eat` and `pig-envelope` poses
are already registered on the shared grid, so these clips animate *around* an
existing drawn pose rather than being invented from scratch.

### Walk

| Clip | Frames | fps | Loop |
|---|---|---|---|
| `walk` ✅ | 8 | ~8 | ∞ |

Contact → pass → contact → pass over a one-pixel bob, tail counter-swinging.
Frame duration is **scaled to actual travel speed** (`PIG_WALK_MS` 2500 vs
`PIG_STEP_MS` 900) so the legs stop moonwalking.

### Feed (2) — picked by hunger, not at random

| Clip | Frames | When |
|---|---|---|
| `feed_munch` ✅ | 8 composed, loops | Normal hunger — crouches to the strawberry, two chomps, straightens |
| `feed_gobble` ✅ | 8 composed, loops | `hunger ≥ 70` — dives deeper and leans further, three chomps |

The mouth alternates open/closed so it reads as chewing, and the eye only closes
on the chew beats, so the frames that open the mouth keep the idle eye exactly.
The crouch comes from `scale_y` ramping to 0.88 (0.86 for gobble) and back, which
brings the snout down to the strawberry — already at mouth height, since the berry
renders ~34px against the pig's ~110px. The four middle frames all hold the crouch:
the bend only reads if the pig *stays* down long enough to be seen chewing there.

Both clips **loop** on an identical 8 × 150ms cycle, and `actionHoldMs("eat")` is
two whole cycles. Holding a multiple of the cycle is what keeps the pig from being
yanked out of the crouch mid-chew — every cycle boundary is the upright idle pose.

#### The strawberry

Drawn with PixelLab against a palette derived from the pig, at a canvas size that
gives it the pig's on-screen pixel density — see
[pixellab-notes.md](./pixellab-notes.md), which is where the reasoning lives.
`assets/pixellab/props/props.json` records the job, seed and palette so it can be
regenerated.

It is a **sibling of the pig, not a child of it**. The pig sits at its own depth in
the field, so flowers rooted nearer are painted over it, and its `z-index` makes it
a stacking context that nothing inside can climb out of — the food just hid behind a
sunflower. It rides the shared `pigAnchor`, so it tracks the walk transition, and
stacks with the hearts, the other transient action feedback.

Its horizontal offset comes from `snoutOffset()` in `pig-display.ts`, measured off
the sprite (the snout occupies x 0-42 of 189, so the berry centres 5% in from the
leading edge) rather than nudged by eye, and mirrors with `pigFlip` so it is always
the side the pig faces. The feed clips lean the pig the rest of the way in. It
clears on `actionHoldMs("eat")`, the same constant that returns the pig to idle, so
the food never outlives the chewing.

Note the trap that kept it invisible: an `<img>` sized only by `height` inside an
absolutely positioned (shrink-to-fit) wrapper collapses to **zero width**, because
preflight's `max-width: 100%` has no resolved parent width to measure against.
`Sprite` now sets `max-w-none`, which fixes it for every sprite.

#### Munch crumbs

Small coloured squares flung from the snout on each chew, in the berry's own
palette, arcing out and dropping (`crumb-fly` in `globals.css`, one keyframe driven
by per-crumb custom properties). They spawn through `spitCrumbs`, which mirrors
`burstHearts`.

The beats are not hand-timed. `derive.py` records which frames close the jaw
(`chomp_frames`), `build.py` carries them into the manifest as `chomps`, and
`chompTimes()` turns them into offsets for as long as the clip is held. Re-cutting
or retiming a feed clip moves the crumbs with it.

### Play (3)

| Clip | Frames | Description |
|---|---|---|
| `play_chase` ✅ | 4 posed | Fast excited trot with a run bob — pairs with the back-and-forth `movePig` |
| `play_bounce` ✅ | 5 posed | Crouch, hop clear of the ground, land squash |
| `play_roll` ✅ | 6 rotated | Tips onto its back, hooves wiggle, rights itself |

`play_chase` while travelling, one of the other two at the far end of the run.

### Tricks (4 — one per `TRICKS` entry)

| Clip | Frames | Description |
|---|---|---|
| `trick_spin` ✅ | 7 rotated | Turn read as a horizontal squeeze through edge-on, mirrored past 90° |
| `trick_backflip` ✅ | 6 rotated | Crouch, quarter-turns around a jump arc, land squash |
| `trick_sit` ✅ | 5 posed | Front lifts over a planted rear — the one place a shallow rotation earns its shrink |
| `trick_dance` ✅ | 5 posed | Hops side to side |

### Petting (new)

| Clip | Frames | Loop |
|---|---|---|
| `pet_enjoy` ✅ | 4 posed | ∞ |
| `pet_end` ✅ | 5 posed | once |

Eyes squeeze shut, head tilts into the rub, tail wags fast, hind leg thumps.
Hearts drip while it runs; `pet_end` is a happy shake-off back to idle.

### Drawn variants still needed

Transforms move pixels; they cannot invent them. Anything a squash or a lean
cannot express has to be *drawn*, which now means an `inpaint_image` patch
registered in `faces.py` — see [Feature patches](#feature-patches), not the
hand-authored ASCII stamps this plan originally assumed.

| Patch | Region | Unlocks |
|---|---|---|
| `mouth_open` ✅, `eye_shut` ✅ | `face`, `eye` | feed (both clips) |
| `legs_folded` | `legs` | `trick_sit` — the pig only reads as sitting once the hind legs are drawn folded under it |
| `eye_happy`, `ear_back` | `eye`, ears | petting, dance |
| `leg_lift`, `leg_reach` | `legs` | a walk with real leg articulation rather than a slide |

Current atlas: **134 frames** across 20 clips, packed 12-wide at 2268 × 2388 px.

---

## 5. Sheet + manifest

```
public/sprites/pig/pig-v2.png     one atlas, 12 cols × 64px frames
src/lib/pig-anim.generated.ts     typed manifest (do not hand-edit)
```

Generated TypeScript rather than fetched JSON — zero runtime requests, and clip
names become a union type, so a typo in the state machine is a compile error:

```ts
export const PIG_SHEET = { src: "/sprites/pig/pig-v2.png", frame: 64, cols: 12, scale: 2 } as const;
export const PIG_CLIPS = {
  idle_breathe: { start: 0, frames: 8, ms: 166, loop: true },
  walk:         { start: 8, frames: 4, ms: 125, loop: true },
  // …
} as const;
export type PigClip = keyof typeof PIG_CLIPS;
```

Atlas filename carries `-v2` so no CDN or browser cache can serve stale art.

---

## 6. Runtime architecture

```
src/components/SpriteSheet.tsx           frame renderer (background-position)
src/lib/useSpriteAnimation.ts            clip playback hook
src/components/garden/PigActor.tsx       the pig: clip choice, idles, petting, click
src/lib/pig-clips.ts                     pure PigState + mood → PigClip mapping
src/lib/pig-anim.generated.ts            build output
```

- **`SpriteSheet`** — a `<div>` with `background-image`, `background-size:
  (cols×64×2)px`, `background-position: -(col×128)px -(row×128)px`,
  `image-rendering: pixelated`. GPU-cheap, one decode, no per-frame DOM churn.
  `Sprite.tsx` stays as-is for the static one-offs (strawberry, sunflowers) so
  nothing else regresses.
- **`useSpriteAnimation(clip, { speed, onComplete })`** — steps the frame index,
  handles `loop`/one-shot, pauses on `visibilitychange`, and honours
  `prefers-reduced-motion` by holding a representative frame. **This matters:**
  the global reduced-motion rule in `globals.css` only silences CSS, so JS
  stepping has to opt out itself.
- **`PigActor`** — owns clip selection, the idle-flourish scheduler, facing,
  petting, and the open-letter button. Lifts ~80 lines out of `GardenScene`
  (already 500 lines) and gives the pig one clear home.
- **Motion comes from frames, not transforms.** All pig CSS keyframes (`bob`,
  `spin-once`, `backflip`) get deleted; the wrapper keeps only `left`
  positioning, the sprite layer keeps only `scaleX(-1)` for facing. One transform
  owner, no stacking surprises. The "a letter for you!" label keeps its `bob`.

### Petting gesture

Implemented in `src/lib/useRubGesture.ts`.

1. A mouse rubs by **hovering**, no button held — that is what stroking with a
   cursor feels like. Touch and pen have no hover, so they rub by holding and
   dragging.
2. It takes 44px of travel **and** two changes of direction, so a pointer merely
   crossing the pig on its way somewhere else stays quiet.
3. Past the threshold → `pet_enjoy`, kept alive by continued movement, then
   `pet_end` after 420ms of stillness.
4. The pig carries `data-no-pan` and the camera's `pointerdown` skips that
   subtree. Without it, panning calls `setPointerCapture` the moment the drag
   threshold trips and steals the pointer mid-stroke — the field scrolls and the
   pig never reacts. `stopPropagation` cannot fix this: React listens at the
   root, so the camera's native listener has already run by then.
5. The pig is never given the `disabled` attribute — a disabled button stops
   receiving pointer events, which kills a rub as it starts. Petting also
   deliberately does **not** set the scene's pig state, since that marks the pig
   busy and disables the very element being rubbed.
6. A stroke suppresses the click, so a rub never opens the letter by accident.
7. +1 happiness per session with a 60s server-side cooldown — `/api/l/[token]/pet`
   is a public token-only endpoint and would otherwise be farmable.

---

## 7. Scripts + automated checks

```
scripts/pig/frame.py          the frame contract - one source of truth
scripts/pig/download_clips.py completed PixelLab jobs -> raw/
scripts/pig/faces.py          inpaint jobs -> faces/ (masked rect only, no drift)
scripts/pig/derive.py         faces/ + idle + raw/ -> clips/
scripts/pig/build.py          clips/ -> atlas + typed manifest
```

`npm run sprites` will run the whole chain. It **fails** on:

- more than 8 colours in the atlas (palette drift),
- any pixel with alpha not in {0, 255} (halo risk),
- any frame crossing the 64px bounds or missing the y=57 ground line,
- a manifest/atlas frame-count mismatch,
- parts that no longer recompose into the traced source.

Two checks already run on every build: `parts.verify()` (recomposition is exact)
and a hole audit (no frame opens a gap the resting silhouette did not have).

---

## 8. Phases

| Phase | Deliverable | Checkpoint |
|---|---|---|
| **0. Style** ✅ | Decided: keep the existing pig exactly | Done |
| **1. Trace + rig** ✅ | `frame/palette/trace/parts/clips/zoom.py`; 8 poses traced to 8 colours on one grid; 9-part rig, lossless; `idle_breathe`, `idle_sniff`, `idle_look`, `walk` | **You review the previews** |
| **2. Drawn variants** | Eyes, ears, mouth, tuck and turn bodies as ASCII stamps; part-swap support in the poser | You approve the blink + ear flick |
| **3. Author clips** | All ~120 frames; preview GIFs per clip | You review the contact sheet |
| **4. Atlas + manifest** | `build.py`, `pig-v2.png`, `pig-anim.generated.ts`, `npm run sprites` | Checks pass |
| **5. Runtime** | `SpriteSheet`, `useSpriteAnimation`, `pig-clips.ts` | Typecheck + lint clean |
| **6. Wire the garden** | `PigActor`, `GardenScene` swap, petting, old keyframes removed | Feels right on desktop + mobile |
| **7. App-wide + cleanup** | Landing hero, 404, dashboard card on sheet frames; old 8 pig PNGs deleted; changelog + `0.3.0` | Nothing still points at the old art |

Phase 7 is not optional polish — if the landing page keeps the old pig, two art
styles sit side by side.

### Reviewing what exists now

```bash
python3 scripts/pig/trace.py     # docs/previews/traced-sheet.png  (today vs traced)
python3 scripts/pig/parts.py     # docs/previews/parts-map.png     (the nine parts)
python3 scripts/pig/clips.py     # docs/previews/clip-*.gif + clips-contact.png
python3 scripts/pig/zoom.py walk 1   # docs/previews/zoom.png
```

---

## 9. Risks

| Risk | Mitigation |
|---|---|
| Non-integer scaling blurs everything | 2× fixed, single source of truth in the manifest; no `height:` sizing on the pig |
| A mask edits the art by accident | `parts.verify()` — recomposition must be pixel-exact |
| A pose tears the silhouette | Hole audit per frame against the resting baseline |
| Reduced-motion users get animation anyway | Explicit handling in the hook — CSS override can't reach JS stepping |
| Rub fights the field drag on touch | `touch-action: none` on the pig + `stopPropagation` |
| Rub fires the open-letter click | Movement threshold suppresses the click |
| Petting farmed for happiness | Server-side cooldown |
| Stale atlas from CDN cache | Versioned filename |
| Palette drifts as clips get added | 8-colour cap in the build |
| Clip and travel speed desync | Walk frame time derives from the actual movement duration |
| Translation alone is too stiff for tricks | Drawn part variants (§4) — the rig was never going to rotate a spin |
