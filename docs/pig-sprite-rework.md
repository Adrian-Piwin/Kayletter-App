# Pig sprite rework — real animation sheets

Status: **Shipped — every clip generated whole, 6 frames, reviewed clean**
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

**Two approaches were built and abandoned before this one landed** — a nine-part
translation rig, then feature patches composited over squashed bodies. Both are
documented in §4 rather than deleted, because each failed for a reason that is easy
to rediscover, and the second one is the direct cause of the defects this rework was
reopened to fix (a nose that changed shape, a squash standing in for a crouch).

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

The style is **locked to the existing pig**. Nothing about its design changes; what
changes is how it moves.

This section used to describe a nine-part rig — trace the shipped PNGs to a native
grid, cut the idle pose into nine parts, animate by offsetting parts whole-pixel.
**That approach is gone**, along with `trace.py`, `parts.py`, `clips.py` and
`zoom.py`. It was abandoned for a reason worth keeping:

> A translation rig can only move pixels that already exist. The pig is a blob —
> head and body are one round mass, no neck, stub legs — so almost every action worth
> animating needed pixels the idle pose does not contain. The rig could slide the
> tail and the legs, and nothing else. Even ears were off-limits: the far ear is drawn
> *behind* the body, so moving it bites a notch out of the head outline.

So every clip is now generated whole by PixelLab from the canonical pose, and the
only thing kept from the rig era is the frame contract and the discipline around it.
The one place transforms survive is rigid-body rotations, where nothing has to be
invented — see §4.

### Tooling

- **`pixel-art-sprites` skill** — silhouette-first, limited palette, integer
  scaling, "4 great frames beat 12 mediocre ones". Its `sharp_edges` and
  `validations` references became the review checks in §7.
- **PixelLab `animate_image`** — one job per clip. See
  [pixellab-notes.md](./pixellab-notes.md).
- **Pillow** — the cleanup and review engine. Preview GIFs so clips get judged as
  *motion*, not as stills.

---

## 3. Frame contract (locked — `scripts/pig/frame.py`)

| Spec | Value | Why |
|---|---|---|
| Frame | **189 × 199 px**, uniform, transparent | The original pig's native resolution — generations keep it, so nothing is ever resampled |
| Ground line | **y = 198** | Every pose puts its feet here, so the pig never floats between clips |
| Anchor x | **94** (centre) | No lateral jitter when clips change |
| Display height | **110px** desktop, 102px mobile | ~0.55× of source. Non-integer, but the pig is the one sprite big enough to absorb it — small props are authored to render 1:1 instead |
| Alpha | Strictly 0 or 255 | No halos over the sky gradient or grass |
| Palette | The canonical pose's own colours (47 of them) | *Not* the 8-colour ramp in `palette.py` — see §7 |

The contract is only as good as what is fed to it. Three clips in this set were
generated against a differently-sized reference (195×183, 192×201) and the pig inside
them is a *different size*: `idle_sad` and `idle_hungry` measured 4% light and 30px
short, and ground 15px above the grass, because re-grounding aligns to the canvas
bottom and their canvas bottom was in the wrong place. Both have been regenerated.
**Always check the reference is the canonical pose at its exact dimensions** —
`jobs.json` pins one URL for the whole project, and it points at `main`, so it
silently follows the branch.

---

## 4. Animation catalogue

**Every clip is 6 frames.** That is the house standard, settled by generating the
same action at 4, 6 and 8 frames and measuring it — 4 is too short to reach a real
extreme, 8 spends its extra length on in-betweens that average the extremes away.
The reasoning is in [pixellab-notes.md](./pixellab-notes.md).

Frame *duration* is deliberately not standardised: 6 frames describes how the
motion is drawn, `ms` describes tempo, and a sad droop and an excited hop want
different tempos of the same 6-frame shape. 167 ms is the default because it makes
a 6-frame loop exactly 1 s.

The one exception is **locomotion**: `walk` keeps 8 frames because a gait has four
contacts in it and six frames cannot hold four contacts plus their passing poses.

✅ = built and reviewed.

### How each clip is produced

#### The strategy: one generated clip per action

Superseded twice, so it is worth being explicit about where it landed. The first
version of this plan built clips by translating a nine-part rig. The second built
them by compositing inpainted feature patches over a squashed body. **Both are
retired.** A clip is now a single `animate_image` job, pinned at both ends to the
canonical pose, cleaned mechanically and shipped.

1. **One job per clip, 6 frames, `pig-idle.png` as *both* `first_frame_url` and
   `last_frame_url`.** The pin is what makes this work at all: the clip is forced
   to land on art already approved, so it cannot drift into a different pig, and
   frame 6 duplicates frame 0 so dropping it yields a seamless loop.
2. **Prompt a mechanical action, never a mood.** A verb, a body part, a direction.
   Moods get translated into posture first — see
   [pixellab-notes.md](./pixellab-notes.md).
3. **Clean every frame** (`derive.py` → `pixels.py`): harden alpha to 0/255, erase
   anything not connected to the body, re-ground. Colour is left alone on purpose.
4. **Review before shipping** (`review.py`): numbers first, then the strip at true
   display size. Roughly three of four candidates get thrown away.

| Kind | Clips | How |
|---|---|---|
| Generated | everything not listed below | One `animate_image` job, pinned both ends, cleaned |
| Composed | `trick_spin`, `trick_backflip`, `play_roll` | The idle pose under a per-frame `Pose`. Kept **only** for rotations |
| Posed *(legacy)* | `play_chase`, `pet_enjoy`, `pet_end` | Generated frames with a transform layered on. Being retired |

Composing survives for exactly one job: **rotations**. A spin or a backflip is a
rigid-body turn, so a 90° rotate is lossless and identity cannot drift — the pixels
are the idle pose's own. Everything postural is generated, because a transform
cannot bend a character (see below).

#### Why a squash is not a crouch

The previous version of this document recommended faking the feed crouch as a
`scale_y` squash, and that recommendation was wrong in three separate ways. It is
recorded here because it is a tempting shortcut and it produced the exact defects
this pass was opened to fix:

- **A resample distorts, it does not bend.** Squashing the sprite changes every
  proportion at once. Shallow, it reads as a rendering glitch; deep enough to read
  as intent, and the pig is visibly the wrong shape. There is no value that is both.
- **A vertical squash cannot move the snout forward**, which is half of what
  bending down to food looks like. The head got shorter and stayed put.
- **It fought the cleanup.** Posing resamples art the generator already drew, and
  it re-centres the bounding box — which throws away the forward lean the frame was
  drawn with.

A generated bend has none of these problems: the head comes down *and* forward, the
legs fold, and because the model redraws the frame as a whole the snout stays a
snout. Measured, the shipped feed clip drops the body 11px while holding mass
within 3%.

Rules that still apply to the composed rotations:

- **Every source is cropped to the idle pose's bounding box**, never its own, so a
  frame whose snout juts further down does not shift the whole pig.
- **Lifts need headroom the idle pose does not have.** Its silhouette is 197px in
  a 199px frame, so any real lift trips the fit guard and shrinks the pig ~1%.
  That is why the tricks pair a lift with a constant `scale`.
- **A clip's uniform `scale` is held constant across its frames.** Varying it per
  frame reads as the pig pulsing rather than moving.
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

#### Feature patches — retired, machinery kept

`faces.py` still holds the region boxes and the no-drift assertions, but `PATCHES`
is **empty** and no clip uses one. The two that existed (`mouth_open`, `eye_shut`)
are what the old feed clip was built from, and they are the direct cause of the
nose changing shape mid-animation:

> A mask tight enough to leave the eye alone is too tight for the model to draw an
> open mouth in, so `mouth_open` was generated with the whole `face` box and the
> eye reverted afterwards. That protects the eye's *pixels* — but the box still
> contained the snout, so the model drew a **new snout** every time, and the pig's
> nose changed shape and position on every open-mouth frame.

The general lesson, which is why the machinery is worth keeping around: **reverting
a region protects pixels, not the model's idea of what the region contains.** If a
feature must not change, it cannot be inside the mask at all — and on a face this
small, that leaves nowhere to put a mouth.

So patches are the right tool for exactly one job: drawing something the canonical
pose does not contain, in a place generation will not reliably put it, on a sprite
big enough to mask around. Not this face.

| Region | Box (x, y, w, h) | Covers |
|---|---|---|
| `face` | (4, 66, 66, 74) | Snout, mouth area, eye, blush |
| `eye` | (52, 74, 26, 32) | The eye alone, 1px margin on its dark pixels |
| `legs` | (30, 140, 130, 59) | All four legs |

### Idle — a resting loop plus flourishes

| Clip | Frames | fps | Loop | Description |
|---|---|---|---|---|
| `idle_breathe` ✅ | 6 | 167 | ∞ | Body swells on the inhale, settles on the exhale |
| `idle_look` ✅ | 6 | 167 | once | Head turns up and to the side, then back to forward |
| `idle_sniff` ✅ | 6 | 167 | once | Snout lowers to the ground, nudges along, head rises |
| `idle_scratch` ✅ | 6 | 167 | once | Hind leg lifts to scratch behind the ear, then down |
| `idle_blink` ✅ | 6 | 125 | once | Quick blink |

A scheduler holds `idle_breathe` and injects a random flourish every 4–9s. That's
what makes a pet read as alive rather than looped.

`idle_breathe` is the one clip where the pin does double duty: it loops
continuously, so *every* cycle boundary landing on the canonical pose is what stops
the resting pig from slowly becoming a different pig over a long session.

### Mood + state idles

Moods are prompted as **postures**, never as adjectives — the old "head low, ears
drooped, slow tail" style of prompt is what produced a differently proportioned
pig, because asking for a character gets you a new one drawn.

| Clip | Frames | ms | Prompted action |
|---|---|---|---|
| `idle_sad` ✅ | 6 | 250 | Head hangs low, whole body slumps toward the ground, slowly lifts |
| `idle_hungry` ✅ | 6 | 200 | Snout raised sniffing the air, weight shifts side to side, settles |
| `idle_letter` ⚠️ | 6 | 150 | Holds the envelope, wiggles, taps a hoof |

Each of these ends where it starts, which is what lets a mood loop against a pinned
canonical pose without the pin cancelling the mood: the pig droops and recovers on a
cycle rather than holding a pose that keeps getting reset. Their `ms` is slower than
the 167 default because that is the tempo difference between sulking and hopping.

`idle_letter` ⚠️ is the **one clip that cannot use the recipe as written**, because
the envelope is a prop the canonical pose does not contain — pinning both ends to
`pig-idle.png` would pin away the letter. It still ships from its original
generation on a 192×201 canvas. Doing it properly needs a second hand-approved
canonical pose (idle-holding-envelope) to pin against; until then it is the one clip
whose identity is not guaranteed.

### Walk

| Clip | Frames | ms | Loop |
|---|---|---|---|
| `walk` ✅ | 8 | 120 | ∞ |

Contact → pass → contact → pass over a one-pixel bob, tail counter-swinging.
Frame duration is **scaled to actual travel speed** (`PIG_WALK_MS` 2500 vs
`PIG_STEP_MS` 900) so the legs stop moonwalking.

**8 frames, not 6** — the one exception to the house count. A gait has four contacts
in it, two per side, and six frames cannot hold four contacts plus their passing
poses without a leg skipping. It is also the clip where the model's priors are
strongest, so it survives the extra length: `walk` reviews clean at 8, holding mass
within 3%.

### Feed — one clip, fully drawn

| Clip | Frames | ms | Loop |
|---|---|---|---|
| `feed` ✅ | 6 generated | 167 | ∞ |

There used to be two, `feed_munch` and `feed_gobble`, selected on a hunger
threshold. **Collapsed to one.** Two variants of the same action is twice the
surface to keep consistent for a difference nobody can see at 110px — and it forced
`clipForState` to take a `hunger` argument purely so it could pick between them,
which threaded a number through the actor and the scene for no visible payoff.

The whole action is drawn by the model in one job: bends its head down to the
ground, opens and closes its mouth to gobble, lifts its head back up. Measured
against the canonical pose:

| | Value | Reading |
|---|---|---|
| Body drop | 197px → 186px | An 11px bend, deep enough to read at display size |
| Mass | within 3% across all 6 frames | Pixels move; the pig is not redrawn |
| Snout | pixel-identical on frames 1–5 | The nose no longer changes shape — the whole point |
| Mouth interior | 0 / 464 / 110 / 328 / 339 / 340 px | Opens wide, nearly shuts, opens again — reads as chewing |
| Eye | 410px → ~90px on frames 1–5 | Squints shut while eating, which is correct and intended |

It **loops**, and `actionHoldMs("eat")` is two whole 1 s cycles. Holding a multiple
of the cycle is what keeps the pig from being yanked out of the crouch mid-chew,
since every cycle boundary is the upright canonical pose.

#### The strawberry

Redrawn, because the first two did not look like they came from the same game. Two
things were wrong, and only one of them was obvious:

- **A near-black outline.** The original's outline was `#390a14` — which is the
  pig's **eye** colour. The pig's darkest *line* is a mid pink; its eye is a spot
  colour, not a ramp member. Borrowing it gave the berry a hard, graphic edge next
  to a character drawn entirely in soft pinks, and that single choice is most of why
  it read as a different medium.
- **A fractional downscale.** The berry was authored at 206px and then 70px, and
  displayed at 34px — 0.17× and 0.49×. `image-rendering: pixelated` is
  nearest-neighbour, so a fractional scale drops pixel rows *unevenly*. That is what
  turned the seeds to mush, not their colour.

The shipped version is authored on a **48px canvas** so the trimmed subject is
exactly 34px and renders **1:1, no resampling at all**. Its palette is hand-built
from the pig's colour *logic* rather than its hues (coloured outline that is a darker
fill, mid saturation, the pig's lightest tint included as a shared anchor) — note
that hue-rotating the pig's actual ramp to red was tried and produced washed-out
pink, because that ramp is nearly all pale tints.

Full reasoning in [pixellab-notes.md](./pixellab-notes.md).
`assets/pixellab/props/props.json` records the job, seed, canvas and palette,
including the rejected candidates and why.

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

The beats travel with the clip: `chomps` in `jobs.json` names the frames the pig
bites on, `build.py` carries them into the manifest, and `chompTimes()` turns them
into offsets for as long as the clip is held. Retiming the feed clip moves the
crumbs with it.

What changed is *who decides them*. When the clip was composed, `derive.py` knew
which frames it had put a closed mouth on, so it could emit `chomp_frames` itself. A
generated clip has no such knowledge — the model decided where the mouth opens — so
the beats have to be **read back off the art**. Counting mouth-interior pixels per
frame gives 0/464/110/328/339/340, so the mouth is widest on frames 1 and 4, which
also happen to be evenly spaced in the loop. Hence `chomps: [1, 4]`, recorded by
hand in `jobs.json` with the measurement that justifies it. Any regenerated feed
clip needs that measurement redone; it is two lines of Pillow, not a guess.

### Play (3)

| Clip | Frames | ms | Description |
|---|---|---|---|
| `play_chase` ✅ | 8 generated | 110 | Fast trot — pairs with the back-and-forth `movePig` |
| `play_bounce` ✅ | 7 generated | 120 | Crouch, hop 9px clear of the ground, land |
| `play_roll` ✅ | 6 rotated | 130 | Tips onto its back, hooves wiggle, rights itself |

`play_chase` while travelling, one of the other two at the far end of the run. It is
8 frames for the same reason `walk` is — it is a gait, not a gesture.

`play_bounce` is the only clip flagged **`airborne`** in `jobs.json`, which switches
off re-grounding for it. That flag exists because its absence silently deleted the
animation: the raw frames hop 9px clear of the ground, re-grounding slid all of them
back down, and the clip reviewed *clean* while being a pig that never jumped. No
measurement can tell a 9px hop from 9px of generator jitter, so it is declared.

### Tricks (4 — one per `TRICKS` entry)

| Clip | Frames | ms | Description |
|---|---|---|---|
| `trick_spin` ✅ | 7 rotated | 90 | Turn read as a horizontal squeeze through edge-on, mirrored past 90° |
| `trick_backflip` ✅ | 6 rotated | 110 | Crouch, quarter-turns around a jump arc, land squash |
| `trick_sit` ⚠️ | 7 generated | 167 | Hunkers down with its eyes shut — reads as a crouch, not a sit |
| `trick_dance` ✅ | 7 generated | 130 | Bobs and leans side to side, ears flicking |

The two rotations stay **composed**, and their review numbers look alarming on
purpose: `trick_spin` loses 51% of its width at the edge-on frames, which is the
entire point of the pose, and `trick_backflip` loses 36% of its mass because a
rotated sprite has to shrink to fit a 189×199 frame whose diagonal is 272px. Those
are accepted costs of a rigid-body turn, not defects — and a rotation is the one
motion where composing beats generating outright, because the pixels are the idle
pose's own so identity cannot drift at all.

`trick_sit` ⚠️ is **the one action generation cannot carry.** Three prompts, two
seeds, increasingly explicit anatomy ("folding its hind legs underneath and dropping
its rear all the way to the ground so its back slopes up to the shoulders") — every
one produced a crouch. The giveaway is measurable rather than a matter of taste: the
rear-to-front height gap held at +16px on every frame, so the whole pig sank instead
of its rear dropping. It is still a large improvement on the posed version it
replaces, which lost 23% of the pig's mass; it just is not a sit.

Doing it properly needs `pig-sit.png` pinned as the last frame. That pose exists and
is drawn at the same scale (eye within 11%, body width within 2%) — but it is 202px
tall against a 199px frame contract, so it is blocked on raising the contract, not on
prompting.

### Petting (new)

| Clip | Frames | ms | Loop |
|---|---|---|---|
| `pet_enjoy` ✅ | 6 generated | 160 | ∞ |
| `pet_end` ✅ | 7 generated | 150 | once |

Eyes squeeze shut, head tilts into the rub, the body leans into it. Hearts drip
while it runs; `pet_end` is a happy shake-off back to idle.

### What is still open

Everything a transform or a patch was going to be needed for is now drawn by the
generator, so the old list of pending part variants is gone. Two things remain, and
both are the *same* problem:

| Clip | Blocked on |
|---|---|
| `trick_sit` | A sitting canonical pose to pin as the last frame. `pig-sit.png` exists at the right scale but is 202px tall, so the 199px frame contract has to be raised first |
| `idle_letter` | An idle-holding-envelope canonical pose. Until then it is the one clip generated open-ended, so it is the one clip whose identity is not guaranteed |

The general rule this exposes: **a clip whose payoff is a held end-pose needs its own
approved end pose.** The pin cannot be prompted around, and both attempts to do so
produced a clip that returns to neutral when it should stay put.

Current atlas: **128 frames** across 19 clips, packed 12-wide at 2268 × 2189 px.

---

## 5. Sheet + manifest

```
public/sprites/pig/pig-v2.png     one atlas, 12 cols × 189×199px frames
src/lib/pig-anim.generated.ts     typed manifest (do not hand-edit)
```

Generated TypeScript rather than fetched JSON — zero runtime requests, and clip
names become a union type, so a typo in the state machine is a compile error:

```ts
export const PIG_SHEET = {
  src: "/sprites/pig/pig-v2.png", frameW: 189, frameH: 199, cols: 12, rows: 11, totalFrames: 128,
} as const;
export const PIG_CLIPS = {
  idle_breathe: { start: 0, frames: 6, ms: 167, loop: true },
  walk:         { start: 6, frames: 8, ms: 120, loop: true },
  feed:         { start: 61, frames: 6, ms: 167, loop: true, chomps: [1, 4] },
  // …
} as const;
export type PigClip = keyof typeof PIG_CLIPS;
```

`chomps` rides on the clip rather than living in the scene, which is what keeps the
munch crumbs in sync with a retimed feed clip.

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
scripts/pig/pixels.py         pixel ops shared by the build and the review
scripts/pig/download_clips.py completed PixelLab jobs -> raw/
scripts/pig/faces.py          inpaint jobs -> faces/ (registry now empty)
scripts/pig/derive.py         idle + raw/ -> clips/  (clean, ground, compose)
scripts/pig/build.py          clips/ -> atlas + typed manifest
scripts/pig/review.py         clips/ -> pass/fail + previews
```

`npm run sprites` runs the whole chain and **ends on `review.py`, which exits
non-zero on a hard problem** — so a broken clip cannot reach the atlas quietly.

`pixels.py` exists because the build and the review need to answer the same
questions about a frame (where does it stand, is anything detached from the body,
does it use a colour the pig does not own). Two implementations of "where is the
ground line" that disagree is a bug that looks like a mystery.

**Hard — always a defect, so these fail the build:**

- any pixel with alpha not in {0, 255} — halos over the sky gradient,
- any opaque island not connected to the body — every part of the pig, tail curl
  included, touches the rest, so a second island is always invented.

**Soft — reported with a threshold, never enforced:** mass, width, height, ground
line, eye area and foreign colours. Each of these has a legitimate reason to move —
a crouch changes height, a squint shrinks the eye, an open mouth introduces a dark
red the idle pose never needed, a hop leaves the ground. Gating on them would just
teach everyone to bypass the gate.

Two things deliberately **not** checked, both because the earlier version of this
plan got them wrong:

- **Palette conformance against the 8-colour ramp.** The ramp describes the art's
  *logic*; `pig-idle.png` actually ships **47 colours**, so the check flagged every
  frame including the source. The review compares against the canonical pose's own
  colour set instead.
- **Colour correction in the build.** Snapping off-palette pixels to the nearest
  canonical colour mapped the inside of the pig's open mouth onto its eye colour,
  and the mouth rendered as a hole through its head. Cleanup is strictly mechanical.

---

## 8. Phases

| Phase | Deliverable | Checkpoint |
|---|---|---|
| **0. Style** ✅ | Decided: keep the existing pig exactly | Done |
| **1. Trace + rig** ✅ *(superseded)* | A nine-part translation rig. Abandoned — it could only move pixels the idle pose already had, which ruled out almost every action | Done, then replaced |
| **2. Feature patches** ✅ *(superseded)* | `inpaint_image` patches composited over posed bodies. Abandoned — the mask that drew a mouth also redrew the snout | Done, then replaced |
| **3. Generated clips** ✅ | One `animate_image` job per clip, pinned at both ends; 6 frames throughout; `pixels.py` cleanup | Contact sheet reviewed |
| **4. Atlas + manifest** ✅ | `build.py`, `pig-v2.png`, `pig-anim.generated.ts`, `npm run sprites` | Review gate passes |
| **5. Runtime** ✅ | `SpriteSheet`, `useSpriteAnimation`, `pig-clips.ts` | Typecheck + lint clean |
| **6. Wire the garden** ✅ | `PigActor`, `GardenScene` swap, petting, old keyframes removed | Feels right on desktop + mobile |
| **7. App-wide + cleanup** ✅ | Landing hero, 404, dashboard card on sheet frames; old pig PNGs still used as canonical *sources*, not as rendered art | Nothing renders the old art |

### Reviewing what exists now

```bash
npm run sprites                         # download → derive → build → review (gates)
python3 scripts/pig/review.py           # every clip: numbers + previews
python3 scripts/pig/review.py feed      # just the clips matching a name
python3 scripts/pig/review.py --dir assets/pixellab/raw/feed   # a fresh candidate
```

Outputs land in `docs/previews/review/`: a strip at true display height, a 2× strip,
a GIF at the clip's real timing, and a drift sheet with each frame over the canonical
silhouette in blue. **Judge at display height, not zoomed** — the pig ships at 110px
from a 189px source, and defects that are glaring at 6× genuinely disappear at 0.55×.
Zooming in makes you throw away clips that are fine.

---

## 9. Risks

| Risk | Mitigation |
|---|---|
| A generation quietly returns a different pig | The canonical pose is pinned as first *and* last frame; `review.py` measures mass and eye area against it |
| A clip drifts off the canonical pose by its end | Same pin — the last frame is art already approved |
| Stray pixels over the sky gradient | `drop_strays` erases anything not connected to the body; a hard failure in review |
| Halos over the gradient | `harden_alpha` forces 0/255; a hard failure in review |
| The pig sinks into the grass between frames | `reground` aligns every frame to y=198 — except clips flagged `airborne`, where the lift is the point |
| A jump gets silently re-grounded away | `airborne` in `jobs.json`, and review prints ground clearance per frame |
| A clip is generated against the wrong canvas | One `reference` URL in `jobs.json`; verify it matches the local pose before a batch |
| Reduced-motion users get animation anyway | Explicit handling in the hook — a CSS override can't reach JS stepping |
| Rub fights the field drag on touch | `data-no-pan` on the pig; the camera's `pointerdown` skips that subtree |
| Rub fires the open-letter click | Movement threshold suppresses the click |
| Petting farmed for happiness | Server-side cooldown |
| Stale atlas from CDN cache | Versioned filename |
| Clip and travel speed desync | Walk frame time derives from the actual movement duration |
| A broken clip reaches the atlas | `npm run sprites` ends on `review.py`, which exits non-zero on a hard problem |
