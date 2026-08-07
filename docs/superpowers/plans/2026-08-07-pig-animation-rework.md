# Pig Animation Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild six pig clips that do not depict their action, add a play-dead trick and a 404 pose, and remove five states — by building clips from hand-approved key poses instead of interpolating between two copies of the idle pose.

**Architecture:** A clip becomes (a) an *extreme pose* harvested from the early frames of an open-ended `animate_image` run and approved by measurement, (b) an outbound leg generated between the idle pose and that extreme, and (c) a return leg that is the outbound frames reversed in code. `play_bounce` and `play_roll` skip (b) entirely and move an approved pose by whole-pixel integer translation. A new hard check in `review.py` fails any clip whose silhouette barely changes, which is the defect that let all six ship.

**Tech Stack:** Python 3 + Pillow (`scripts/pig/`), PixelLab MCP (`animate_image`), Next.js 16 / React 19 / TypeScript for the runtime.

## Global Constraints

- Frame contract is locked: **189 × 199 px**, ground line **y = 198**, anchor x **94**, alpha strictly **0 or 255**. Source of truth is `scripts/pig/frame.py`.
- `src/lib/pig-anim.generated.ts` is **auto-generated — never hand-edit it.** It is produced by `scripts/pig/build.py`.
- `animate_image` requires an **even** `frame_count`, min 4, max 16, and `width × height × frame_count ≤ 524288`. At 189×199 that caps a clip at 12 frames.
- A pinned job returns **one more frame than requested**; index 0 is the unchanged input.
- **The PixelLab rate limit is 8 jobs in flight.** Submit a batch, do other work, then collect.
- The reference URL in `assets/pixellab/jobs.json` points at `main` and silently follows the branch. Verify it still matches `public/sprites/pig-idle.png` before a batch.
- **Never colour-correct generated frames.** Cleanup is strictly mechanical (harden alpha, drop strays, re-ground). Snapping off-palette colours once turned the inside of the pig's mouth into its eye colour.
- **Judge clips at 110px display height, not zoomed.** Zooming in makes you discard clips that are fine.
- There is **no test suite**. Verification is `npm run sprites` (which ends on `review.py` and exits non-zero on a hard problem), then `npm run lint`, then `npm run build`.
- Commit style per `VERSIONING.md`: update `CHANGELOG.md` under the in-progress `0.3.0` on every commit; the commit message is that entry's short title.
- Do not `git push` — deploys happen on push to `main`.

---

### Task 1: Submit the harvest batch

Generation takes 30–180 s per job and the rate limit is 8 in flight, so the jobs go out **before** any code is written and get collected in Task 6.

**Files:**
- Modify: `assets/pixellab/jobs.json` (add a `poses` block recording each submission)

**Interfaces:**
- Produces: eight PixelLab job ids, recorded under a new top-level `"poses"` key in `jobs.json`, each `{job_id, action, seed, frame_count, harvest}` where `harvest` names the pose(s) to be cut from that job.

- [ ] **Step 1: Verify the reference matches the local canonical pose**

```bash
curl -sL "$(python3 -c "import json;print(json.load(open('assets/pixellab/jobs.json'))['reference'])")" | shasum -a 256
shasum -a 256 public/sprites/pig-idle.png
```

Expected: the two hashes are identical. If they differ, stop — every generation in this plan would be built on the wrong canvas, which is unrepairable downstream.

- [ ] **Step 2: Submit eight open-ended harvest jobs**

All eight use `first_frame_url` = the `reference` URL, **no `last_frame_url`**, `frame_count: 4`, `seed: 55`. Open-endedness is the point: it is what lets the pig reach an extreme instead of being pulled home. Only early frames will be kept, which is where drift has not yet accumulated.

| Pose(s) to harvest | `action` |
|---|---|
| `scratch_up` | `lifting one hind leg up off the ground and reaching it forward to scratch behind its ear, head tilting toward the leg` |
| `sniff_down` | `lowering its head all the way down until its snout touches the ground, front legs splaying forward and rear staying up` |
| `bounce_crouch`, `bounce_tuck` | `crouching down low then springing straight up off the ground with all four legs tucked up under its body` |
| `roll_tip`, `roll_back` | `tipping over sideways onto its back with all four legs sticking up in the air and waving` |
| `sit_mid`, `sit_down` | `folding its hind legs underneath and dropping its rear all the way to the ground so its back slopes up to the shoulders, front legs planted straight` |
| `dance_left`, `dance_right` | `rearing up onto its hind legs with its front legs off the ground, swaying its body from side to side` |
| `playdead_mid`, `playdead_side` | `flopping over onto its side and lying flat on the ground with its legs sticking straight out, completely still` |
| `sad_droop` | `hanging its head down low and slumping its whole body toward the ground` |

Every one of these is **a verb, a body part and a direction**. None names a mood — the notes are explicit that asking for a character gets you a new one drawn, and that is what produced `idle_sad` as a differently-proportioned pig. `sad_droop` is a posture for exactly that reason.

- [ ] **Step 3: Record the submissions**

Add to `assets/pixellab/jobs.json` at the top level (not inside `clips`):

```json
"poses": {
  "scratch_up": { "job_id": "…", "action": "…", "seed": 55, "frame_count": 4, "harvest": ["scratch_up"] }
}
```

One entry per job, keyed by the first pose it yields, with `harvest` listing every pose to be cut from it.

- [ ] **Step 4: Commit**

```bash
git add assets/pixellab/jobs.json
git commit -m "Submit the pose harvest batch"
```

---

### Task 2: Add the silhouette-change gate

This is the check that would have caught all six dead clips. It goes in before any new art so the new art is judged by it.

**Files:**
- Modify: `scripts/pig/pixels.py` (add `silhouette_change`)
- Modify: `scripts/pig/review.py` (report it, gate on it)
- Modify: `assets/pixellab/jobs.json` (per-clip `min_change`)

**Interfaces:**
- Produces: `pixels.silhouette_change(a: Image.Image, b: Image.Image) -> int` — the count of pixels opaque in exactly one of the two frames.
- Produces: `jobs.json` clips may declare `"min_change": <float>`, a fraction of frame 0's mass. Default when absent: `DEFAULT_MIN_CHANGE` in `review.py`.

- [ ] **Step 1: Add the metric to `pixels.py`**

```python
def silhouette_change(a: Image.Image, b: Image.Image) -> int:
    """Pixels opaque in exactly one of two frames — how much the shape moved.

    Every other probe in this project measures what the pig *is*: mass, eye area,
    palette. All of them are conserved by a clip in which nothing happens, which is
    how six clips shipped showing a pig that blinked and did nothing else. This is
    the one number that measures what the pig *did*.

    Symmetric difference rather than centroid or bounding box, because a pose can
    fold a leg under the body without moving either.
    """
    am, bm = opaque_mask(a), opaque_mask(b)
    return sum(
        1
        for y in range(len(am))
        for x in range(len(am[0]))
        if am[y][x] != bm[y][x]
    )
```

- [ ] **Step 2: Measure every existing clip, to calibrate rather than guess**

Add a throwaway script run (do not commit it):

```bash
python3 - <<'EOF'
import sys; sys.path.insert(0, "scripts/pig")
from pathlib import Path
from PIL import Image
from pixels import silhouette_change, opaque_mask
for d in sorted(Path("assets/pixellab/clips").iterdir()):
    fs = [Image.open(p).convert("RGBA") for p in sorted(d.glob("frame-*.png"))]
    if not fs: continue
    mass = sum(sum(r) for r in opaque_mask(fs[0]))
    peak = max(silhouette_change(fs[0], f) for f in fs[1:]) if len(fs) > 1 else 0
    print(f"{d.name:16s} peak {peak:6d}  = {peak/mass*100:5.1f}% of mass")
EOF
```

Expected: `walk`, `play_chase` and `feed_munch` score high; the six named in the spec score low. Record the actual numbers in the commit message.

- [ ] **Step 3: Set the threshold from those numbers**

In `review.py`, add below `FOREIGN_COLOUR`:

```python
# How far a clip's silhouette must move at its most extreme frame, as a fraction of
# frame 0's mass, before the action reads as happening at all.
#
# This is the only *hard* soft-looking check, and the asymmetry is deliberate. Every
# other threshold here has a legitimate reason to trip — a crouch changes height, a
# squint shrinks the eye, an open mouth introduces a dark red — so gating on them
# would train everyone to pass --force. "The action does not read" has no legitimate
# reason to be true of a clip named after an action.
#
# Calibrated, not chosen: measured across the clip set, the clips that read scored
# well above this and the six that were regenerated scored below it. Clips that are
# honestly small — a breath, a blink — declare their own `min_change` in jobs.json.
DEFAULT_MIN_CHANGE = <value from Step 2, between the two groups>
```

- [ ] **Step 4: Report and gate**

In `problems()`, change the signature to accept the frames and the minimum, and append after the per-frame loop:

```python
def problems(
    stats: list[FrameStats],
    base: FrameStats,
    airborne: bool = False,
    frames: list[Image.Image] | None = None,
    min_change: float = DEFAULT_MIN_CHANGE,
) -> list[str]:
    ...
    if frames and len(frames) > 1:
        first = stats[0].mass or 1
        peak = max(silhouette_change(frames[0], f) for f in frames[1:])
        if peak < first * min_change:
            out.append(
                f"HARD clip: silhouette moves {peak / first * 100:.1f}% of mass at its "
                f"most extreme frame, needs {min_change * 100:.0f}% — the action does not read"
            )
    return out
```

Import `silhouette_change` from `pixels`, thread `frames` and `info.get("min_change", DEFAULT_MIN_CHANGE)` through `review()` from `main()`, and print the peak alongside mass in the summary line.

- [ ] **Step 5: Declare minimums for the clips that are honestly small**

In `assets/pixellab/jobs.json`, add `"min_change"` to `idle_breathe`, `idle_blink`, `pet_enjoy` and `pet_end` at whatever value their measured peak comfortably clears. These clips are small on purpose — a breath and a blink are not failed actions.

- [ ] **Step 6: Run the review and confirm the gate fires on exactly the right clips**

```bash
python3 scripts/pig/review.py
```

Expected: HARD failures on `idle_scratch`, `idle_sniff`, `trick_sit`, `trick_dance`, `play_bounce` — and **not** on `walk`, `feed_munch`, `play_chase`, `idle_breathe`, `idle_blink`. If a clip outside the spec's list fails, the threshold is too high; lower it rather than exempting the clip.

`play_roll` is expected to pass, because a rigid rotation moves a great many pixels. That is correct and is not a bug in the check — the check measures whether the shape moved, not whether the motion is good. `play_roll` is being replaced for a reason the notes state plainly (a rotation is not a roll), not for a reason a metric can see.

- [ ] **Step 7: Commit**

```bash
git add scripts/pig/pixels.py scripts/pig/review.py assets/pixellab/jobs.json CHANGELOG.md
git commit -m "Fail the build when a clip's action does not read"
```

---

### Task 3: Write the pose harvester

**Files:**
- Create: `scripts/pig/harvest.py`
- Create: `assets/pixellab/poses/` (directory, populated in Task 6)

**Interfaces:**
- Produces: `python3 scripts/pig/harvest.py <job_id> <label>` — downloads a job's frames to `assets/pixellab/raw/pose_<label>/`, cleans each, prints per-frame identity numbers, and writes a contact sheet to `docs/previews/poses/<label>.png`.
- Produces: `python3 scripts/pig/harvest.py --keep <label> <frame_index> <pose_name>` — promotes one reviewed frame to `assets/pixellab/poses/<pose_name>.png`.

- [ ] **Step 1: Write the script**

```python
"""Cut an approved key pose out of an open-ended generation.

    python3 scripts/pig/harvest.py <job_id> <label>          # download + measure
    python3 scripts/pig/harvest.py --keep <label> 2 sit_down # promote one frame

Why an open-ended job, when every other clip in this project is pinned at both
ends
-----------------------------------------------------------------------------
The pin exists because open-ended generation drifts. But it drifts *cumulatively*:
error accumulates frame over frame, so the worst frame is always the last one. The
notes record this precisely — `pet_end` and `play_bounce` "finished as a different
pig", `idle_look` "turned into a chunkier pig facing the other way halfway
through". Every one of those failures is at the end.

Early frames are not drifted. So an open-ended run is the cheapest way to get a
pose the canonical pose does not contain, provided you take it from the front of
the clip and prove it is still the same pig before you keep it.

That proof is what this script prints. The rule is: keep the *deepest frame that
still passes*, never the deepest frame.

And it has to be open-ended, because pinning is exactly what prevents the pig from
reaching an extreme — the model averages the middle back toward two identical
endpoints. That is why three attempts at a pinned "sit" produced a crouch.
"""

from __future__ import annotations

import json
import shutil
import sys
import urllib.request
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
from frame import FRAME_H, FRAME_W  # noqa: E402
from pixels import drop_strays, harden_alpha, opaque_mask, palette_of, silhouette_change  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
IDLE_POSE = ROOT / "public" / "sprites" / "pig-idle.png"
RAW_DIR = ROOT / "assets" / "pixellab" / "raw"
POSES_DIR = ROOT / "assets" / "pixellab" / "poses"
OUT_DIR = ROOT / "docs" / "previews" / "poses"


def download(job_id: str, dest: Path) -> list[Path]:
    dest.mkdir(parents=True, exist_ok=True)
    idx = 0
    while True:
        url = f"https://api.pixellab.ai/mcp/images/{job_id}/download?index={idx}"
        try:
            urllib.request.urlretrieve(url, dest / f"frame-{idx:02d}.png")
        except Exception:
            break
        idx += 1
    return sorted(dest.glob("frame-*.png"))


def clean(im: Image.Image) -> Image.Image:
    """The same mechanical repair every generated frame gets. No colour correction."""
    im, _ = harden_alpha(im.convert("RGBA"))
    im, _ = drop_strays(im)
    return im


def mass(im: Image.Image) -> int:
    return sum(sum(row) for row in opaque_mask(im))


def measure(im: Image.Image, base: Image.Image, palette) -> dict:
    from pixels import dist2

    px = im.load()
    eye = foreign = 0
    known: dict[tuple[int, int, int], bool] = {}
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a != 255:
                continue
            colour = (r, g, b)
            if colour not in known:
                known[colour] = min(dist2(colour, c) for c in palette) > 24**2
            foreign += known[colour]
            eye += dist2(colour, (0x39, 0x0A, 0x14)) < 40**2
    return {
        "mass": mass(im),
        "eye": eye,
        "foreign": foreign,
        "change": silhouette_change(base, im),
    }


def main() -> None:
    args = sys.argv[1:]
    if args[:1] == ["--keep"]:
        label, index, name = args[1], int(args[2]), args[3]
        src = RAW_DIR / f"pose_{label}" / f"frame-{index:02d}.png"
        POSES_DIR.mkdir(parents=True, exist_ok=True)
        im = clean(Image.open(src))
        if im.size != (FRAME_W, FRAME_H):
            raise SystemExit(f"{src}: expected {(FRAME_W, FRAME_H)}, got {im.size}")
        im.save(POSES_DIR / f"{name}.png")
        print(f"{name} ← {src.relative_to(ROOT)}")
        return

    job_id, label = args[0], args[1]
    files = download(job_id, RAW_DIR / f"pose_{label}")
    if not files:
        raise SystemExit(f"{label}: job {job_id} returned no frames (still running?)")

    base = Image.open(IDLE_POSE).convert("RGBA")
    palette = palette_of(IDLE_POSE)
    frames = [clean(Image.open(f)) for f in files]
    base_mass = mass(base)

    print(f"\n{label}: {len(frames)} frames  (canonical mass {base_mass})")
    for i, im in enumerate(frames):
        m = measure(im, base, palette)
        print(
            f"  frame {i:02d}  mass {m['mass'] / base_mass:.2f}  eye {m['eye']:4d}"
            f"  foreign {m['foreign']:5d}  change {m['change'] / base_mass * 100:5.1f}%"
        )

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    sheet = Image.new("RGBA", (len(frames) * FRAME_W, FRAME_H), (198, 228, 245, 255))
    for i, im in enumerate(frames):
        sheet.alpha_composite(im, (i * FRAME_W, 0))
    sheet.save(OUT_DIR / f"{label}.png")
    print(f"\n  → {(OUT_DIR / f'{label}.png').relative_to(ROOT)}")
    print("  Keep the DEEPEST frame that still passes, not the deepest frame.")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Verify it runs against an already-downloaded job**

```bash
python3 scripts/pig/harvest.py --keep nonexistent 0 x 2>&1 | head -2
```

Expected: a clean `FileNotFoundError`-shaped failure, not a syntax or import error. The real exercise happens in Task 6.

- [ ] **Step 3: Commit**

```bash
git add scripts/pig/harvest.py CHANGELOG.md
git commit -m "Add a pose harvester for approved key poses"
```

---

### Task 4: Remove the five retired states

Done before the new art so the atlas, the manifest and the type union shrink first — every later task then compiles against the final shape.

**Files:**
- Delete: `assets/pixellab/clips/{idle_look,idle_sad,idle_hungry,trick_spin,feed_gobble}/`, `assets/pixellab/raw/{idle_look,idle_sad,idle_hungry}/`
- Rename: `assets/pixellab/clips/feed_munch/` → `assets/pixellab/clips/feed/`
- Modify: `assets/pixellab/jobs.json`, `scripts/pig/build.py:28-50`, `scripts/pig/derive.py:129-157`
- Modify: `src/lib/pet.ts:9`, `src/lib/pig-clips.ts`, `src/components/garden/PigActor.tsx`, `src/components/garden/GardenScene.tsx`, `src/app/not-found.tsx`

**Interfaces:**
- Produces: `TRICKS = ["backflip", "dance", "sit", "playdead"] as const`
- Produces: `clipForState(args: { state: PigActorState; mood: "happy" | "okay" | "sad" | "hungry"; hasLetter: boolean; flourish?: ClipName | null }): PigClip` — **no `hunger`**
- Produces: `PigActorState = "idle" | "walk" | "eat" | "play" | "playdead" | "backflip" | "sit" | "dance" | "pet"`

- [ ] **Step 1: Delete the retired clip art and rename feed**

```bash
git rm -r assets/pixellab/clips/idle_look assets/pixellab/clips/idle_sad \
          assets/pixellab/clips/idle_hungry assets/pixellab/clips/trick_spin \
          assets/pixellab/clips/feed_gobble
git rm -r assets/pixellab/raw/idle_look assets/pixellab/raw/idle_sad \
          assets/pixellab/raw/idle_hungry
git mv assets/pixellab/clips/feed_munch assets/pixellab/clips/feed
```

- [ ] **Step 2: Update `jobs.json`**

Delete the `idle_look`, `idle_sad`, `idle_hungry`, `trick_spin` and `feed_gobble` entries. Rename `feed_munch` to `feed`, keeping its `ms: 150`, `loop: true` and `chomps: [3, 5]` exactly as they are — the beats were measured off this art and still describe it.

- [ ] **Step 3: Update `CLIP_ORDER` in `build.py`**

```python
CLIP_ORDER = [
    "idle_breathe",
    "walk",
    "walk_letter",
    "idle_blink",
    "idle_sniff",
    "idle_scratch",
    "idle_letter",
    "pose_sad",
    "feed",
    "play_chase",
    "play_bounce",
    "play_roll",
    "trick_backflip",
    "trick_sit",
    "trick_dance",
    "trick_playdead",
    "pet_enjoy",
    "pet_end",
]
```

- [ ] **Step 4: Drop `trick_spin` from `derive.py`**

Remove the `"trick_spin"` entry from `COMPOSED` and the `_spin_frames()` function above it. `trick_backflip` and its `Pose`/`render()` machinery stay — a backflip is still a rigid-body rotation and still the right use of composing.

- [ ] **Step 5: Update `src/lib/pet.ts:9`**

```ts
export const TRICKS = ["backflip", "dance", "sit", "playdead"] as const;
```

Still four entries, so `NOTES_PER_TRICK`, `tricksUnlockedFor` and the `tricks_unlocked` column are untouched. Only a count is ever persisted (`supabase/schema.sql:52`), never a trick name, so no migration is needed.

- [ ] **Step 6: Update `src/lib/pig-clips.ts`**

Replace `"spin"` with `"playdead"` in `PigActorState`. Then:

```ts
export function clipForState(args: {
  state: PigActorState;
  mood: "happy" | "okay" | "sad" | "hungry";
  hasLetter: boolean;
  flourish?: ClipName | null;
}): PigClip {
  const { state, mood, hasLetter, flourish } = args;

  switch (state) {
    case "walk":
      if (hasLetter) return available(["walk_letter", "idle_letter", "walk", "idle_breathe"]);
      return available(["walk", "play_chase", "idle_breathe"]);
    case "eat":
      return available(["feed", "idle_breathe"]);
    case "play":
      return available(["play_chase", "walk", "idle_breathe"]);
    case "backflip":
      return available(["trick_backflip", "idle_breathe"]);
    case "sit":
      return available(["trick_sit", "idle_breathe"]);
    case "dance":
      return available(["trick_dance", "idle_breathe"]);
    case "playdead":
      return available(["trick_playdead", "play_roll", "idle_breathe"]);
    case "pet":
      return available(["pet_enjoy", "idle_breathe"]);
    case "idle":
    default:
      if (hasLetter) return available(["idle_letter", "idle_breathe"]);
      if (flourish) return available([flourish, "idle_breathe"]);
      // Mood no longer changes the animation: the two mood idles were prompted as
      // adjectives rather than postures and came back as a differently proportioned
      // pig. Mood still reads from the stat bars.
      return available(["idle_breathe"]);
  }
}
```

`mood` stays in the signature — `GardenScene` passes it and it is still the honest input to this function even though no branch reads it today. Prefix it `void mood;`… **no**: instead destructure only what is used and leave `mood` in the type, so a future mood clip has an obvious home. If lint complains about the unused binding, drop `mood` from the destructure but keep it in the parameter type.

Then `clipForTrick`:

```ts
export function clipForTrick(trick: Trick): PigActorState {
  if (trick === "backflip") return "backflip";
  if (trick === "sit") return "sit";
  if (trick === "dance") return "dance";
  return "playdead";
}
```

Then remove `idle_look` from `FLOURISH_WEIGHTS`:

```ts
const FLOURISH_WEIGHTS: { name: ClipName; weight: number }[] = [
  { name: "idle_sniff", weight: 3 },
  { name: "idle_scratch", weight: 3 },
  { name: "idle_blink", weight: 1 },
];
```

Then `actionHoldMs` — each trick holds a whole number of its own clip cycles, so the pig is never yanked out of a pose mid-motion:

```ts
export function actionHoldMs(state: PigActorState): number {
  switch (state) {
    // Two whole cycles of the 8-frame, 150ms feed loop. Holding a multiple of the
    // cycle matters: the clip starts and ends upright on the idle pose, so the pig
    // is never yanked out of the crouch mid-chew.
    case "eat":
      return 2400;
    case "play":
      return 3300;
    case "sit":
      return 1400;
    case "playdead":
      return 1400;
    case "backflip":
      return 1000;
    case "dance":
      return 1200;
    case "pet":
      return 0; // gesture-driven
    default:
      return 0;
  }
}
```

Recheck these against the clips' real `frames × ms` once Task 12 has built them, and adjust so each is ≥ one full cycle.

- [ ] **Step 7: Update the callers**

`src/components/garden/PigActor.tsx:100` — drop `hunger` from the `clipForState` call. Line 148's `?? "spin"` becomes `?? "backflip"`. Leave the `hunger` prop on the component if the stat bar still uses it; remove it if nothing else reads it.

`src/components/garden/GardenScene.tsx:313` — `clipForState({ state: "eat", mood, hasLetter: false })`. Update the comment above it, which currently explains a hunger-based choice that no longer exists.

- [ ] **Step 8: Point the 404 at the new pose**

`src/app/not-found.tsx:6`:

```ts
const clip = "pose_sad" in PIG_CLIPS ? "pose_sad" : "idle_breathe";
```

The existence check is already there and is what keeps this compiling before Task 11 lands the art.

- [ ] **Step 9: Rebuild and verify**

```bash
npm run sprites
npm run lint
npm run build
```

Expected: the atlas shrinks, the manifest loses the five clips and gains `feed`, `review.py` still fails on the five clips being regenerated in Tasks 6–12 (that is correct and expected until they are rebuilt — record it, do not suppress it), and lint and build pass.

Because `review.py` gates `npm run sprites`, run the steps individually until Task 12:

```bash
python3 scripts/pig/derive.py && python3 scripts/pig/build.py
```

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "Retire the spin, look, sad and hungry states and collapse feed to one clip"
```

---

### Task 5: Build clips from approved poses

**Files:**
- Modify: `scripts/pig/derive.py`

**Interfaces:**
- Produces: `Shift(dx: int = 0, dy: int = 0)` — a whole-pixel translation of a full 189×199 canvas. Negative `dy` is up; negative `dx` is toward the pig's face (it faces left).
- Produces: `PoseClip(ms: int, loop: bool, frames: list[tuple[str, Shift]])` where each `str` is a pose name resolving to `assets/pixellab/poses/<name>.png`, or the literal `"idle"` for the canonical pose.
- Produces: `POSE_CLIPS: dict[str, PoseClip]` — the registry Tasks 6–12 add to.

- [ ] **Step 1: Add `Shift` and the pose loader**

```python
@dataclass(frozen=True)
class Shift:
    """A whole-pixel translation of a full frame. The only motion applied to a pose.

    Deliberately not a `Pose`. The retired POSED path failed for two reasons the
    notes state plainly, and translation has neither:

      - "A resample distorts, it does not bend." Translation does not resample, so
        mass is conserved *exactly* rather than within 3%. The posed clips lost
        17-26% of the pig and nobody caught it by eye for months.
      - "Re-centring the bounding box throws away the lean the frame was drawn
        with." Translation moves the whole canvas and never reads a bbox.

    So there is no scale and no rotation here on purpose. Anything that needs to
    bend gets drawn, not transformed.
    """

    dx: int = 0
    dy: int = 0
    """Negative is up. Negative dx is toward the pig's face — it faces left."""


@dataclass
class PoseClip:
    ms: int
    loop: bool
    frames: list[tuple[str, Shift]]
    """(pose name, translation). "idle" resolves to the canonical pose."""
    airborne: bool = False


POSES_DIR = ROOT / "assets" / "pixellab" / "poses"

POSE_CLIPS: dict[str, PoseClip] = {}
```

- [ ] **Step 2: Add the builder**

```python
def build_pose_clips(meta: dict) -> None:
    """Assemble clips from hand-approved key poses, moved by integer translation."""
    for name, clip in POSE_CLIPS.items():
        missing = sorted(
            {p for p, _ in clip.frames if p != "idle" and not (POSES_DIR / f"{p}.png").exists()}
        )
        if missing:
            print(f"{name}: skipped, harvest these poses first ({missing})")
            continue
        cache: dict[str, Image.Image] = {}
        images = []
        for pose_name, shift in clip.frames:
            if pose_name not in cache:
                src = IDLE_POSE if pose_name == "idle" else POSES_DIR / f"{pose_name}.png"
                im = Image.open(src).convert("RGBA")
                if im.size != (FRAME_W, FRAME_H):
                    raise SystemExit(f"{src.name}: expected {(FRAME_W, FRAME_H)}, got {im.size}")
                cache[pose_name] = im
            base = cache[pose_name]
            if shift.dx or shift.dy:
                canvas = Image.new("RGBA", (FRAME_W, FRAME_H), (0, 0, 0, 0))
                canvas.paste(base, (shift.dx, shift.dy), base)
                base = canvas
            images.append(base)
        write_clip(name, images)
        meta["clips"][name] = {
            **meta["clips"].get(name, {}),
            "status": "downloaded",
            "source": "poses",
            "script": "scripts/pig/derive.py",
            "poses": sorted({p for p, _ in clip.frames}),
            "frames": len(images),
            "ms": clip.ms,
            "loop": clip.loop,
            "downloaded_frames": len(images),
            **({"airborne": True} if clip.airborne else {}),
        }
        print(f"{name}: {len(images)} frames (poses: {', '.join(sorted({p for p, _ in clip.frames}))})")
```

- [ ] **Step 3: Wire it into `main()` and stop `build_generated` from clobbering pose clips**

```python
def main() -> None:
    adopt_existing_downloads()
    poser = Poser()
    meta = json.loads(JOBS.read_text()) if JOBS.exists() else {"clips": {}}
    meta.setdefault("clips", {})

    build_generated(poser.ground, meta["clips"])
    build_composed(poser, meta)
    build_pose_clips(meta)

    JOBS.write_text(json.dumps(meta, indent=2) + "\n")
    print(f"jobs → {JOBS.relative_to(ROOT)}")
```

In `build_generated`, extend the skip so a pose clip's leftover `raw/` frames cannot overwrite the assembled clip:

```python
if not raw.is_dir() or raw.name in COMPOSED or raw.name in POSE_CLIPS:
    continue
```

Also skip any directory whose name starts with `pose_` — those are harvest downloads, not clips:

```python
if raw.name.startswith("pose_"):
    continue
```

- [ ] **Step 4: Verify nothing changed while `POSE_CLIPS` is empty**

```bash
python3 scripts/pig/derive.py && python3 scripts/pig/build.py && git diff --stat
```

Expected: no change to `pig-anim.generated.ts` or the atlas. An empty registry must be a no-op.

- [ ] **Step 5: Commit**

```bash
git add scripts/pig/derive.py CHANGELOG.md
git commit -m "Assemble clips from approved key poses"
```

---

### Task 6: Harvest and approve the eight poses

**Files:**
- Create: `assets/pixellab/poses/*.png` (11 poses from 8 jobs)
- Modify: `assets/pixellab/jobs.json` (record which frame index each pose came from)

**Interfaces:**
- Produces: `assets/pixellab/poses/{scratch_up,sniff_down,bounce_crouch,bounce_tuck,roll_tip,roll_back,sit_mid,sit_down,dance_left,dance_right,playdead_mid,playdead_side,sad_droop}.png`

- [ ] **Step 1: Download and measure each job**

For each entry in `jobs.json`'s `poses` block:

```bash
python3 scripts/pig/harvest.py <job_id> <label>
```

- [ ] **Step 2: Read every contact sheet at native size**

Open each `docs/previews/poses/<label>.png`. For each, pick the frame with the **highest `change`** among those where `mass` is within 0.85–1.15 of canonical, `eye` is non-zero or plausibly squinting, and `foreign` is under ~250. That is the "deepest frame that still passes" rule, made concrete.

If no frame in a job passes, **re-roll that job with a different seed rather than accepting a marginal frame.** A bad pose contaminates every frame of the clip built from it, unlike a bad in-between which is on screen for 150 ms.

- [ ] **Step 3: Promote the chosen frames**

```bash
python3 scripts/pig/harvest.py --keep <label> <index> <pose_name>
```

For the multi-pose jobs, take the *mid* pose from an earlier frame than the extreme: `sit_mid` is the frame between idle and `sit_down`, `bounce_crouch` precedes `bounce_tuck`, `roll_tip` precedes `roll_back`, `playdead_mid` precedes `playdead_side`. `dance_left` and `dance_right` are the two opposite lean extremes of the sway.

If a mid pose is not present in the job's frames, leave it out — Task 7's outbound generation draws in-betweens for the clips that need them, and `bounce`/`roll` do not.

- [ ] **Step 4: Record provenance**

For each pose, add to its `jobs.json` `poses` entry: `"kept": {"<pose_name>": <frame index>}` and, for any re-rolled job, a `"rejected"` map from job id to the reason — matching the convention the `clips` entries already use.

- [ ] **Step 5: Commit**

```bash
git add assets/pixellab/poses assets/pixellab/raw docs/previews/poses assets/pixellab/jobs.json CHANGELOG.md
git commit -m "Harvest approved key poses for the reworked clips"
```

---

### Task 7: Submit the outbound generation batch

Four clips need drawn in-betweens: `idle_scratch`, `idle_sniff`, `trick_sit`, `trick_dance`. `trick_playdead` needs them too. `play_bounce` and `play_roll` need none.

**Files:**
- Modify: `assets/pixellab/jobs.json`

- [ ] **Step 1: Submit five pinned jobs**

Each is `animate_image(first_frame_url=<reference>, last_frame_url=<pose URL>, frame_count=4, seed=55)`.

The pose files are local, so pass them as `last_frame_base64` — or push the branch and use a raw URL. **Prefer base64 here despite the tool's warning about truncation**, because a URL pointing at an unpushed branch silently 404s and the job then generates open-ended, which is the exact failure this whole plan exists to fix. Verify the returned job actually pinned by checking its last frame against the pose file in Task 8.

| Clip | `last_frame` | `action` |
|---|---|---|
| `idle_scratch` | `scratch_up.png` | `lifting one hind leg up off the ground toward its ear` |
| `idle_sniff` | `sniff_down.png` | `lowering its head down toward the ground` |
| `trick_sit` | `sit_down.png` | `folding its hind legs underneath and dropping its rear to the ground` |
| `trick_dance` | `dance_left.png` | `rearing up onto its hind legs` |
| `trick_playdead` | `playdead_side.png` | `toppling over sideways toward the ground` |

Each `action` describes only the **outbound half**. The return is reversed in code, so asking for a round trip here would spend frames on motion that is never used.

- [ ] **Step 2: Record the job ids** in each clip's `jobs.json` entry, with `action`, `seed`, `pinned_last_frame: true` and a `note` naming the pose it was pinned to.

- [ ] **Step 3: Commit**

```bash
git add assets/pixellab/jobs.json
git commit -m "Submit the outbound generation batch"
```

---

### Task 8: Build `play_bounce` and `play_roll` from poses

These need no generation, so they land while Task 7's jobs run.

**Files:**
- Modify: `scripts/pig/derive.py` (`POSE_CLIPS`)

- [ ] **Step 1: Register both clips**

```python
POSE_CLIPS: dict[str, PoseClip] = {
    # A jump is one drawn pose moved up and down. Translation, not scale: the posed
    # version of this clip lost 26% of the pig's mass to a uniform `scale` and read
    # as the pig shrinking mid-hop.
    #
    # It opens on the crouch rather than the idle pose — a jump that begins from a
    # settled stand reads as hesitant — and closes on the idle pose so nothing has
    # to blend back into the idle loop.
    "play_bounce": PoseClip(
        ms=120,
        loop=False,
        airborne=True,
        frames=[
            ("bounce_crouch", Shift()),
            ("bounce_tuck", Shift(dy=-6)),
            ("bounce_tuck", Shift(dy=-16)),
            ("bounce_tuck", Shift(dy=-8)),
            ("bounce_crouch", Shift()),
            ("idle", Shift()),
        ],
    ),
    # Rolling reads as travel, which is why the old version did not: it rotated the
    # idle sprite in place, so the pig tipped over rigidly and came back. Here the
    # on-back pose is drawn, and it moves along the ground and returns.
    "play_roll": PoseClip(
        ms=130,
        loop=False,
        frames=[
            ("idle", Shift()),
            ("roll_tip", Shift(dx=-4)),
            ("roll_back", Shift(dx=-10)),
            ("roll_back", Shift(dx=-4)),
            ("roll_tip", Shift(dx=-6)),
            ("idle", Shift()),
        ],
    ),
}
```

- [ ] **Step 2: Build and review**

```bash
python3 scripts/pig/derive.py && python3 scripts/pig/build.py
python3 scripts/pig/review.py play_bounce play_roll
```

Expected: both clean, both clearing the silhouette-change threshold. `play_bounce` prints its lift per frame because it is `airborne`; confirm the lift actually reaches ~16px and is not flat.

- [ ] **Step 3: Look at both GIFs at display size**

Open `docs/previews/review/play_bounce.gif` and `play_roll.gif`. The bounce must read as leaving the ground; the roll must read as the pig going over and travelling, not tipping and righting in place. Tune the `Shift` values and rebuild until they do — this costs nothing, unlike a regeneration.

- [ ] **Step 4: Commit**

```bash
git add scripts/pig/derive.py assets/pixellab CHANGELOG.md
git commit -m "Rebuild the bounce and roll from drawn poses"
```

---

### Task 9: Assemble the five generated clips

**Files:**
- Modify: `scripts/pig/derive.py`

**Interfaces:**
- Consumes: `Shift`, `PoseClip`, `POSE_CLIPS` from Task 5; the poses from Task 6; the outbound jobs from Task 7.

- [ ] **Step 1: Download each outbound job and check it actually pinned**

```bash
python3 scripts/pig/download_clips.py
python3 scripts/pig/review.py --dir assets/pixellab/raw/trick_sit
```

For each: confirm the **last** raw frame matches the pose it was pinned to. If it does not, the pin did not take (a 404 on the pinned frame, or the base64 was truncated) and the job must be resubmitted — do not build on it.

- [ ] **Step 2: Register the five clips**

The outbound job returns `[idle, g1, g2, g3, extreme]`. Reversing gives the return leg for free. Use the raw frames directly as poses by promoting the useful in-betweens:

```bash
python3 scripts/pig/harvest.py --keep ... # not applicable: these live in raw/<clip>/
```

Instead, extend `PoseClip` frame names to accept `raw:<clip>/<index>` — **no.** Keep it simpler: promote the one in-between each clip needs into `poses/` with the same `--keep` mechanism, pointing at the outbound job's download directory. Add to `harvest.py`'s `--keep` branch a fallback so `pose_<label>` falls back to `<label>` when the former does not exist:

```python
src = RAW_DIR / f"pose_{label}" / f"frame-{index:02d}.png"
if not src.exists():
    src = RAW_DIR / label / f"frame-{index:02d}.png"
```

Then promote each clip's best mid frame — typically index 2 of 4 — as `<clip>_mid`, and register:

```python
    # Amplitude comes from a drawn extreme, not from a prompt. The old version of
    # each of these pinned the *idle* pose at both ends, so the model averaged the
    # middle back toward two identical endpoints and the action never reached an
    # extreme — three attempts at a pinned "sit" all produced a crouch. Pinning the
    # idle pose against a *different* approved pose makes the same mechanism work
    # for the motion instead of against it.
    #
    # The return leg is the outbound frames reversed. It costs no generation and it
    # lands on the canonical pose exactly rather than approximately.
    "idle_scratch": PoseClip(
        ms=140,
        loop=False,
        frames=[
            ("idle", Shift()),
            ("scratch_mid", Shift()),
            ("scratch_up", Shift()),
            # A scratch is a vibration, not a single lift. One pixel of jitter on an
            # already-approved pose buys that without another generation.
            ("scratch_up", Shift(dx=1)),
            ("scratch_up", Shift()),
            ("scratch_mid", Shift()),
            ("idle", Shift()),
        ],
    ),
    "idle_sniff": PoseClip(
        ms=140,
        loop=False,
        frames=[
            ("idle", Shift()),
            ("sniff_mid", Shift()),
            ("sniff_down", Shift()),
            # The nudge is what separates snuffling along the grass from simply
            # bending down to it.
            ("sniff_down", Shift(dx=-2)),
            ("sniff_down", Shift()),
            ("sniff_mid", Shift()),
            ("idle", Shift()),
        ],
    ),
    "trick_sit": PoseClip(
        ms=167,
        loop=False,
        frames=[
            ("idle", Shift()),
            ("sit_mid", Shift()),
            ("sit_down", Shift()),
            ("sit_down", Shift()),
            ("sit_down", Shift()),
            ("sit_mid", Shift()),
            ("idle", Shift()),
        ],
    ),
    "trick_dance": PoseClip(
        ms=130,
        loop=False,
        frames=[
            ("idle", Shift()),
            ("dance_mid", Shift()),
            ("dance_left", Shift()),
            ("dance_right", Shift()),
            ("dance_left", Shift()),
            ("dance_right", Shift()),
            ("dance_mid", Shift()),
            ("idle", Shift()),
        ],
    ),
    "trick_playdead": PoseClip(
        ms=150,
        loop=False,
        frames=[
            ("idle", Shift()),
            ("playdead_mid", Shift()),
            ("playdead_side", Shift()),
            ("playdead_side", Shift()),
            ("playdead_side", Shift()),
            ("playdead_mid", Shift()),
            ("idle", Shift()),
        ],
    ),
```

`dance_left` and `dance_right` must **not** be a mirrored pair — the pig faces left, and a mirror would flip its facing mid-clip. Both are harvested from the sway job as separate drawn frames.

- [ ] **Step 3: Build and review**

```bash
python3 scripts/pig/derive.py && python3 scripts/pig/build.py
python3 scripts/pig/review.py idle_scratch idle_sniff trick_sit trick_dance trick_playdead
```

Expected: all five clean, all five clearing the silhouette threshold.

- [ ] **Step 4: Look at every GIF at display size and judge the action, not the numbers**

The whole point of this rework is that the numbers passed while the clips did nothing. For each: does it read as *scratching*, *sniffing the grass*, *sitting*, *dancing on two legs*, *playing dead*? If not, the pose is the thing to re-roll, not the timing.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Rebuild the scratch, sniff, sit and dance from drawn poses"
```

---

### Task 10: Ship the play-dead trick end to end

**Files:**
- Modify: `src/lib/pig-clips.ts`, `src/components/garden/PigActor.tsx`

- [ ] **Step 1: Confirm the wiring from Task 4 resolves**

`trick_playdead` now exists in the manifest, so `clipForState({state: "playdead", …})` should return it rather than falling through to `play_roll`.

```bash
npx tsc --noEmit
```

- [ ] **Step 2: Check the hold covers the clip**

`trick_playdead` is 7 frames at 150 ms = 1050 ms. `actionHoldMs("playdead")` is 1400 ms, so the pose lands and holds briefly before returning to idle. Confirm the same for `sit` (7 × 167 = 1169 ms vs 1400) and `dance` (8 × 130 = 1040 ms vs 1200). Adjust `actionHoldMs` if any clip's real duration exceeds its hold.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "Teach the pig to play dead"
```

---

### Task 11: Ship the 404 pose

**Files:**
- Modify: `scripts/pig/derive.py` (`POSE_CLIPS`), `src/app/not-found.tsx`

- [ ] **Step 1: Register a one-frame clip**

```python
    # A still, not an animation: the 404 page wants a pig that looks like it lost
    # something, and the two mood *loops* this replaces were prompted as adjectives
    # and came back as a differently proportioned pig.
    "pose_sad": PoseClip(ms=1000, loop=False, frames=[("sad_droop", Shift())]),
```

Add `"pose_sad": {"min_change": 0}` to `jobs.json` — a one-frame clip has no second frame to compare against, so the gate must not be asked to judge it.

- [ ] **Step 2: Verify the gate handles a single frame**

```bash
python3 scripts/pig/derive.py && python3 scripts/pig/build.py && python3 scripts/pig/review.py pose_sad
```

Expected: no crash and no hard failure. The check is guarded by `len(frames) > 1`, so a one-frame clip skips it regardless.

- [ ] **Step 3: Confirm the 404 renders it**

`src/app/not-found.tsx:6` already reads `"pose_sad" in PIG_CLIPS` from Task 4. Run `npm run dev` and load a missing route.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "Give the 404 page its own pig pose"
```

---

### Task 12: Full verification

**Files:** none — this task only runs things.

- [ ] **Step 1: The full pipeline, gated**

```bash
npm run sprites
```

Expected: `0 hard problem(s)` and exit 0. This is the first run where the whole chain must pass, including the new silhouette gate on every clip.

- [ ] **Step 2: Lint and build**

```bash
npm run lint
npm run build
```

- [ ] **Step 3: Review every clip at display size, one last time**

Open every `docs/previews/review/*.gif`. Confirm none of the untouched clips regressed when the atlas was repacked, and that the eight new or rebuilt ones each read as their action.

- [ ] **Step 4: Exercise it in the app**

```bash
npm run dev
```

On a recipient page: watch the idle flourishes cycle (sniff, scratch, blink — no look), feed the pig, play, and run each of the four tricks. Confirm no clip snaps back to idle mid-pose and the strawberry crumbs still land on the chews.

---

### Task 13: Correct the documentation

The docs currently describe a repo that does not exist — commit `a93b79e` rolled clips back without updating them.

**Files:**
- Modify: `docs/pixellab-notes.md`, `docs/pig-sprite-rework.md`, `CHANGELOG.md`

- [ ] **Step 1: `docs/pixellab-notes.md`**

Amend "Pin the last frame. This is the whole trick." — the pin is still right, but the section must say what this rework learned: pinning the *same* pose at both ends locks identity **and costs amplitude**, because the model averages the middle toward two identical endpoints. Fold in the "The pin's one real limit" section, whose two blocked clips (`trick_sit`, `idle_letter`) are now unblocked in principle by harvesting.

Add a new section on the pose-to-pose recipe: harvest from an open-ended run's early frames (drift is cumulative, so it lives at the end), approve by measurement, generate the outbound leg between two *different* approved poses, reverse it in code.

Amend "Six frames, and why not four or eight" — the finding stands for a single generation, but a clip assembled from poses has a *drawn* count and a *played* count, and only the drawn count costs anything.

- [ ] **Step 2: `docs/pig-sprite-rework.md`**

Correct §4's catalogue to the clips actually in the repo. Record the five removals and the two additions. Resolve "What is still open" — `trick_sit` was blocked on a sitting canonical pose, and harvesting is how that pose now gets made. Update the atlas frame/clip counts at the end of §4 from the real `build.py` output.

Add the new `review.py` check to §7's hard list, with the reason it is hard while everything adjacent is soft.

- [ ] **Step 3: `CHANGELOG.md`** — one entry under `0.3.0` per `VERSIONING.md`.

- [ ] **Step 4: Commit**

```bash
git add docs CHANGELOG.md
git commit -m "Document the pose-to-pose recipe"
```

---

## Self-Review

**Spec coverage:**

| Spec section | Task |
|---|---|
| §2 Step 1 harvest | 1, 3, 6 |
| §2 Step 2 outbound | 7, 9 |
| §2 Step 3 reverse in code | 5, 9 |
| §2 Step 4 integer translation | 5, 8 |
| §3 all eight clips | 8 (bounce, roll), 9 (scratch, sniff, sit, dance, playdead), 11 (pose_sad) |
| §4 review gate | 2 |
| §5 removals | 4 |
| §6 verification | 12 |
| §7 documentation | 13 |
| §8 risks | Mitigations appear in the steps: pose approval in 6 Step 2, pin verification in 9 Step 1, `airborne` in 8, calibration in 2 Step 2 |

**Known soft spot:** Task 9 Step 2 promotes in-between frames out of the outbound jobs into `poses/`, which is a slightly awkward reuse of the harvester. It is the right trade — the alternative is a second frame-addressing syntax inside `PoseClip` — but if a clip needs more than one in-between, reconsider rather than promoting three near-identical poses.
