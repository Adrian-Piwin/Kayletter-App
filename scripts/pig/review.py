"""Judge a clip before it ships: does it still look like the pig, and is it clean?

    python3 scripts/pig/review.py                  # every clip in clips/
    python3 scripts/pig/review.py feed walk        # only clips matching these
    python3 scripts/pig/review.py --dir some/path  # a candidate folder, e.g. a
                                                   # fresh download in raw/

Why this exists
---------------
Every bad clip we shipped was bad in a way a still frame hides. Played back, the
pig changed mass, lost its eye, or grew a detached pixel in the grass — and all
of those are trivially measurable, so nobody should be squinting at a contact
sheet to find them.

The checks compare against the **canonical idle pose**, which is the identity
every clip has to preserve. Two families:

  hard    semi-transparent pixels and detached pixel islands. Neither is ever
          intentional, on any clip, so these fail.
  soft    mass, width, ground line, eye and colour drift. A crouch is *supposed*
          to change height and a chewing mouth is *supposed* to introduce a dark
          red the idle pose never needed, so these are reported with a threshold
          rather than enforced. The numbers are there to tell "he bent down"
          apart from "he became another pig".

Note the palette reference is the idle pose's own colours, not `palette.py`'s
eight-entry ramp. The ramp is aspirational: `pig-idle.png` actually ships 47
colours, so checking against the ramp flags every frame including the source and
tells you nothing.

The eye is the strongest identity probe available for free: it is the only
near-black cluster on an otherwise pink character, so its area and position pin
the head. When a generated clip silently swaps in a different pig, the eye is
what disappears first.

Outputs, per clip, under docs/previews/review/:
  <clip>-strip.png    frames at true display height — judge it at the size users see
  <clip>-zoom.png     the same frames at 2x, for spotting stray pixels
  <clip>-drift.png    each frame over frame 0's silhouette, so drift is visible
  <clip>.gif          the clip actually playing, at its own frame timing
"""

from __future__ import annotations

import json
import sys
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).parent))
from frame import DISPLAY_HEIGHT, FRAME_H, FRAME_W  # noqa: E402
from pixels import dist2, islands, opaque_mask, palette_of  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
IDLE_POSE = ROOT / "public" / "sprites" / "pig-idle.png"
CLIPS_DIR = ROOT / "assets" / "pixellab" / "clips"
JOBS = ROOT / "assets" / "pixellab" / "jobs.json"
OUT_DIR = ROOT / "docs" / "previews" / "review"

EYE = (0x39, 0x0A, 0x14)
"""The pig's near-black eye — the only dark cluster on the sprite."""

# How far a colour may sit from the idle pose's nearest colour before it counts
# as foreign. Wide enough to tolerate the generator's own resampling fringe,
# narrow enough that a berry red or a black outline is caught.
PALETTE_TOLERANCE = 24
# An opaque blob detached from the body is a generation artefact at any size —
# every part of the pig, tail curl included, is connected to the rest.
STRAY_MAX = 0
# Soft thresholds, as a fraction of the idle pose.
MASS_DRIFT = 0.15
WIDTH_DRIFT = 0.10
EYE_DRIFT = 0.60
# Foreign colour worth mentioning. A drawn feature the idle pose lacks — the dark
# red inside an open mouth — is a few hundred pixels; a restyled pig is thousands.
FOREIGN_COLOUR = 250


def reference_palette() -> tuple[tuple[int, int, int], ...]:
    """Every colour the canonical pose uses — the identity a clip must stay inside."""
    return palette_of(IDLE_POSE)


@dataclass
class FrameStats:
    index: int
    mass: int
    """Opaque pixel count — the pig's drawn area. Conserved by any real pose."""
    box: tuple[int, int, int, int]
    eye_mass: int
    eye_at: tuple[float, float] | None
    foreign: int
    """Pixels whose colour the idle pose does not contain."""
    soft_alpha: int
    strays: list[int]
    """Sizes of opaque islands that are not the body."""

    @property
    def width(self) -> int:
        return self.box[2] - self.box[0]

    @property
    def height(self) -> int:
        return self.box[3] - self.box[1]

    @property
    def ground(self) -> int:
        return self.box[3]


def measure(im: Image.Image, index: int, palette: tuple[tuple[int, int, int], ...]) -> FrameStats:
    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()
    mass = foreign = soft = 0
    eye_pixels: list[tuple[int, int]] = []
    # Colours repeat heavily inside one frame, so the nearest-palette search is
    # memoised — without it a 189x199 frame is ~38k linear scans of 47 colours.
    known: dict[tuple[int, int, int], bool] = {}
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            if a != 255:
                soft += 1
                continue
            mass += 1
            colour = (r, g, b)
            if colour not in known:
                known[colour] = min(dist2(colour, c) for c in palette) > PALETTE_TOLERANCE**2
            if known[colour]:
                foreign += 1
            if dist2(colour, EYE) < 40**2:
                eye_pixels.append((x, y))

    sizes = [len(r) for r in islands(opaque_mask(im))]
    eye_at = None
    if eye_pixels:
        eye_at = (
            sum(p[0] for p in eye_pixels) / len(eye_pixels),
            sum(p[1] for p in eye_pixels) / len(eye_pixels),
        )
    return FrameStats(
        index=index,
        mass=mass,
        box=im.getbbox() or (0, 0, 0, 0),
        eye_mass=len(eye_pixels),
        eye_at=eye_at,
        foreign=foreign,
        soft_alpha=soft,
        strays=[s for s in sizes[1:] if s > STRAY_MAX],
    )


def problems(stats: list[FrameStats], base: FrameStats, airborne: bool = False) -> list[str]:
    """Everything wrong with the clip, measured against the canonical pose.

    `airborne` suppresses the ground-line check only. A clip that jumps is *meant*
    to leave the ground, so on a hop the ground line is the signal rather than the
    defect — reporting it would train you to ignore the one check that catches a
    pig sinking into the grass.
    """
    out: list[str] = []
    for s in stats:
        tag = f"frame {s.index:02d}"
        if s.soft_alpha:
            out.append(f"HARD {tag}: {s.soft_alpha} semi-transparent px (halo risk)")
        if s.foreign > FOREIGN_COLOUR:
            out.append(
                f"SOFT {tag}: {s.foreign} px in colours the idle pose does not have "
                "— a new feature, or a restyled pig?"
            )
        if s.strays:
            out.append(f"HARD {tag}: detached blobs {s.strays} px — stray pixels")
        if abs(s.mass - base.mass) > base.mass * MASS_DRIFT:
            out.append(
                f"SOFT {tag}: mass {(s.mass / base.mass - 1) * 100:+.0f}% — body changed size"
            )
        if abs(s.width - base.width) > base.width * WIDTH_DRIFT:
            out.append(f"SOFT {tag}: width {(s.width / base.width - 1) * 100:+.0f}%")
        if s.ground != base.ground and not airborne:
            out.append(f"SOFT {tag}: ground line y={s.ground}, canonical is y={base.ground}")
        if base.eye_mass and s.eye_mass == 0:
            out.append(f"SOFT {tag}: no eye — either a blink or a different pig")
        elif base.eye_mass and abs(s.eye_mass - base.eye_mass) > base.eye_mass * EYE_DRIFT:
            out.append(f"SOFT {tag}: eye {s.eye_mass}px vs {base.eye_mass}px — face redrawn?")
    return out


def strip(frames: list[Image.Image], height: int, gap: int = 4) -> Image.Image:
    """Frames side by side, each scaled to `height`, on the scene's sky blue."""
    scale = height / FRAME_H
    w = max(1, round(FRAME_W * scale))
    sheet = Image.new("RGBA", (len(frames) * (w + gap), height), (198, 228, 245, 255))
    for i, f in enumerate(frames):
        sheet.alpha_composite(f.resize((w, height), Image.NEAREST), (i * (w + gap), 0))
    return sheet


def drift_sheet(frames: list[Image.Image], zoom: int = 1) -> Image.Image:
    """Every frame with frame 0's silhouette drawn under it in a contrast colour.

    Anything that moved shows as blue sticking out; anything that vanished shows
    as blue where the pig used to be. Far faster to read than two contact sheets.
    """
    ghost = Image.new("RGBA", frames[0].size, (0, 0, 0, 0))
    ghost.paste((40, 110, 220, 110), (0, 0), frames[0].split()[3].point(lambda a: 255 if a else 0))
    w, h = FRAME_W * zoom, FRAME_H * zoom
    sheet = Image.new("RGBA", (len(frames) * w, h), (255, 252, 248, 255))
    for i, f in enumerate(frames):
        cell = ghost.copy()
        cell.alpha_composite(f)
        sheet.alpha_composite(cell.resize((w, h), Image.NEAREST), (i * w, 0))
    return sheet


def label(im: Image.Image, text: str) -> Image.Image:
    ImageDraw.Draw(im).text((4, 2), text, fill=(20, 20, 20, 255))
    return im


def load(folder: Path) -> list[Image.Image]:
    return [Image.open(p).convert("RGBA") for p in sorted(folder.glob("frame-*.png"))]


def review(name: str, folder: Path, ms: int, airborne: bool = False) -> list[str]:
    frames = load(folder)
    if not frames:
        return [f"HARD {name}: no frames in {folder}"]
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    palette = reference_palette()
    base = measure(Image.open(IDLE_POSE), -1, palette)
    stats = [measure(f, i, palette) for i, f in enumerate(frames)]

    label(strip(frames, DISPLAY_HEIGHT), name).save(OUT_DIR / f"{name}-strip.png")
    label(strip(frames, DISPLAY_HEIGHT * 2), name).save(OUT_DIR / f"{name}-zoom.png")
    drift_sheet(frames).save(OUT_DIR / f"{name}-drift.png")
    frames[0].convert("P", palette=Image.ADAPTIVE).save(
        OUT_DIR / f"{name}.gif",
        save_all=True,
        append_images=[f.convert("P", palette=Image.ADAPTIVE) for f in frames[1:]],
        duration=ms,
        loop=0,
        disposal=2,
        transparency=255,
    )

    found = problems(stats, base, airborne)
    print(f"\n{name}: {len(frames)} frames @ {ms}ms" + (" (airborne)" if airborne else ""))
    print(
        "  mass "
        + " ".join(f"{s.mass / base.mass:.2f}" for s in stats)
        + "  |  h "
        + " ".join(str(s.height) for s in stats)
        + "  |  eye "
        + " ".join(str(s.eye_mass) for s in stats)
        # Height alone cannot distinguish a crouch from a hop, so an airborne clip
        # gets its clearance printed: how far the lowest pixel sits off the ground.
        + ("  |  lift " + " ".join(str(base.ground - s.ground) for s in stats) if airborne else "")
    )
    for line in found:
        print(f"  {line}")
    if not found:
        print("  clean")
    return found


def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if "--dir" in sys.argv:
        folder = Path(sys.argv[sys.argv.index("--dir") + 1])
        review(folder.name, folder if folder.is_absolute() else ROOT / folder, 150)
        print(f"\npreviews → {OUT_DIR.relative_to(ROOT)}")
        return

    meta = json.loads(JOBS.read_text()).get("clips", {}) if JOBS.exists() else {}
    names = sorted(p.name for p in CLIPS_DIR.iterdir() if p.is_dir())
    if args:
        names = [n for n in names if any(a in n for a in args)]
    elif OUT_DIR.exists():
        # Previews are written per clip, so a retired clip would otherwise leave its
        # own behind — and a stale strip of a clip that no longer ships is worse
        # than no strip at all.
        for stale in OUT_DIR.iterdir():
            if stale.is_file() and stale.name.split("-")[0].split(".")[0] not in names:
                stale.unlink()

    failures = 0
    for name in names:
        info = meta.get(name, {})
        found = review(
            name, CLIPS_DIR / name, int(info.get("ms", 150)), bool(info.get("airborne"))
        )
        failures += sum(1 for f in found if f.startswith("HARD"))
    print(f"\npreviews → {OUT_DIR.relative_to(ROOT)}")
    print(f"{failures} hard problem(s)")
    # Non-zero so `npm run sprites` stops on a hard problem. Only hard ones gate:
    # every soft warning on this clip set is a pose doing its job.
    if failures:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
