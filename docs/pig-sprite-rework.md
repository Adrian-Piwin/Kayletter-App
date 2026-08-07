# Pig sprite rework — real animation sheets

Status: **Shipped.** Clips that return to neutral are generated whole and pinned at
both ends; clips whose payoff is an extreme pose are assembled from hand-approved key
poses. See §4.
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

**Three approaches were built and abandoned before this one landed** — a nine-part
translation rig, feature patches composited over squashed bodies, and then one
`animate_image` job per clip pinned to the idle pose at *both* ends. All are
documented in §4 rather than deleted, because each failed for a reason that is easy
to rediscover.

The third is the subtlest and the reason this was reopened a second time: pinning the
same pose at both ends locks identity **and flattens the motion**, because the model
averages the middle back toward two identical endpoints. Six clips shipped that way
and every one showed a pig that blinked and did nothing else, while passing every
check in §7.

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
bottom and their canvas bottom was in the wrong place. Both are retired now, but the
trap is not — it applies to any pose adopted from `public/sprites/`, which is why
`harvest.py --adopt` reports the pose's mass against canonical before you keep it.
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
| Generated | `walk`, `walk_letter`, `play_chase`, `idle_breathe`, `idle_blink`, `idle_letter`, `pet_enjoy`, `pet_end` | One `animate_image` job, pinned both ends, cleaned |
| **Key poses** | `idle_scratch`, `idle_sniff`, `play_bounce`, `play_roll`, `trick_sit`, `trick_dance`, `trick_playdead`, `pose_sad` | Hand-approved extreme poses, assembled with whole-pixel translation |
| Composed | `trick_backflip` | The idle pose under a per-frame `Pose`. Kept **only** for rotations |
| Legacy | `feed` | Survives from the patch era; its snout still shifts on the open-mouth frames |

Composing survives for exactly one job: **rotations**. A backflip is a rigid-body
turn, so a 90° rotate is lossless and identity cannot drift — the pixels are the idle
pose's own. Everything postural is drawn, because a transform cannot bend a character
(see below).

**Key poses are the third path, added because generation alone could not carry
anything postural.** Pinning the canonical pose at *both* ends locks identity and
flattens the motion — the model interpolates between two identical endpoints, so the
frame meant to carry the action is the one it weakens most. Six clips shipped
looking like a pig that blinks. A key-pose clip pins against a *different* approved
pose, or skips generation entirely and moves an approved pose by whole-pixel
translation. Full reasoning in [pixellab-notes.md](./pixellab-notes.md).

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
assets/pixellab/poses/<p>.png  hand-approved key poses (harvest.py)
assets/pixellab/raw/<clip>/    generated frames, exactly as downloaded
  -> derive.py                 composes clips / assembles key poses
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

| Clip | Frames | ms | Loop | Built from | Description |
|---|---|---|---|---|---|
| `idle_breathe` ✅ | 6 | 200 | ∞ | generated | Body swells on the inhale, settles on the exhale |
| `idle_sniff` ✅ | 7 | 140 | once | poses | Snout goes down into the grass, snuffles along, head rises |
| `idle_scratch` ✅ | 9 | 90 | once | poses | Hind leg lifts and the body shakes with the scratch |
| `idle_blink` ✅ | 5 | 125 | once | generated | Quick blink |

A scheduler holds `idle_breathe` and injects a random flourish every 4–9s. That's
what makes a pet read as alive rather than looped.

`idle_look` is **retired** — one flourish fewer is not a loss when the two that
remain now actually do something.

`idle_scratch` is worth reading the numbers on, because the pose is not what carries
it. The generator will raise this pig's hind leg and no further; the action reads
because two nearly identical lifted-leg poses alternate at 90ms with a 1px body
shake. **Rhythm is a lever the prompt does not have.**

`idle_breathe` is the one clip where the pin does double duty: it loops
continuously, so *every* cycle boundary landing on the canonical pose is what stops
the resting pig from slowly becoming a different pig over a long session.

### Mood + state idles

**Mood no longer picks a clip.** `idle_sad` and `idle_hungry` are retired: both were
prompted as adjectives rather than postures and came back as a differently
proportioned pig, and neither ever read as the mood it was named for. Mood shows in
the stat bars instead. `mood` stays in `clipForState`'s signature so a properly drawn
mood pose has an obvious home.

| Clip | Frames | ms | Loop | Built from | Description |
|---|---|---|---|---|---|
| `idle_letter` ⚠️ | 7 | 150 | ∞ | generated | Holds the envelope, wiggles, taps a hoof |
| `pose_sad` ✅ | 1 | — | — | pose | A still, for the 404 page |

`pose_sad` is `public/sprites/pig-sad.png` — the pre-rework hand-drawn art, adopted
onto the frame contract. A still is the honest shape for it: the 404 wants a pig that
looks like it lost something, not a pig performing sadness on a loop.

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
| `feed` ✅ | 8 | 150 | ∞ |

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

| Clip | Frames | ms | Built from | Description |
|---|---|---|---|---|
| `play_chase` ✅ | 8 | 110 | generated | Fast trot — pairs with the back-and-forth `movePig` |
| `play_bounce` ✅ | 6 | 110 | poses | Crouch, then one drawn tuck pose lifted 20px and set back down |
| `play_roll` ✅ | 7 | 120 | poses | Tucks into a ball, rolls out along the ground and back |

`play_chase` while travelling, one of the other two at the far end of the run. It is
8 frames for the same reason `walk` is — it is a gait, not a gesture.

`play_roll` used to rotate the idle sprite in place, so the pig tipped over rigidly
and came back **without going anywhere** — a roll reads as *travel*, and it had none.
It is now three drawn poses of the pig tucked into a ball, translated out and back.
The tucked poses measure 15-18% light, which is honest: a pig curled into a ball
really is a smaller silhouette than one standing with a snout and four legs sticking
out.

`play_bounce` is flagged **`airborne`** in `jobs.json`, which switches
off re-grounding for it. That flag exists because its absence silently deleted the
animation: the raw frames hop 9px clear of the ground, re-grounding slid all of them
back down, and the clip reviewed *clean* while being a pig that never jumped. No
measurement can tell a 9px hop from 9px of generator jitter, so it is declared.

### Tricks (4 — one per `TRICKS` entry)

| Clip | Frames | ms | Built from | Description |
|---|---|---|---|---|
| `trick_backflip` ✅ | 6 | 110 | rotated | Crouch, quarter-turns around a jump arc, land squash |
| `trick_sit` ✅ | 7 | 150 | poses | Folds down onto its rear, holds it, stands back up |
| `trick_dance` ✅ | 8 | 120 | poses | Up on the hind legs, hopping side to side |
| `trick_playdead` ✅ | 7 | 140 | poses | Flops flat on its side, lies rigid, springs back up |

`trick_spin` is **retired** and `trick_playdead` replaces it, so `TRICKS` is still
four long and `tricks_unlocked` needs no migration — only a count is ever persisted,
never a trick name.

The one rotation left, `trick_backflip`, has review numbers that look alarming on
purpose: it loses 36% of its mass because a rotated sprite has to shrink to fit a
189×199 frame whose diagonal is 272px. That is an accepted cost of a rigid-body turn,
not a defect — and a rotation is the one motion where composing beats generating
outright, because the pixels are the idle pose's own so identity cannot drift at all.

#### `trick_sit` — the clip generation could not draw

This was the longest-standing open item in this document, and the resolution is not
the one it predicted.

Five attempts failed: three pinned (all crouches, with the rear-to-front height gap
holding at +16px across every frame, meaning the whole pig sank rather than its rear)
and then two more under the new key-pose recipe — twelve open-ended frames of
"sitting down on its rear" produced a pig that shut its eyes and shrank slightly. The
model's prior for "round pig standing side-on" is simply stronger than any prompt.

**The answer was already in the repo.** `public/sprites/pig-sit.png` is the
pre-rework hand-drawn art: a real sit, rear on the ground, back sloping up to the
shoulders — and measurably the same pig, mass within 1% of canonical and the eye
20×25 against 21×26. It is worth more than anything a generation returns because the
pixels are the same artist's.

This document used to say adopting it was blocked on raising the 199px frame contract,
since the pose is 202px tall. That is the cleaner fix and it is still available, but
it ripples into the atlas, `SpriteSheet` and every display height in the app. Scaling
0.985 to fit costs three pixel rows and ~3% mass — well inside the 15% the review
tolerates, and far inside the **23%** the posed sit it replaces was losing.

The general lesson, which cost more generations than it should have: **before
prompting for a pose, check whether someone already drew it.** The pre-rework PNGs
are a pose library, not dead weight. Check the mass first, though — `pig-eat` (0.93)
and `pig-happy` (1.08) are the pig at visibly the wrong size, which is the exact
defect this rework exists to undo.

### Petting (new)

| Clip | Frames | ms | Loop |
|---|---|---|---|
| `pet_enjoy` ✅ | 6 generated | 160 | ∞ |
| `pet_end` ✅ | 7 generated | 150 | once |

Eyes squeeze shut, head tilts into the rub, the body leans into it. Hearts drip
while it runs; `pet_end` is a happy shake-off back to idle.

### What is still open

| Clip | Blocked on |
|---|---|
| `idle_letter` | An idle-holding-envelope canonical pose. It is the one clip still generated open-ended end to end, so it is the one clip whose identity is not guaranteed. Harvesting is now the mechanism for making that pose — this is no longer blocked on an idea, only on doing it |
| `feed` | Still the patch-era clip: its snout shifts on the open-mouth frames. Untouched by this pass because it is the one clip whose action already reads |

The rule the sit exposed, generalised: **a clip whose payoff is a held end-pose needs
its own approved end pose.** The pin cannot be prompted around. What changed is that
making such a pose is now routine — harvest it from an open-ended run, or adopt one
somebody already drew.

Current atlas: **117 frames** across 18 clips, packed 12-wide at 2268 × 1990 px.

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
scripts/pig/harvest.py        open-ended job -> one approved key pose in poses/
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
  included, touches the rest, so a second island is always invented,
- a clip coming back **more than 25% flatter** than when it was approved.

That last one is the check this rework added, and it is worth being precise about
what it does *not* do. An absolute motion floor — "a clip named after an action must
move at least N% of its silhouette" — was tried and measured across the whole set,
and the good clips and the dead ones interleave: `walk` reads perfectly at 9.7% while
`trick_sit` was dead at 9.6%. Amount of motion is not correctness of motion, and two
attempts to filter the signal (box-downsampling, largest connected region) reproduced
the same ranking. Details in [pixellab-notes.md](./pixellab-notes.md).

So it gates the failure that actually happened instead. Commit `a93b79e` replaced
several clips with flatter earlier versions and nothing complained, because every
other check measures what the pig *is* and all of them are conserved by a clip in
which nothing happens. A clip approved by eye records its motion as `approved_change`
— written only by an explicit `review.py --record`, never as a build side effect, or
it would defend nothing.

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
