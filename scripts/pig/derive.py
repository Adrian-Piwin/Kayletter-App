"""Turn source poses and raw PixelLab output into the clips the atlas is built from.

    python3 scripts/pig/derive.py

The pipeline is one-directional:

    public/sprites/pig-idle.png    the base pose
    assets/pixellab/faces/<v>.png  face variants (see faces.py)
    assets/pixellab/raw/<clip>/    generated frames, exactly as downloaded
      -> derive.py
    assets/pixellab/clips/<clip>/  what build.py packs
      -> build.py                  pig-v2.png + pig-anim.generated.ts

Why clips are composed rather than generated
-------------------------------------------
The pig is a blob character: head and body are one round mass, no neck, tiny
legs. Ask a model for "lowers its head and chews" and it has nothing to
articulate, so it either barely moves or redraws a different pig at a different
size. Both failures showed up in the first two passes.

What reads as an action on this character is a **small drawn change to one
feature** over a **whole-body squash, lean or turn**. So a clip is a list of
frames, each one a set of feature patches plus a body transform:

  COMPOSED  every frame = idle pose + zero or more patches + one Pose. Covers
            eating (mouth and eye change) and spin/backflip/roll (no patches,
            the body turns).
  POSED     legacy: generated frames from raw/ with body motion layered on.
            Clips still on this path are candidates for redoing as COMPOSED.

Patches are layered, not swapped wholesale, because expression has to stay put
when it is not the thing moving: a frame that only opens the mouth keeps the
idle eye pixel-for-pixel. `faces.py` guarantees the footprints are disjoint.

A blob has no neck to bend, so a crouch *is* a vertical squash — but it has to be
deep enough to read as one. Anchored at the feet, `scale_y=0.90` drops the top of
the head ~20px and the snout ~10px, which reads as bending down to the food. A
shallow 0.93 reads as a rendering glitch instead: the same distortion, none of the
intent. There is no room to widen in compensation — the sprite is 187px in a 189px
frame — so squashes here are vertical only.

Every source is cropped to the *idle pose's* bounding box, never its own, so a
patch whose open mouth juts further down still lines up pixel-for-pixel.

Rotations stay on multiples of 90° where possible: the idle pose's diagonal is
272px against a 189×199 frame, so a 45° turn would have to shrink ~30% and the
pig would visibly change size mid-trick.
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


# Only two snout drawings exist — idle's and the open mouth — and they alternate.
# A third would read as the face changing shape rather than the mouth working, so
# the chew beat closes the eye over the *idle* snout instead of drawing a new one.
MOUTH_OPEN = ("mouth_open",)
CHEWING = ("eye_shut",)


def chomp_frames(clip: Clip) -> list[int]:
    """Frames where the jaw shuts — the beats crumbs should fly out on.

    Exported to the manifest so the scene can spawn particles on the chew without
    anyone retyping frame numbers that only exist here.
    """
    return [i for i, f in enumerate(clip.frames) if f.patches == CHEWING]

COMPOSED: dict[str, Clip] = {
    # Two chomps and a swallow. The mouth doing the work means the body only has
    # to lean in and squash a little, which is all this silhouette can do. The
    # eye only closes on the chew beats, so the open-mouth frames keep the idle
    # eye exactly.
    # Down, chomp twice at the strawberry, back up. Both feed clips loop, and both
    # cycles are 8 × 150ms, so the scene can hold whole cycles (see actionHoldMs)
    # and always leave the clip standing upright on the idle frame.
    #
    # The middle four frames all hold the crouch: the bend only reads if the pig
    # *stays* down long enough to be seen chewing there, rather than dipping
    # through the low pose on its way back up.
    "feed_munch": Clip(
        ms=150,
        loop=True,
        frames=[
            Frame(),
            Frame(MOUTH_OPEN, Pose(shift_x=-3, scale_y=0.95)),  # going down
            Frame(MOUTH_OPEN, Pose(shift_x=-6, scale_y=0.90)),  # down at the berry
            Frame(CHEWING, Pose(shift_x=-7, scale_y=0.88)),  # chomp
            Frame(MOUTH_OPEN, Pose(shift_x=-6, scale_y=0.90)),
            Frame(CHEWING, Pose(shift_x=-7, scale_y=0.88)),  # chomp again
            Frame(MOUTH_OPEN, Pose(shift_x=-4, scale_y=0.93)),  # coming up
            Frame(),
        ],
    ),
    # Same rhythm, hungrier: dives deeper, leans further in, and chews on three
    # beats instead of two.
    "feed_gobble": Clip(
        ms=150,
        loop=True,
        frames=[
            Frame(),
            Frame(MOUTH_OPEN, Pose(shift_x=-5, scale_y=0.93)),
            Frame(CHEWING, Pose(shift_x=-9, scale_y=0.87)),
            Frame(MOUTH_OPEN, Pose(shift_x=-10, scale_y=0.86)),
            Frame(CHEWING, Pose(shift_x=-9, scale_y=0.87)),
            Frame(MOUTH_OPEN, Pose(shift_x=-10, scale_y=0.86)),
            Frame(CHEWING, Pose(shift_x=-6, scale_y=0.91)),
            Frame(),
        ],
    ),
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

# Body motion layered onto generated frames — the older, weaker path. A clip's
# uniform `scale` is held constant across its frames on purpose: varying it per
# frame makes the pig look like it is pulsing rather than moving.
POSED: dict[str, list[Pose]] = {
    "play_chase": [
        Pose(scale=0.97),
        Pose(scale=0.97, lift=4),
        Pose(scale=0.97),
        Pose(scale=0.97, lift=4),
    ],
    "play_bounce": [
        Pose(scale=0.9, scale_y=0.92),  # crouch
        Pose(scale=0.9, lift=12),
        Pose(scale=0.9, lift=20),  # top of the hop
        Pose(scale=0.9, lift=8),
        Pose(scale=0.9, scale_y=0.92),  # land
    ],
    "trick_sit": [
        Pose(),
        Pose(angle=-4, scale_y=0.98),
        Pose(angle=-8, scale_y=0.96),
        Pose(angle=-9, scale_y=0.96),
        Pose(angle=-8, scale_y=0.96),
    ],
    "trick_dance": [
        Pose(scale=0.92),
        Pose(scale=0.92, shift_x=-6, lift=6),
        Pose(scale=0.92, lift=14),
        Pose(scale=0.92, shift_x=6, lift=6),
        Pose(scale=0.92, lift=12),
    ],
    "pet_enjoy": [
        Pose(),
        Pose(shift_x=-3, lift=2),
        Pose(shift_x=-5, lift=3),
        Pose(shift_x=-2, lift=1),
    ],
    "pet_end": [
        Pose(),
        Pose(shift_x=-6),
        Pose(shift_x=6),
        Pose(shift_x=-3),
        Pose(),
    ],
}


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


def cropped(path: Path) -> Image.Image:
    """A generated frame cropped to its own pixels (raw/ path only)."""
    im = Image.open(path).convert("RGBA")
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
        chomps = chomp_frames(clip)
        if chomps:
            meta["clips"][name]["chomps"] = chomps
        detail = f"idle + {', '.join(used)}" if used else "idle pose only"
        print(f"{name}: {len(images)} frames (composed from {detail})")


def build_posed(ground: int) -> None:
    for raw in sorted(RAW_DIR.glob("*")):
        if not raw.is_dir() or raw.name in COMPOSED:
            continue
        files = sorted(raw.glob("frame-*.png"))
        if not files:
            continue
        poses = POSED.get(raw.name)
        frames = []
        for i, path in enumerate(files):
            if poses is None:
                # Nothing to add — the drawn frames already carry the motion.
                frames.append(Image.open(path).convert("RGBA"))
                continue
            pose = poses[min(i, len(poses) - 1)]
            frames.append(render(cropped(path), pose, ground, f"{raw.name} frame-{i:02d}"))
        write_clip(raw.name, frames)
        print(f"{raw.name}: {len(frames)} frames ({'posed' if poses else 'as generated'})")


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

    build_posed(poser.ground)
    build_composed(poser, meta)

    JOBS.write_text(json.dumps(meta, indent=2) + "\n")
    print(f"jobs → {JOBS.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
