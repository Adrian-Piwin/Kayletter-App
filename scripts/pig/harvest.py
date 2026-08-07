"""Cut an approved key pose out of an open-ended generation.

    python3 scripts/pig/harvest.py <job_id> <label>           # download + measure
    python3 scripts/pig/harvest.py --keep <label> 2 sit_down  # promote one frame

Why an open-ended job, when every other clip here is pinned at both ends
-----------------------------------------------------------------------
The pin exists because open-ended generation drifts. But it drifts *cumulatively*:
error accumulates frame over frame, so the worst frame is always the last one. The
notes record this precisely — `pet_end` and `play_bounce` "finished as a different
pig", `idle_look` "turned into a chunkier pig facing the other way halfway
through". Every one of those failures is at the end.

Early frames are not drifted. So an open-ended run is the cheapest way to reach a
pose the canonical pose does not contain, provided you take it from the front of
the clip and prove it is still the same pig before keeping it. That proof is what
this script prints.

**Keep the deepest frame that still passes, never simply the deepest frame.**

And it has to be open-ended, because pinning is exactly what stops the pig reaching
an extreme: with the same pose at both ends the model averages the middle back
toward it. That is why three attempts at a pinned "sit" all produced a crouch.

A harvested pose is worth more scrutiny than a generated in-between, because a bad
in-between is on screen for 150ms while a bad pose contaminates every frame of the
clip built from it.
"""

from __future__ import annotations

import sys
import urllib.request
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
from frame import FRAME_H, FRAME_W  # noqa: E402
from pixels import (  # noqa: E402
    dist2,
    drop_strays,
    harden_alpha,
    opaque_mask,
    palette_of,
    silhouette_change,
)

ROOT = Path(__file__).resolve().parents[2]
IDLE_POSE = ROOT / "public" / "sprites" / "pig-idle.png"
RAW_DIR = ROOT / "assets" / "pixellab" / "raw"
POSES_DIR = ROOT / "assets" / "pixellab" / "poses"
OUT_DIR = ROOT / "docs" / "previews" / "poses"

EYE = (0x39, 0x0A, 0x14)
PALETTE_TOLERANCE = 24

# What a frame has to hold to still be the same pig. Wider than review.py's clip
# thresholds on purpose: a pose is *meant* to be an extreme, so it may legitimately
# squint or change height. What it may not do is change size or gain a palette.
MASS_RANGE = (0.85, 1.15)
FOREIGN_MAX = 250


def download(job_id: str, dest: Path) -> list[Path]:
    """Fetch every frame of a job by walking indices until one 404s."""
    dest.mkdir(parents=True, exist_ok=True)
    for old in dest.glob("frame-*.png"):
        old.unlink()
    idx = 0
    while True:
        url = f"https://api.pixellab.ai/mcp/images/{job_id}/download?index={idx}"
        try:
            urllib.request.urlretrieve(url, dest / f"frame-{idx:02d}.png")
        except Exception:
            (dest / f"frame-{idx:02d}.png").unlink(missing_ok=True)
            break
        idx += 1
    return sorted(dest.glob("frame-*.png"))


def clean(im: Image.Image) -> Image.Image:
    """The mechanical repair every generated frame gets. Colour is left alone.

    Same two operations, in the same order, as derive.py: strays have to go before
    anything reads a bounding box, or a loose pixel out in the grass drags the whole
    pig off centre.
    """
    im, _ = harden_alpha(im.convert("RGBA"))
    im, _ = drop_strays(im)
    return im


def mass(im: Image.Image) -> int:
    return sum(sum(row) for row in opaque_mask(im))


def measure(im: Image.Image, base: Image.Image, palette, base_mass: int) -> dict:
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
                known[colour] = min(dist2(colour, c) for c in palette) > PALETTE_TOLERANCE**2
            foreign += known[colour]
            eye += dist2(colour, EYE) < 40**2
    ratio = mass(im) / base_mass
    return {
        "mass": ratio,
        "eye": eye,
        "foreign": foreign,
        "change": silhouette_change(base, im) / base_mass,
        "passes": MASS_RANGE[0] <= ratio <= MASS_RANGE[1] and foreign <= FOREIGN_MAX,
    }


def keep(label: str, index: int, name: str) -> None:
    src = RAW_DIR / f"pose_{label}" / f"frame-{index:02d}.png"
    if not src.exists():
        # An outbound clip generation lives under its clip name, not pose_<label>.
        src = RAW_DIR / label / f"frame-{index:02d}.png"
    if not src.exists():
        raise SystemExit(f"no frame {index:02d} for {label}")
    im = clean(Image.open(src))
    if im.size != (FRAME_W, FRAME_H):
        raise SystemExit(f"{src}: expected {(FRAME_W, FRAME_H)}, got {im.size}")
    POSES_DIR.mkdir(parents=True, exist_ok=True)
    im.save(POSES_DIR / f"{name}.png")
    print(f"{name}.png ← {src.relative_to(ROOT)}")


def adopt(source: Path, name: str) -> None:
    """Take a hand-drawn pose from public/sprites/ onto the frame contract.

    The pre-rework art is a set of hand-drawn poses of this exact pig — a real sit,
    a real dejected slump — and the generator cannot draw any of them. Twelve frames
    of open-ended "sitting down on its rear" produced a pig that shut its eyes and
    shrank; the notes record three earlier attempts doing the same. The prior for
    "round pig standing side-on" is simply stronger than the prompt.

    What made these unusable as *rendered art* was that each is a different canvas
    with the pig at a different size, so the pig jumped between states. That is a
    normalisation problem, not an art problem: as a key pose, one is worth more than
    anything a generation returns, because the pixels are the same artist's.

    Fitting is a uniform scale, only ever down, and only when the subject genuinely
    does not fit — pig-sit is 202px tall against a 199px frame, so it scales by
    0.985 and loses three pixel rows. Worth being precise about the trade: the notes
    propose raising the frame contract instead, which is cleaner in principle but
    ripples into the atlas, `SpriteSheet` and every display height in the app. A 1.5%
    scale costs ~3% of the pig's mass, well inside the 15% the review tolerates and
    far inside the 23% the posed sit this replaces was losing.
    """
    im = clean(Image.open(source))
    box = im.getbbox()
    if not box:
        raise SystemExit(f"{source}: empty")
    subject = im.crop(box)
    fit = min(FRAME_W / subject.width, FRAME_H / subject.height, 1.0)
    if fit < 1.0:
        subject = subject.resize(
            (max(1, round(subject.width * fit)), max(1, round(subject.height * fit))),
            Image.NEAREST,
        )
        print(f"  scaled {fit:.3f} to fit the {FRAME_W}×{FRAME_H} contract")
    canvas = Image.new("RGBA", (FRAME_W, FRAME_H), (0, 0, 0, 0))
    # Centre horizontally and stand it on the ground line, the same registration
    # every other frame gets — a pose that floats is worse than one that is 3px short.
    canvas.paste(
        subject,
        ((FRAME_W - subject.width) // 2, FRAME_H - 1 - subject.height),
        subject,
    )
    # Re-clean: a NEAREST downscale can strand a pixel that was only just connected.
    canvas, _ = drop_strays(canvas)
    POSES_DIR.mkdir(parents=True, exist_ok=True)
    canvas.save(POSES_DIR / f"{name}.png")

    base = Image.open(IDLE_POSE).convert("RGBA")
    print(f"{name}.png ← {source.relative_to(ROOT)}   mass {mass(canvas) / mass(base):.2f} of canonical")


def survey(job_id: str, label: str) -> None:
    files = download(job_id, RAW_DIR / f"pose_{label}")
    if not files:
        raise SystemExit(f"{label}: job {job_id} returned no frames (still running?)")

    base = Image.open(IDLE_POSE).convert("RGBA")
    palette = palette_of(IDLE_POSE)
    base_mass = mass(base)
    frames = [clean(Image.open(f)) for f in files]

    print(f"\n{label}: {len(frames)} frames   (canonical mass {base_mass})")
    best = None
    for i, im in enumerate(frames):
        m = measure(im, base, palette, base_mass)
        flag = "ok " if m["passes"] else "REJECT"
        print(
            f"  frame {i:02d}  mass {m['mass']:.2f}  eye {m['eye']:4d}"
            f"  foreign {m['foreign']:5d}  change {m['change'] * 100:5.1f}%  {flag}"
        )
        if m["passes"] and (best is None or m["change"] > best[1]):
            best = (i, m["change"])

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    sheet = Image.new("RGBA", (len(frames) * FRAME_W, FRAME_H), (198, 228, 245, 255))
    for i, im in enumerate(frames):
        sheet.alpha_composite(im, (i * FRAME_W, 0))
    sheet.save(OUT_DIR / f"{label}.png")
    print(f"  → {(OUT_DIR / f'{label}.png').relative_to(ROOT)}")
    if best:
        print(f"  deepest passing frame: {best[0]:02d} ({best[1] * 100:.1f}% change)")
    else:
        print("  nothing passes — re-roll with another seed rather than taking a marginal frame")


def main() -> None:
    args = sys.argv[1:]
    if not args:
        raise SystemExit(__doc__)
    if args[0] == "--keep":
        keep(args[1], int(args[2]), args[3])
        return
    if args[0] == "--adopt":
        adopt(Path(args[1]) if Path(args[1]).is_absolute() else ROOT / args[1], args[2])
        return
    survey(args[0], args[1])


if __name__ == "__main__":
    main()
