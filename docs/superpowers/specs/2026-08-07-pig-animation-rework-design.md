# Pig animation rework — pose-to-pose clips

Status: **Implemented, with two sections overturned by measurement — see §9.**
Owner: agent + Adrian
Target version: `0.3.0` (in progress)

Six pig clips do not depict the action they are named for, and five states are being
cut. This spec covers regenerating the six, adding two new poses, removing the five,
and the pipeline change that makes the regeneration work.

Background reading, both of which this spec amends:
[pig-sprite-rework.md](../../pig-sprite-rework.md) (how clips are produced) and
[pixellab-notes.md](../../pixellab-notes.md) (how the tool behaves).

---

## 1. The problem

Six clips render a pig that barely moves:

| Clip | Frames today | What it actually shows |
|---|---|---|
| `idle_scratch` | 9 | The pig blinks. No leg leaves the ground |
| `idle_sniff` | 13 | Eyes close, head dips ~3px. Never reaches the grass |
| `trick_sit` | 7 | A blink and a slight sink. Not a sit |
| `trick_dance` | 7 | A blink. Nothing else moves |
| `play_bounce` | 7 | A small crouch, no readable air |
| `play_roll` | 6 | A rigid 90°/180° rotation of the idle sprite — tipping over, not rolling |

### Why, and why prompting harder will not fix it

The house recipe pins the canonical idle pose as **both** `first_frame_url` and
`last_frame_url`. That kills identity drift, which is why it was adopted and why it
should stay for loops. But it also **flattens amplitude**: the clip interpolates
between two *identical* endpoints, so the model averages the middle back toward the
ends, and the pose that carries the action is the one that gets weakened.

This is already recorded in the notes, unrecognised as a pattern:

- `trick_sit` — three prompts, two seeds, increasingly explicit anatomy, and every
  attempt produced a crouch rather than a sit.
- The frame-count experiment found more frames make the action *mushier*, not
  smoother, "because the model is interpolating between two fixed endpoints".
- The notes' own conclusion, left open: *"a clip whose payoff is a held end-pose
  needs its own approved end pose. The pin cannot be prompted around."*

So the pin is the limiter. Amplitude has to come from an endpoint that is not the
idle pose.

### A second, compounding problem

`review.py` passed all six. It measures mass, eye area, ground line, strays and
foreign colours — every one of which is *conserved* by a clip in which nothing
happens. The notes state the failure mode exactly once, about `play_bounce`:
*"a metric that measures the pig cannot tell you the pig did the wrong thing."*
Nothing in the build asks whether the pig moved, so a dead clip ships quietly.

### Repo/doc drift, discovered while exploring

Commit `a93b79e` "Cleanup animations" rolled several clips back to the original
generation batch without updating the docs or `CHANGELOG.md`. So
`pig-sprite-rework.md` currently describes a single 6-frame `feed` clip and 6-frame
idles that are **not in the repo** — the repo has `feed_munch` + `feed_gobble`, a
13-frame `idle_sniff`, a 13-frame `idle_look` and a 9-frame `idle_scratch`. This spec
corrects the catalogue as part of the work.

---

## 2. Approach — build a clip from approved key poses

A clip stops being "one generation between two copies of the idle pose" and becomes
"a handful of hand-approved poses, plus in-betweens generated *between different
poses*, plus integer translation".

### Step 1 — Harvest an extreme pose

Run `animate_image` with the canonical idle as `first_frame_url`, **no**
`last_frame_url`, `frame_count: 4`.

Open-ended generation is the thing the notes warn against — but the warning is
specifically that *the last frame* drifts, because error accumulates frame over
frame. Early frames do not. So: measure every returned frame against the canonical
pose using the probes `review.py` already has (mass, eye area, foreign colours), and
keep the **deepest frame that still passes**. That frame is a hand-approved pose.

Approved poses live in a new `assets/pixellab/poses/<name>.png`, each one a cleaned
189×199 frame on the frame contract, committed like any other source art.

`frame_count: 4` is deliberate: `animate_image` requires an even count, and with only
four frames the model has to commit to the extreme fast instead of easing into it.

### Step 2 — Generate the outbound leg only

`animate_image(first_frame_url=idle, last_frame_url=<approved extreme>,
frame_count: 4)`.

Now the pin works *for* amplitude rather than against it. Both endpoints are approved
art, and they are **different**, so the model draws a real transition instead of
averaging a bulge back to flat. Identity is still locked at both ends.

### Step 3 — Build the return in code

The return leg is the outbound frames played backwards. It costs zero generations,
and the clip lands on the canonical pose **exactly**, not approximately.

    idle, mid, extreme, extreme, mid, idle

is six played frames from **three drawn ones**. Minimum frames falls out of the
method rather than being imposed on it.

### Step 4 — Code motion is integer translation, and nothing else

`play_bounce` and `play_roll` generate no in-betweens at all: harvest the pose, then
move it.

The retired POSED path is not being revived. The notes condemn it for two specific
reasons, and translation has neither:

- *"A resample distorts, it does not bend"* — translation does not resample. Mass is
  conserved **exactly**, not "within 3%".
- *"Re-centring the bounding box throws away the lean the frame was drawn with"* —
  translation moves the whole 189×199 canvas and never reads a bounding box.

So `derive.py` gains a `Shift(dx, dy)`, applied to a pose's full canvas. No scale, no
rotation, no bbox arithmetic. The existing `Pose`/`render()` machinery stays for the
`trick_backflip` rotation, which is unaffected by this work.

---

## 3. The clips

Bold = a harvested extreme pose. Every clip is a one-shot that **ends** on the
canonical idle pose, so nothing has to blend back into the idle loop. All but
`play_bounce` also start on it; the bounce opens on its crouch, because a jump that
begins from a settled stand reads as hesitant.

| Clip | Drawn poses | Played | Frame order |
|---|---|---|---|
| `idle_scratch` | mid, **leg-up** | 7 | `idle, mid, UP, UP·x+1, UP, mid, idle` |
| `idle_sniff` | mid, **snout-down** | 7 | `idle, mid, DOWN, DOWN·x−2, DOWN, mid, idle` |
| `play_bounce` | crouch, **tuck** | 6 | `crouch, TUCK·y−6, TUCK·y−16, TUCK·y−8, crouch, idle` |
| `play_roll` | tipped, **on-back** | 6 | `idle, TIP·x−4, BACK·x−10, BACK·x−4, TIP·x−6, idle` |
| `trick_sit` | mid, **sit** | 7 | `idle, mid, SIT, SIT, SIT, mid, idle` |
| `trick_dance` | mid, **rear-left**, **rear-right** | 8 | `idle, mid, UP-L, UP-R, UP-L, UP-R, mid, idle` |
| `trick_playdead` *(new)* | mid, **on-side** | 7 | `idle, mid, DEAD, DEAD, DEAD, mid, idle` |
| `pose_sad` *(new)* | **droop** | 1 | A still, for the 404 page |

Notes on individual clips:

- **`idle_scratch`** — the 1px jitter on the held pose *is* the scratch. A scratch is
  a vibration, not a single lift, and a one-pixel shift of an already-approved pose
  buys that for free.
- **`idle_sniff`** — the x-nudge on the held pose reads as snuffling along the grass,
  which is what distinguishes sniffing from simply bending down.
- **`play_bounce`** — flagged `airborne` in `jobs.json`, so `derive.py` does not
  re-ground the hop away. This flag already exists and already has a comment
  explaining that its absence once silently deleted the animation.
- **`play_roll`** and **`trick_playdead`** are both floor poses and must stay
  distinct: roll travels along the ground on its back with legs waving; play dead
  lands on its side and goes rigid.
- **`trick_dance`** harvests *two* extremes from a single open-ended job
  ("rearing up onto its hind legs and swaying its body from side to side"). Mirroring
  one extreme to make the other is not an option: the pig faces left, and a mirror
  would flip its facing mid-clip.
- Exact shift values are indicative. They get tuned against what the generations
  actually return, and reviewed at display size.

### Frame counts

The house standard becomes **3–4 drawn poses, 5–8 played frames**. The old "every
clip is 6 frames" rule was a statement about a single generation's length; it does
not describe a clip assembled from poses, where the played count is whatever the
action needs and the *drawn* count is what costs anything.

Locomotion keeps its exception: `walk` and `play_chase` remain 8 generated frames.

---

## 4. The review gate

`review.py` gains one check: **peak silhouette change vs. frame 0**, as a percentage
of the clip's mass — the count of pixels whose opacity differs from frame 0, at the
frame where that count is highest.

This is the one measurement that catches the failure this spec exists to fix: a clip
that conserves mass, holds identity, has no strays, and does nothing.

Calibration is empirical, not invented. Before setting a threshold, measure every
existing clip. The threshold goes **above** whatever the six dead clips score and
**below** `walk`, `feed` and `play_chase`, which are known-good. A per-clip minimum is
then declared in `jobs.json` so clips that are honestly small — `idle_breathe`,
`idle_blink` — can sit low without bypassing the gate.

It is a **hard** check, unlike the other soft metrics. The distinction the existing
review draws is right: soft metrics have legitimate reasons to move (a crouch changes
height, a squint shrinks the eye), so gating on them trains everyone to pass
`--force`. "The action does not read" has no legitimate reason to be true.

---

## 5. Removals

| Removed | Consequence |
|---|---|
| `idle_look` | Leaves `FLOURISH_WEIGHTS`; flourishes become sniff, scratch, blink |
| `idle_sad` | 404 page moves to `pose_sad` |
| `idle_hungry` | Mood no longer changes the pig's animation at all. Mood still drives the stat bars |
| `trick_spin` | Replaced by `trick_playdead` — `TRICKS` stays 4 long |
| `feed_gobble` | `feed_munch` is renamed `feed`; `chomps: [3,5]` carries over unchanged |

Only a `tricks_unlocked` **count** is persisted (`supabase/schema.sql:52`), never a
trick name, so swapping `spin` for `playdead` needs no migration.

Renaming `feed_munch` to `feed` also makes the docs true again — they already
describe a single `feed` clip.

### Code changes that follow

- `src/lib/pet.ts` — `TRICKS` becomes `["backflip", "dance", "sit", "playdead"]`.
  Still four, so `NOTES_PER_TRICK` and `tricksUnlockedFor` are untouched.
- `src/lib/pig-clips.ts` — `PigActorState` swaps `"spin"` for `"playdead"`;
  `clipForState` loses its `hunger` parameter and its `mood === "sad" | "hungry"`
  branches; `idle_look` leaves `FLOURISH_WEIGHTS`; every `available([...])` fallback
  naming `trick_spin` is repointed; `actionHoldMs` is retuned so each trick holds a
  whole number of its own clip cycles.
- `src/components/garden/GardenScene.tsx` and `src/components/garden/PigActor.tsx` —
  stop threading `hunger` into `clipForState`; `PigActor`'s `?? "spin"` fallback
  becomes `?? "backflip"`.
- `src/app/not-found.tsx` — renders `pose_sad`.
- `assets/pixellab/jobs.json`, `assets/pixellab/clips/`, `assets/pixellab/raw/` —
  entries and directories for removed clips deleted.

Nothing in the runtime (`SpriteSheet`, `useSpriteAnimation`) changes. The manifest
stays the same shape.

---

## 6. Verification

In order, and none of it optional:

1. `npm run sprites` — download → derive → build → review. Now gates on the
   silhouette-change check as well as strays and partial alpha.
2. **Look at every regenerated clip** — the GIF and the strip, at 110px display
   height, **not zoomed**. The notes are firm that zooming in makes you discard
   clips that are fine, and equally firm that numbers cannot tell you the pig did the
   right thing. Re-roll anything that does not read as its action.
3. `npm run lint` — CI runs it before build, so a lint error blocks deploy.
4. `npm run build`.

Budget for re-rolls: the notes say three of four candidates get thrown away, and
nothing here changes that. Estimated cost is 8 harvest jobs plus 5 outbound jobs at
~3 generations each, times re-rolls — 60–120 generations against 1532 remaining.

---

## 7. Documentation to update

- **`docs/pixellab-notes.md`** — add the pose-to-pose recipe; add the
  harvest-from-early-frames finding (drift accumulates toward the last frame, so
  early frames of an open-ended run are usable as approved poses); amend the
  "pin the last frame" section to say the pin locks identity but costs amplitude when
  both ends are the *same* pose.
- **`docs/pig-sprite-rework.md`** — correct the catalogue to what is actually in the
  repo, record the removals, and resolve the two open items (`trick_sit` was blocked
  on a sitting canonical pose; harvesting is how that pose now gets made).
- **`CHANGELOG.md`** — one entry under `0.3.0`, per `VERSIONING.md`.

---

## 8. Risks

| Risk | Mitigation |
|---|---|
| A harvested pose is off-model | It is measured against the canonical (mass, eye, colour) before approval, and approved by eye at display size. The deepest *passing* frame is kept, not the deepest frame |
| The outbound generation drifts | Both endpoints are approved art, so it is pinned exactly as tightly as the old recipe was |
| A translated pose leaves the ground and gets re-grounded away | `airborne` in `jobs.json`, which already exists for this reason |
| A regenerated clip still does not read | The new silhouette-change gate fails the build rather than shipping it quietly |
| The threshold is set so low it never fires | Calibrated against known-good clips (`walk`, `feed`, `play_chase`) and known-dead ones, not chosen by feel |
| `play_roll` and `trick_playdead` read as the same trick | Deliberately differentiated: one travels on its back, the other is rigid on its side |
| Removing a clip leaves a dangling reference | `clipForState` already guards with `available([...])`, and `PigClip` is a union type, so a stale name is a compile error |

---

## 9. What changed during implementation

Two sections of this spec were wrong. Both were caught by measuring rather than by
argument, and the shipped code follows the corrections, not the text above.

### §4's review gate does not work as specified

The spec proposed a hard floor on **absolute** silhouette motion, calibrated "above
whatever the six dead clips score and below `walk`, `feed` and `play_chase`". No such
threshold exists. Measured across the whole clip set, the two groups interleave:

| Reads perfectly | | Dead on arrival | |
|---|---|---|---|
| `play_chase` | 8.3% | `trick_sit` | 9.6% |
| `walk_letter` | 8.3% | `idle_scratch` | 8.6% |
| `walk` | 9.7% | `idle_sniff` | 17.0% |

A gait reads beautifully while moving very little; a dead clip scores high on a blink
plus a whole-body sink. Two filtering attempts — box-downsampling to remove the
generator's 1px edge fringe, and taking the largest *connected* region of change —
reproduced the same ranking, so it is not a noise problem. **Amount of motion is not
correctness of motion.**

Shipped instead: a per-clip **regression** floor. A clip approved by eye records its
motion as `approved_change` (written only by an explicit `review.py --record`, never
as a build side effect), and a rebuild that comes back more than 25% flatter fails.
It cannot tell you a new clip is good; it will not let a good one silently rot — which
is the failure that actually happened, in commit `a93b79e`.

### §2's harvest step needed the opposite frame count, and does not always work

The spec specified `frame_count: 4` for harvesting, reasoning from the notes' finding
that fewer frames force the model to commit to an extreme. That finding is about
**pinned** generation, where the model interpolates between fixed endpoints. Open-ended
generation has nothing pulling it home, so more frames means more *travel*:

| Action | 4 frames | 12 frames |
|---|---|---|
| snout to the ground | dips ~3px, eyes close | reaches the grass ✓ |
| onto its back | stands still | tucks into a ball and rolls ✓ |
| scratch behind the ear | no leg leaves the ground | hind leg lifts ✓ |

The whole first harvest batch was wasted on this.

And for `trick_sit` it failed at any length: two open-ended attempts on top of the
three pinned ones already recorded. **`pig-sit.png`, the pre-rework hand-drawn art, is
what shipped** — mass within 1% of canonical, scaled 0.985 to fit the frame contract
rather than raising it. `pose_sad` likewise adopts `pig-sad.png`. The lesson worth
carrying: check whether someone already drew the pose before spending generations
asking for it.

### Smaller deviations

- **`trick_dance` and `idle_scratch` are carried by rhythm, not pose depth.** The
  generator would not rear this pig fully onto two legs or bring its hoof to its ear.
  Hopping the dance 5px clear on each beat, and alternating two lifted-leg poses at
  90ms with a 1px shake, read as the action where a deeper single pose did not.
- **`play_roll` uses tucked-ball poses**, not the upside-down frames. The generator
  did reach a genuine on-its-back pose at frames 9–12 — and it was unrecognisable, a
  pink blob with no face, so it was rejected despite being exactly what was asked for.
- **No outbound generation was needed.** §2 step 2 planned a pinned idle→extreme job
  per clip; in practice the harvest runs already contained usable in-between frames,
  so every clip was assembled from harvested poses alone. Five planned jobs, zero
  spent.
