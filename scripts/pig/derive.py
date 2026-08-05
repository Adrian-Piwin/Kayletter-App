"""Turn source poses and raw PixelLab output into the clips the atlas is built from.

    python3 scripts/pig/derive.py

The pipeline is one-directional:

    public/sprites/pig-idle.png    the base pose
    assets/pixellab/faces/<v>.png  face variants (see faces.py)
    assets/pixellab/raw/<clip>/    generated frames, exactly as downloaded
      -> derive.py
    assets/pixellab/clips/<clip>/  what build.py packs
      -> build.py                  pig-v2.png + pig-anim.generated.ts

Three ways a clip gets made
--------------------------
  GENERATED  frames come from one `animate_image` job, cleaned and re-grounded.
             The pig's whole body moves, and it stays the same pig, *provided*
             the job pinned the idle pose as both first and last frame — see
             docs/pixellab-notes.md. This is the default for a new clip.
  POSED      generated frames with a body transform layered on top. Weaker: the
             transform resamples art the generator already drew, so it softens.
  COMPOSED   every frame = the idle pose (plus optional feature patches from
             faces.py) under one Pose. No generation at all, so identity cannot
             drift — but nothing can be drawn that the idle pose does not already
             contain. Right for rotations, wrong for anything postural.

Why the eat clip is GENERATED and not COMPOSED
---------------------------------------------
It used to be composed: an inpainted `mouth_open` patch over a `scale_y` squash
standing in for a crouch. Both halves were wrong.

The squash was a resample of the whole sprite, so it did not bend the pig, it
*distorted* it — and a squash cannot move the snout forward toward the food,
which is what bending down actually looks like. The patch was worse: the mask it
was generated with covered the snout, so the model redrew the snout as well as
adding the mouth, and the pig's nose changed shape and position every time the
mouth opened.

A generated clip does not have either problem. The bend is drawn, so the head
comes down *and* forward and the legs fold; and because the model is redrawing
the frame as a whole, the snout stays a snout.

Rules that survive from the composed era
---------------------------------------
- Every source is cropped to the *idle pose's* bounding box, never its own, so a
  frame whose snout juts further down does not shift the whole pig.
- Rotations stay on multiples of 90° where possible: the idle pose's diagonal is
  272px against a 189×199 frame, so a 45° turn would have to shrink ~30% and the
  pig would visibly change size mid-trick.
- A clip's uniform `scale` is held constant across its frames. Varying it per
  frame reads as the pig pulsing rather than moving.
"""

from __future__ import annotations

import json
import math
import shutil
import sys
from dataclasses import dataclass, field
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
from faces import PATCHES, footprint  # noqa: E402
from frame import FRAME_H, FRAME_W  # noqa: E402
from pixels import drop_strays, harden_alpha, reground  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
IDLE_POSE = ROOT / "public" / "sprites" / "pig-idle.png"
FACES_DIR = ROOT / "assets" / "pixellab" / "faces"
RAW_DIR = ROOT / "assets" / "pixellab" / "raw"
CLIPS_DIR = ROOT / "assets" / "pixellab" / "clips"
JOBS = ROOT / "assets" / "pixellab" / "jobs.json"



@dataclass(frozen=True)
class Pose:
    """How to squash, turn, shift and lift one frame."""

    angle: int = 0
    """Clockwise degrees. Multiples of 90 keep the pose full-size."""
    scale: float = 1.0
    scale_x: float = 1.0
    scale_y: float = 1.0
    lift: int = 0
    """Pixels above the ground line, baked into the frame."""
    shift_x: int = 0
    """Negative is in front of the pig, positive behind it (it faces left)."""
    mirror: bool = False


@dataclass(frozen=True)
class Frame:
    patches: tuple[str, ...] = ()
    """Feature patches from faces.py to layer over the idle pose."""
    pose: Pose = field(default_factory=Pose)


@dataclass
class Clip:
    ms: int
    loop: bool
    frames: list[Frame]


def _spin_frames() -> list[Frame]:
    """A turn read as a horizontal squeeze: 90° is edge-on, and beyond that we
    are looking at the pig's other side so the pose is mirrored. Never squeezes
    below a third of its width — past that it stops being a pig."""
    frames: list[Frame] = []
    for step in range(7):  # 0…360 inclusive, so the clip ends facing forward
        radians = math.radians(step * 60)
        cos = math.cos(radians)
        frames.append(
            Frame(
                pose=Pose(
                    scale_x=max(0.32, abs(cos)),
                    lift=round(3 * abs(math.sin(radians))),
                    mirror=cos < 0,
                ),
            )
        )
    return frames


COMPOSED: dict[str, Clip] = {
    "trick_spin": Clip(ms=90, loop=False, frames=_spin_frames()),
    # A jump only has headroom if the airborne frames shrink a little — which
    # happens to read as height anyway.
    "trick_backflip": Clip(
        ms=110,
        loop=False,
        frames=[
            Frame(pose=Pose(scale_x=1.06, scale_y=0.84)),  # crouch to load
            Frame(pose=Pose(angle=90, scale=0.9, lift=14)),
            Frame(pose=Pose(angle=180, scale=0.8, lift=30)),  # upside down
            Frame(pose=Pose(angle=270, scale=0.8, lift=26)),
            Frame(pose=Pose(angle=360, scale=0.9, lift=10)),
            Frame(pose=Pose(scale_x=1.08, scale_y=0.86)),  # land squash
        ],
    ),
    "play_roll": Clip(
        ms=130,
        loop=False,
        frames=[
            Frame(),
            Frame(pose=Pose(angle=90, scale=0.95, shift_x=-4)),
            Frame(pose=Pose(angle=180, scale=0.95, shift_x=-8)),  # on its back
            Frame(pose=Pose(angle=180, scale=0.95, shift_x=-2)),  # hooves wiggle
            Frame(pose=Pose(angle=90, scale=0.95, shift_x=-4)),
            Frame(),
        ],
    ),
}

# Body motion layered onto generated frames — retired. Every clip that used this
# path has been regenerated with the motion drawn instead, because layering a
# transform over generated art has all the problems of COMPOSED (a resample
# distorts rather than bends) *plus* one of its own: it re-centres the bounding
# box, so it throws away the lean or step the frame was drawn with.
#
# The numbers were unambiguous. `play_bounce` posed lost 26% of the pig's mass,
# `trick_sit` 23%, `trick_dance` 17% — the pig visibly shrank mid-clip, which is
# what a uniform `scale` does when the pose needs headroom the frame does not have.
# Regenerated, the same clips hold mass within 3%.
#
# The machinery stays because `Pose` is still what COMPOSED rotations are built
# from. Nothing should be added here.
POSED: dict[str, list[Pose]] = {}


def reference_box() -> tuple[int, int, int, int]:
    """The idle pose's own bounding box — the shared crop for every source."""
    with Image.open(IDLE_POSE) as im:
        box = im.convert("RGBA").getbbox()
    if not box:
        raise SystemExit("pig-idle.png is empty")
    return box


class Poser:
    """Builds a sprite for any set of feature patches, layered over the idle pose.

    Each patch file is the idle pose with one region replaced, so layering is just
    pasting each region in turn — and because `faces.py` proved the regions are
    disjoint, order does not matter. Results are cached: a clip reuses the same
    handful of combinations.
    """

    def __init__(self) -> None:
        self.box = reference_box()
        self.ground = self.box[3]
        self.base = self._load(IDLE_POSE)
        self._cache: dict[tuple[str, ...], Image.Image] = {}

    @staticmethod
    def _load(path: Path) -> Image.Image:
        im = Image.open(path).convert("RGBA")
        if im.size != (FRAME_W, FRAME_H):
            raise SystemExit(f"{path.name}: expected {(FRAME_W, FRAME_H)}, got {im.size}")
        return im

    def missing(self, names: tuple[str, ...]) -> list[str]:
        return sorted(
            n for n in names if n not in PATCHES or not (FACES_DIR / f"{n}.png").exists()
        )

    def sprite(self, names: tuple[str, ...]) -> Image.Image:
        key = tuple(sorted(names))
        if key not in self._cache:
            out = self.base.copy()
            for name in key:
                patch = self._load(FACES_DIR / f"{name}.png")
                # Paste through the patch's own footprint — the same mask faces.py
                # proved it owns — rather than a bounding box, so a patch that had
                # a region reverted does not drag the idle pixels back with it.
                out.paste(patch, (0, 0), footprint(PATCHES[name], out.size))
            # Crop to the idle pose's box, never each patch's own, so an open
            # mouth that juts further down does not shift the whole pig.
            self._cache[key] = out.crop(self.box)
        return self._cache[key]


@dataclass
class Cleanup:
    """What had to be repaired across one clip, for the build log."""

    alpha: int = 0
    strays: int = 0
    regrounded: int = 0

    def __bool__(self) -> bool:
        return bool(self.alpha or self.strays or self.regrounded)

    def __str__(self) -> str:
        parts = []
        if self.alpha:
            parts.append(f"{self.alpha}px alpha hardened")
        if self.strays:
            parts.append(f"{self.strays}px strays erased")
        if self.regrounded:
            parts.append(f"{self.regrounded} frames re-grounded")
        return ", ".join(parts)


def clean(im: Image.Image, tally: Cleanup) -> Image.Image:
    """Repair a generated frame's mechanical defects, before anything is posed.

    Strictly mechanical: nothing here has an opinion about the drawing. Colour is
    deliberately left alone — snapping off-ramp colours onto the idle pose's
    palette sounds tidy and destroys the art, because a clip that draws a new
    feature legitimately needs colours the idle pose does not have. Snapping the
    eat clip turned the dark red inside the pig's mouth into the near-black of its
    eye, so the open mouth read as a hole. `review.py` reports foreign colours
    instead, and a human decides whether they are a mouth or a mistake.

    Order matters: strays have to go before any crop, because a loose pixel out in
    the grass grows the bounding box and would drag the whole pig off centre.
    """
    im, alpha = harden_alpha(im)
    im, strays = drop_strays(im)
    tally.alpha += alpha
    tally.strays += strays
    return im


def cropped(im: Image.Image) -> Image.Image:
    """A frame cropped to its own pixels, for the POSED path."""
    box = im.getbbox()
    return im.crop(box) if box else im


def render(sprite: Image.Image, pose: Pose, ground: int, label: str = "") -> Image.Image:
    """Draw one posed sprite onto the frame contract canvas."""
    im = sprite

    sx, sy = pose.scale_x * pose.scale, pose.scale_y * pose.scale
    if sx != 1.0 or sy != 1.0:
        im = im.resize(
            (max(1, round(im.width * sx)), max(1, round(im.height * sy))), Image.NEAREST
        )

    if pose.angle % 360:
        # Negative is clockwise, the way a left-facing character flips backwards
        # over its own tail.
        im = im.rotate(-pose.angle, resample=Image.NEAREST, expand=True)

    if pose.mirror:
        im = im.transpose(Image.FLIP_LEFT_RIGHT)

    # A pose must never be cropped by the frame edge, so if a transform grew past
    # the canvas, shrink it to fit rather than lose pixels.
    room_h = FRAME_H - pose.lift
    if im.width > FRAME_W or im.height > room_h:
        fit = min(FRAME_W / im.width, room_h / im.height)
        im = im.resize(
            (max(1, int(im.width * fit)), max(1, int(im.height * fit))), Image.NEAREST
        )
        if label:
            print(f"  {label}: shrunk to {fit:.2f} to fit the frame")

    canvas = Image.new("RGBA", (FRAME_W, FRAME_H), (0, 0, 0, 0))
    canvas.paste(
        im,
        ((FRAME_W - im.width) // 2 + pose.shift_x, min(ground, FRAME_H) - pose.lift - im.height),
        im,
    )
    return canvas


def write_clip(name: str, frames: list[Image.Image]) -> Path:
    folder = CLIPS_DIR / name
    folder.mkdir(parents=True, exist_ok=True)
    for old in folder.glob("frame-*.png"):
        old.unlink()
    for i, frame in enumerate(frames):
        frame.save(folder / f"frame-{i:02d}.png")
    return folder


def build_composed(poser: Poser, meta: dict) -> None:
    for name, clip in COMPOSED.items():
        used = tuple(sorted({p for f in clip.frames for p in f.patches}))
        missing = poser.missing(used)
        if missing:
            print(f"{name}: skipped, run faces.py first (missing {missing})")
            continue
        images = [
            render(poser.sprite(f.patches), f.pose, poser.ground, f"{name} frame-{i:02d}")
            for i, f in enumerate(clip.frames)
        ]
        write_clip(name, images)
        meta["clips"][name] = {
            "status": "downloaded",
            "source": "composed",
            "script": "scripts/pig/derive.py",
            "patches": list(used),
            "frames": len(images),
            "ms": clip.ms,
            "loop": clip.loop,
            "downloaded_frames": len(images),
        }
        detail = f"idle + {', '.join(used)}" if used else "idle pose only"
        print(f"{name}: {len(images)} frames (composed from {detail})")


def keep_count(info: dict, available: int) -> int:
    """How many of a job's frames the clip should use.

    A pinned job returns one more frame than it was asked for, and that extra frame
    is the canonical pose again. Whether to keep it depends entirely on whether the
    clip loops, which is why this is derived rather than hand-set:

    - **A loop must drop it.** Frame N duplicates frame 0, so playing both holds the
      canonical pose for two frame-times every cycle — a visible hitch in the
      breathing.
    - **A one-shot must keep it.** For a one-shot the pin is not a duplicate, it is
      the *resolution*: the landing after a hop, the pig standing back up after a
      scratch. Dropping it strands the clip on its most extreme frame, and
      `play_bounce` ends 9px off the ground — a jump that never lands.
    """
    explicit = info.get("keep_frames")
    if explicit:
        return min(explicit, available)
    if info.get("pinned_last_frame") and info.get("loop"):
        return available - 1
    return available


def build_generated(ground: int, meta: dict) -> None:
    """Turn raw generations into clips: clean every frame, then ground or pose it."""
    for raw in sorted(RAW_DIR.glob("*")):
        if not raw.is_dir() or raw.name in COMPOSED:
            continue
        files = sorted(raw.glob("frame-*.png"))
        info = meta.get(raw.name, {})
        files = files[: keep_count(info, len(files))]
        if not files:
            continue
        poses = POSED.get(raw.name)
        # A clip whose action leaves the ground must not be re-grounded: the lift is
        # the whole point, and re-grounding is indistinguishable from deleting it.
        # There is no way to tell a 9px hop from 9px of generator jitter by
        # measurement, so it is declared per clip rather than inferred.
        airborne = bool(meta.get(raw.name, {}).get("airborne"))
        tally = Cleanup()
        frames = []
        for i, path in enumerate(files):
            im = clean(Image.open(path).convert("RGBA"), tally)
            if poses is None:
                # The drawn frames already carry the motion; all they need is a
                # shared baseline, since the generator drifts a few pixels of
                # ground line between frames and that plays back as sinking.
                if not airborne:
                    grounded = reground(im, ground)
                    tally.regrounded += grounded is not im
                    im = grounded
                frames.append(im)
                continue
            pose = poses[min(i, len(poses) - 1)]
            frames.append(render(cropped(im), pose, ground, f"{raw.name} frame-{i:02d}"))
        write_clip(raw.name, frames)
        how = "posed" if poses else "airborne" if airborne else "generated"
        print(f"{raw.name}: {len(frames)} frames ({how})" + (f" — {tally}" if tally else ""))


def adopt_existing_downloads() -> None:
    """One-time migration: clips downloaded before raw/ existed live in clips/."""
    if RAW_DIR.exists():
        return
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    for folder in sorted(CLIPS_DIR.glob("*")):
        if folder.is_dir() and folder.name not in COMPOSED:
            shutil.copytree(folder, RAW_DIR / folder.name)
            print(f"adopted {folder.name} → raw/")


def main() -> None:
    adopt_existing_downloads()
    poser = Poser()
    meta = json.loads(JOBS.read_text()) if JOBS.exists() else {"clips": {}}
    meta.setdefault("clips", {})

    build_generated(poser.ground, meta["clips"])
    build_composed(poser, meta)

    JOBS.write_text(json.dumps(meta, indent=2) + "\n")
    print(f"jobs → {JOBS.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
