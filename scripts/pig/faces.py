"""Build the pig's feature patches from PixelLab inpaints.

    python3 scripts/pig/faces.py
    python3 scripts/pig/faces.py --preview   # draw the region boxes

`PATCHES` is currently empty — every shipping clip is either generated whole or
composed from the idle pose alone. The machinery stays because a patch is still
the only way to draw something the idle pose does not contain in a place a
generation will not reliably put it (`legs_folded` for `trick_sit` is the open
case). It is not the way to change a *pose*; that is what generation is for.

What a patch is
--------------
`inpaint_image` regenerates one rectangle and freezes the rest. It still drifted
~150 pixels outside the mask it was given, so trusting the mask is not enough —
this script keeps only the region it asked for. Outside its footprint a patch is
byte-identical to `pig-idle.png`.

Keep less than you generate
--------------------------
The mask sent to the model and the region kept from the result are separate
things. A mask tight enough to protect a neighbouring feature can be too tight
for the model to draw anything decent in, so a patch may be generated with a
generous box and then have sub-regions `revert`ed to the idle pose.

`keep` minus `revert` is the patch's *footprint*, the pixels it owns. Footprints
must not overlap, so `derive.py` can layer patches in any order and get the same
result. But note the limit that retired the last two patches: reverting protects
a feature's *pixels*, not the model's *idea* of the region. Given a box that
contains the snout, the model draws a new snout, and no amount of reverting
elsewhere puts the original one back.

To add a patch: inpaint against pig-idle.png, note the mask you used, register it
below. Raw downloads are cached, so re-running is free.
"""

from __future__ import annotations

import json
import sys
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path

from PIL import Image, ImageChops

sys.path.insert(0, str(Path(__file__).parent))

ROOT = Path(__file__).resolve().parents[2]
IDLE_POSE = ROOT / "public" / "sprites" / "pig-idle.png"
FACES_DIR = ROOT / "assets" / "pixellab" / "faces"
RAW_DIR = FACES_DIR / "raw"
INDEX = FACES_DIR / "faces.json"
DOWNLOAD = "https://api.pixellab.ai/mcp/images/{job}/download"

# (x, y, w, h) boxes measured off the idle pose. The eye's dark pixels span
# x 53-73, y 78-103; the snout is x 0-42, y 78-122. See --preview.
REGIONS: dict[str, tuple[int, int, int, int]] = {
    "face": (4, 66, 66, 74),
    "eye": (52, 74, 26, 32),
    "legs": (30, 140, 130, 59),
}


@dataclass(frozen=True)
class Patch:
    """One inpainted feature of the idle pose."""

    job: str
    """PixelLab inpaint job id."""
    keep: str
    """Region taken from the result."""
    note: str
    revert: tuple[str, ...] = field(default=())
    """Regions inside `keep` put back to the idle pose."""


# Empty on purpose. The eat clip was the only consumer and is now generated whole
# (see derive.py), which draws the chewing mouth without a patch at all.
#
# Two patches were withdrawn rather than lost:
#   mouth_open  5b8a26d0-f08f-4c9d-8562-a60f48133d4e, keep `face` minus `eye`.
#               Rejected: the `face` box contains the snout, so the model redrew
#               the snout along with the mouth and the pig's nose changed shape
#               and position on every open-mouth frame. A patch is only safe when
#               its box excludes every feature that must not move — and on a face
#               this small there is no room to mask a mouth without the snout.
#   eye_shut    e8e25e4f-3007-4122-8bf4-9fbc4dc7c418, keep `eye`. A good patch,
#               correctly scoped; no current clip needs it.
PATCHES: dict[str, Patch] = {}


def box_of(region: str) -> tuple[int, int, int, int]:
    x, y, w, h = REGIONS[region]
    return (x, y, x + w, y + h)


def footprint(patch: Patch, size: tuple[int, int]) -> Image.Image:
    """The 1-bit mask of pixels this patch actually owns: keep minus revert."""
    mask = Image.new("1", size, 0)
    mask.paste(1, box_of(patch.keep))
    for region in patch.revert:
        mask.paste(0, box_of(region))
    return mask


def fetch_raw(name: str, patch: Patch) -> Path:
    path = RAW_DIR / f"{name}.png"
    if path.exists():
        return path
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(DOWNLOAD.format(job=patch.job)) as response:
        path.write_bytes(response.read())
    print(f"  downloaded {patch.job}")
    return path


def compose(name: str, patch: Patch) -> tuple[Path, int, Image.Image]:
    base = Image.open(IDLE_POSE).convert("RGBA")
    raw = Image.open(fetch_raw(name, patch)).convert("RGBA")
    if raw.size != base.size:
        raise SystemExit(f"{name}: inpaint came back {raw.size}, expected {base.size}")

    mask = footprint(patch, base.size)
    out = base.copy()
    # Replace rather than alpha-composite: the region has to win outright, or the
    # idle feature stays visible under the new one.
    out.paste(raw, (0, 0), mask)

    keep = mask.load()
    drift = sum(
        1
        for py in range(base.height)
        for px in range(base.width)
        if not keep[px, py] and base.getpixel((px, py)) != out.getpixel((px, py))
    )
    path = FACES_DIR / f"{name}.png"
    out.save(path)
    return path, drift, mask


def check_disjoint(masks: dict[str, Image.Image]) -> None:
    items = list(masks.items())
    for i, (a, mask_a) in enumerate(items):
        for b, mask_b in items[i + 1 :]:
            overlap = ImageChops.logical_and(mask_a, mask_b)
            if overlap.getbbox():
                raise SystemExit(f"footprints {a} and {b} overlap — patches would fight")


def preview() -> Path:
    """Draw the region boxes over the idle pose, for picking new masks."""
    from PIL import ImageDraw

    zoom = 3
    base = Image.open(IDLE_POSE).convert("RGBA")
    canvas = Image.new("RGBA", (base.width * zoom, base.height * zoom), (250, 245, 235, 255))
    canvas.alpha_composite(base.resize(canvas.size, Image.NEAREST))
    draw = ImageDraw.Draw(canvas)
    for name, (x, y, w, h) in REGIONS.items():
        draw.rectangle(
            [x * zoom, y * zoom, (x + w) * zoom - 1, (y + h) * zoom - 1],
            outline=(0, 140, 255, 255),
            width=3,
        )
        draw.text((x * zoom + 4, y * zoom + 4), name, fill=(0, 90, 200, 255))
    path = ROOT / "docs" / "previews" / "pig-mask-regions.png"
    path.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(path)
    return path


def main() -> None:
    if "--preview" in sys.argv:
        print(f"regions → {preview().relative_to(ROOT)}")
        return

    FACES_DIR.mkdir(parents=True, exist_ok=True)
    index, masks = {}, {}
    for name, patch in PATCHES.items():
        path, drift, mask = compose(name, patch)
        if drift:
            raise SystemExit(f"{name}: {drift} pixels changed outside its footprint")
        masks[name] = mask
        index[name] = {
            "job": patch.job,
            "keep": patch.keep,
            "revert": list(patch.revert),
            "note": patch.note,
        }
        reverted = f" minus {', '.join(patch.revert)}" if patch.revert else ""
        print(f"{name}: {patch.keep}{reverted} → {path.relative_to(ROOT)}")
    check_disjoint(masks)
    INDEX.write_text(json.dumps(index, indent=2) + "\n")
    print(f"index → {INDEX.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
