# Working with PixelLab

Notes from building the pig's animation set and its props. The short version: the
model is very good at drawing *one small thing*, good at making a sprite *move*,
and unreliable at drawing *the same character twice*. Everything below follows
from that — and from the one trick that mostly cancels the third problem.

For how the pig's clips are actually cut, see
[pig-sprite-rework.md](./pig-sprite-rework.md). This file is about the tool.

## The recipe

For a new clip of an existing character, in order:

1. **One `animate_image` job per clip.** Not a rig, not a per-frame composition.
2. **Pin the canonical pose as `first_frame_url` *and* `last_frame_url`.** This is
   the single most important line on this page — see below.
3. **Ask for a mechanical action, never a mood.** "bending its head down to the
   ground, opening and closing its mouth wide to gobble food, then lifting its
   head back up" — a verb, a body part, a direction.
4. **Ask for 6 frames.** The job returns 7 — keep the 7th on a one-shot, drop it on
   a loop. See the frame-count section below.
5. **Feed it the canonical pose at its exact canvas size**, and never any other.
6. **Run the frames through the clean-up pass** (`derive.py`): harden alpha, erase
   detached pixels, re-ground. Never ship raw output — and note that colour is
   deliberately *not* corrected; see below.
7. **Review it with numbers and at true display size** (`review.py`), then keep or
   throw it away. Budget for throwing away three of four.

Everything after this section is why.

## Pin the last frame. This is the whole trick.

`animate_image` takes a `last_frame_url` as well as a first. Give it the *same*
canonical pose for both and the clip is forced to land back on art you already
approved, which kills end-of-clip drift outright:

| Same prompt, same seed | ends with | canonical is |
|---|---|---|
| open-ended | eye 271px, height 192 | eye 410px, height 197 |
| pinned first *and* last | eye 410px, height 197 | ✓ exact |

That is not a subtlety. Every clip in this project that ever visibly broke was
generated open-ended, and every one of them broke *at the end*: the old
`idle_breathe`'s last frame had no eye at all, `pet_end` and `play_bounce` finished
as a different pig, `idle_look` turned into a chunkier pig facing the other way
halfway through. Open-ended generation has nothing pulling it home, so error
accumulates frame over frame and the worst frame is always the last one — which, for
a one-shot clip, is the frame the eye rests on. All of them are pinned now, and
`idle_letter` is the only clip left that is not.

Pinning also hands you a **free loop** — but whether to keep the pinned frame
depends on whether the clip loops, and getting this backwards is a real bug both
ways:

- **A loop must drop it.** Frame N duplicates frame 0, so playing both holds the
  canonical pose for two frame-times every cycle. On `idle_breathe` that is a
  visible hitch in the breathing.
- **A one-shot must keep it.** Here the pin is not a duplicate, it is the
  *resolution*: the landing after a hop, the pig standing up after a scratch. Drop
  it and the clip is stranded on its most extreme frame — `play_bounce` ended 9px
  off the ground, a jump that never lands.

So `derive.py` derives it from `loop` rather than taking a hand-set count, which is
one fewer thing to get wrong per clip.

### The pin's one real limit

Pinning forces the clip back to neutral, so **any clip whose payoff is a held
end-pose cannot use it.** Two clips here hit that wall:

- `idle_letter` needs to hold an envelope the canonical pose does not contain, so
  pinning would pin the letter away.
- `trick_sit` should end sitting and stay sitting.

Both need a *second* hand-approved canonical pose to pin against, not a different
prompt. `public/sprites/pig-sit.png` already exists and is drawn at the same scale
(eye within 11%, body width within 2%) — but it is 202px tall against a 199px frame
contract, so adopting it means raising the contract, not just pointing at the file.
Worth knowing before you try to prompt your way around this: three attempts at
"sit" produced a *crouch* every time. The giveaway is measurable — the rear-to-front
height gap held at +16px across every frame, meaning the whole pig dropped rather
than its rear.

## Six frames, and why not four or eight

The same prompt and seed, submitted three times at three frame counts, is the
cheapest experiment on this page and it decided the house standard. All three were
pinned, so all three ended on the canonical pose; the only variable was length:

| Frames | Bend depth | Chewing reads? | Verdict |
|---|---|---|---|
| 4 | 6px | Clearest — mouth wide on 1, shut on 2 | Too shallow to look like bending |
| **6** | **11px** | **Yes — mouth open on 1, 3, 4, 5** | **Shipped** |
| 8 | 12px | Barely — the mouth is half-open on most frames | Deepest bend, mushiest action |

The pattern is not "more frames is smoother". More frames is *the same motion
spread thinner*, because the model is interpolating between two fixed endpoints:
the extremes get averaged toward the middle, so the pose that carries the action
gets weaker. Four frames is too few to reach a real extreme; eight has room but
spends it on in-betweens. Six is where the extreme is deep enough to read and
still held for a sixth of the cycle.

So: **6 frames is the standard for every clip**, and it is not negotiable per
clip, because the whole point of a standard is that the pig's animations all feel
like they came from one hand.

**Frame *duration* is not part of the standard**, and conflating the two is a
mistake worth avoiding. 6 frames is a statement about how the motion is drawn; ms
is a statement about tempo. A sad droop at 250 ms and a play chase at 110 ms are
the same 6-frame shape at two speeds, and forcing both to 167 ms would make one
frantic and the other sluggish. 167 ms is only the *default*, because it makes a
6-frame loop exactly 1 s.

The one exception is **locomotion**: `walk` and `play_chase` get 8. A gait has four
real contacts in it (two per side), and six frames cannot hold four contacts plus
their passing poses without one leg skipping. It is also where the model's priors are
strongest, so a gait survives the extra length — both review clean at 8, holding mass
within 3%. Anything that is not a gait gets 6.

## Feed it the canonical canvas, exactly

Three clips in this set (`idle_sad`, `idle_hungry`, `idle_letter`) were generated
against a differently-sized reference — 195×183 and 192×201 against a 189×199
contract. Nothing warned about it; the frames came back looking fine.

But the pig inside a 183px-tall canvas is a *smaller pig*, and every downstream
step then works from the wrong baseline. Re-grounding aligns a frame's lowest pixel
to the canvas bottom, so on a short canvas it grounds the pig 15px above where the
grass actually is, and the review reports it as "ground line y=183, canonical is
y=198" on every frame — a defect introduced entirely by the input, correctly
flagged, and impossible to repair afterwards. Those clips measure 4% light and 30px
short, which is why the pig looked like it changed size when it got sad.

The reference has to be the canonical pose at its exact pixel dimensions, every
time. `jobs.json` pins one `reference` URL for the whole project for this reason,
and it is worth checking it still matches the local file (`curl` it and compare
hashes) before a batch — the URL points at `main`, so it silently follows the
branch.

## Ask for an action, not a feeling

Sorting the clip set by what its prompt asked for predicts which ones came back
broken almost perfectly:

| Prompt asked for | Clips | Result |
|---|---|---|
| Locomotion | `walk`, `play_chase` | Clean. Mass within 3%, identity holds |
| One feature moving | `idle_blink`, `idle_scratch` | Clean |
| A whole-body action | `feed`, `idle_breathe`, `idle_look` | Clean, *with* the last frame pinned |
| A posture or a mood | `idle_sad`, `idle_hungry` (old) | A different pig |

"head low, ears drooped, slow tail" and "tummy rumble, stares at you" are
descriptions of a *character*, and asking for a character gets you a new one
drawn. The model has strong priors for how a four-legged animal walks, sniffs and
eats; it has none for how *this* pig sulks.

The fix is not to abandon the mood, it is to **translate it into the body**. Every
mood a small animal has is legible as a posture, and a posture is an action:

| Instead of | Ask for |
|---|---|
| "sad, head low, ears drooped" | "hanging its head down low and slumping its whole body toward the ground, then slowly lifting back up" |
| "hungry, tummy rumble, stares at you" | "sniffing the air with its snout raised, shifting its weight from side to side, then settling back down" |
| "curious, looking around" | "turning its head to look up and to the side, then bringing it back to face forward" |

Note that each of these ends where it started. That is what lets the mood clip
loop against a pinned canonical pose without the loop fighting the mood: the pig
droops and recovers on a cycle rather than holding a sad pose the pin keeps
cancelling. If a mood genuinely has to be *held* rather than cycled, it belongs in
a second canonical pose you approve by hand — not in a prompt.

So: mood belongs in the state machine that picks the clip, and in the *posture*
the prompt describes. Never in an adjective.

## What was tried and abandoned

- **`edit_image`** to pose the pig came back with a giant round body and stubby
  legs. It is not an edit, it is a re-draw.
- **Skeleton rigging** (`create_character` + `animate_character`) was the wrong
  shape for the problem: the pig is a blob with no neck and barely any limbs.
- **Composing clips from inpainted feature patches** — the approach the previous
  version of this document recommended. It is the right tool for *adding* a
  feature and the wrong tool for a pose, and the eat clip failed on both halves.
  Worth spelling out, because it is a tempting idea:

  - *The mask problem.* A mask tight enough to leave the eye alone is too tight
    for the model to draw an open mouth in, so the mouth was generated with the
    whole face box and the eye reverted afterwards. That protects the eye's
    *pixels* — but the box still contained the snout, so the model drew a new
    snout, and the pig's nose changed shape and position on every open-mouth
    frame. **Reverting a region protects pixels, not the model's idea of what the
    region contains.** If a feature must not change, it cannot be inside the mask
    at all, and on a face this small that leaves nowhere to put a mouth.
  - *The squash problem.* With no neck to bend, a crouch was faked as a `scale_y`
    resample of the whole sprite. Two things go wrong. A resample does not bend a
    character, it distorts one — every proportion changes at once, which is why it
    reads as a rendering glitch until it is deep enough to read as intent, and by
    then the pig is visibly the wrong shape. And a vertical squash cannot move the
    snout *forward*, which is half of what bending down to food looks like.

  A generated clip has neither problem: the bend is drawn, so the head comes down
  *and* forward and the legs fold; and because the model redraws the frame whole,
  the snout stays a snout.

Patches are still the right tool for one job: drawing something the canonical pose
does not contain, in a place generation will not reliably put it. `faces.py` keeps
the machinery for that, with an empty registry.

## Nothing generated is ready to ship

Every generated frame in this project needed mechanical repair. Measured across
15 clips:

| Defect | Scale | Why it matters |
|---|---|---|
| Colours the source does not have | 100–1200 px per frame | In-between tints on every redrawn edge. Harmless once, cumulative across a clip set |
| Detached pixel islands | `idle_sniff` 840px, `trick_sit` 217px, `idle_letter` 133px | On a transparent sprite over a sky gradient there is nothing to hide them |
| Ground line wandering | up to 5px within one clip | Plays back as the pig sinking into the grass and floating out again |
| Partial alpha | on most diagonals | Halos against the gradient |

So `derive.py` cleans every frame on the way into `clips/`. Three things about it:

- **Do not "fix" colour.** Snapping off-palette pixels onto the canonical pose's
  colours is the obvious next step and it is a trap, because a clip that draws a
  new feature legitimately needs colours the idle pose does not have. Snapping the
  eat clip mapped the dark red inside the pig's open mouth onto the near-black of
  its eye — the nearest neighbour by RGB distance — and the mouth rendered as a
  hole punched through the head. There is no threshold that separates "an
  in-between tint on an edge" from "the inside of a mouth", because they are the
  same size and the same distance from the ramp. So the cleanup is strictly
  mechanical, and colour is reported by `review.py` for a human to judge.

- **Strays must go before any crop.** A loose pixel out in the grass grows the
  bounding box, so cropping to it drags the whole pig off centre. This is a silent
  failure: the frame looks fine, the pig is 6px to the left.
- **Re-grounding moves y only.** The x position carries the lean or the step the
  frame was drawn with, and re-centring the bounding box throws that away — which
  is exactly what the old "pose the generated frames" path did to the eat clip's
  forward lean.
- **Re-grounding must be switched off for anything that leaves the ground.** This
  one silently ate a whole animation: `play_bounce`'s raw frames hop 9px clear of
  the ground, and re-grounding slid every one of them back down. The clip reviewed
  *clean* — mass conserved, identity held, no strays — and the pig simply never
  jumped. There is no measurement that separates a 9px hop from 9px of generator
  jitter, so it is declared per clip (`airborne` in `jobs.json`) rather than
  inferred, and `review.py` prints ground clearance per frame instead of flagging it.

## Judge a clip with numbers, then with your eyes

`python3 scripts/pig/review.py` — the checks it runs are all things that were
shipped broken at some point and would have been caught in a second. It runs at the
end of `npm run sprites` and **exits non-zero on a hard problem**, so a broken clip
cannot reach the atlas quietly.

Only hard problems gate. Every soft warning on the current clip set is a pose doing
its job — a squint while eating, a crouch changing height, dark red inside an open
mouth — so making them fail would just train everyone to pass `--force`.

The two useful identity probes turn out to be very cheap:

- **The eye.** It is the only near-black cluster on an otherwise pink character,
  so its pixel count pins the head. When a generation quietly swaps in a different
  pig, the eye is the first thing to vanish. It legitimately shrinks when the pig
  squints (eating, sniffing, being petted), so this is a "look at it" signal, not a
  failure.
- **Mass.** Total opaque pixels. A real pose moves pixels around and conserves
  them; a redrawn or rescaled character does not. This is the single most useful
  number on the page, and it is what condemned the whole posed path:

| Clip | Posed | Regenerated |
|---|---|---|
| `play_bounce` | −26% | within 4% |
| `trick_sit` | −23% | within 3% |
| `trick_dance` | −17% | within 4% |

A uniform `scale` in a pose is exactly a mass loss, and a 20% mass loss is the pig
visibly shrinking mid-clip. Nobody caught it by eye across months of looking at
these clips; one column of numbers made it obvious.

**Mass is not a substitute for looking, though.** `play_bounce` reviewed *clean* —
mass conserved, identity held, no strays — while being an animation of a pig that
never left the ground, because the build had re-grounded the hop away. A metric
that measures the pig cannot tell you the pig did the wrong thing.

Then look at it at **true display size**, not zoomed. The pig ships at 110px from
a 189px source, and defects that are obvious at 6× — a softened ear, a thinner
outline on one frame — genuinely disappear at 0.55×. Zooming in will make you
throw away clips that are fine. `review.py` writes a strip at display height, a
2× strip, a GIF at the clip's real timing, and a drift sheet with every frame
over the canonical silhouette in blue, which is the fastest way to see whether the
body actually moved or just changed.

Do **not** check colours against `palette.py`. That ramp is aspirational: the
eight entries describe the art's *logic*, but `pig-idle.png` actually ships **47
colours**, so checking against the ramp flags every frame including the source and
tells you nothing. Check against the canonical pose's own colour set — that
catches the thing you care about, a colour arriving from outside the character.

## Matching the style of a new asset

Two things have to match, and the earlier version of this file got the second one
half right.

### 1. Palette — force it

`create_image_pixflux` takes a `color_image` whose colours become a hard palette.
It holds exactly: an 8-colour palette in gave 7–8 colours out, every time, and
every one of them was from the input. This is the most reliable lever available.

Deriving the palette matters. Hue-rotating the pig's own ramp to red produced
washed-out pink, because that ramp is nearly all very light tints. What transfers
is the *logic*, not the hues:

- a coloured outline that is a darker version of the fill, **never black**
- two or three shading steps per material
- mid saturation
- the neighbouring art's lightest tint included, so the two share an anchor

That last rule is the inverse of the advice this file used to give. It said to
include the existing art's *darkest* accent — and the strawberry did exactly that:
its outline was `#390a14`, which is the pig's **eye** colour. A near-black outline
on a character whose darkest line is a mid pink is the single biggest reason the
berry read as a different, harder medium. The eye is a *spot* colour, not a ramp
member; sharing it is how you get an asset that clashes.

### 2. Pixel density — or better, don't resample at all

Apparent pixel size on screen is `display_height / source_height`:

| Sprite | Source | On screen | Screen px per art px |
|---|---|---|---|
| Pig | 199px | 110px | 0.55 |
| Strawberry (first try) | 206px | 32px | 0.17 |
| Strawberry (second try) | 70px | 34px | 0.49 |
| Strawberry (shipped) | 34px | 34px | **1.00** |

The 0.17 version was genuinely broken — 3.3× finer than the pig, which is why it
looked smooth and detailed and out of place. But matching 0.49 to 0.55 was
over-fitting: the second berry still looked wrong, and its density was fine.

For a **small prop**, aim the canvas so the trimmed subject is *exactly* the
display height. Then it renders 1:1 and no pixels are dropped at all, which beats
matching a neighbour's density through a non-integer downscale. `image-rendering:
pixelated` is nearest-neighbour in both directions, so a 0.49 downscale drops
every other pixel row unevenly — that is what turned the berry's seeds to mush,
not their colour.

Work backwards to the canvas: the model fills roughly 60–70% of it, so a 34px
subject wants a **48px canvas**. A prop being a little chunkier than a big sprite
beside it is normal and reads as deliberate; a prop with dropped pixel rows just
reads as broken. Pin the display height in code as a constant, not a breakpoint
ternary — `height={isMobile ? 32 : 34}` guarantees one of the two is fractional.

### Practical asset checklist

- **Trim to the artwork before shipping.** `Sprite` scales the whole canvas, so
  padding silently shrinks the subject and makes the `height` prop a lie.
- **Harden alpha to 0 or 255**, or you get a halo over the sky gradient.
- **Generate 3–4 candidates.** They cost one generation each. Vary the seed, the
  canvas and the shading hint.
- **Compare in place, at true display size**, next to the sprite it has to live
  with — not zoomed, and not on its own. Compositing the options offline with
  Pillow was faster and more honest than wiring each into the app.
- **Record provenance**, including the rejects and why: job id, seed, canvas,
  palette (`assets/pixellab/props/props.json`).

## Prompting and API notes

- The style knobs (`outline`, `shading`, `detail`, `view`) are documented as
  *weakly* guiding, and that is accurate — they nudge. The palette and the canvas
  size are what actually pin a result down.
- `outline: "single color outline"` / `"selective outline"` matter for fitting soft
  art; the default tends toward a hard black outline that will not sit next to
  pastel work.
- `init_image_strength` is inverted from most img2img APIs: it is how much of the
  input is **kept**. 500 barely moves it, ~150 is a real edit.
- `animate_image` limits: frames max 256×256, and `width × height × frame_count
  ≤ 524288`. At the pig's 189×199 that caps a clip at 8 frames.
- Cost is driven by canvas, not frame count: at 189×199, 4 frames is 3
  generations, 6 is 4, 8 is 5. Halving the frame count saves 40%, so there is no
  reason to under-request frames for cost.
- **The rate limit is 8 jobs in flight**, and it counts submissions, not
  generations. Submit a batch, go do other work, then collect — polling one job
  at a time wastes far more time than the generations take.

## Integrating pixel art (bit us, worth knowing)

An `<img>` sized only by `height`, inside an absolutely positioned
(shrink-to-fit) wrapper, collapses to **zero width**. Preflight sets
`max-width: 100%` on images, and the percentage has no resolved parent width to
measure against, so it resolves to 0. The element is present, loaded, `complete`,
with correct `naturalWidth` — and invisible. `Sprite` sets `max-w-none` to prevent
this. A fixed-height sprite should never be clamped by a percentage.
