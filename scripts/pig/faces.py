"""Build the pig's feature patches from PixelLab inpaints.

    python3 scripts/pig/faces.py
    python3 scripts/pig/faces.py --preview   # draw the region boxes

Why inpainting and not generation
--------------------------------
The pig is a blob character: head and body are one round mass with no neck, so
there is nothing to "lower" or "turn". Asking a model to redraw it in a new pose
gets you a *different pig* — `edit_image` came back with a giant round body and
stubby legs. What reads as an action here is a small change to one feature over a
whole-body squash or lean.

`inpaint_image` is the right tool: it regenerates one rectangle and freezes the
rest. It still drifted ~150 pixels outside the mask, so this script keeps only
the region it asked for. Outside its footprint each patch is byte-identical to
`pig-idle.png`, which is what pins the pig's size across every clip.

Keep less than you generate
--------------------------
The mask sent to the model and the region kept from the result are separate
things, and they should be. This face is tiny — eye, snout, blush, nothing else —
so a mask tight enough to leave the eye alone is too tight for the model to draw
a decent open mouth in. So `mouth_open` is generated with a generous face mask
and then has the `eye` box reverted to the idle pose. The model gets room to
draw; the eye still cannot change on a frame that only opens the mouth.

That is what `keep` and `revert` express, and a patch's *footprint* — keep minus
revert — is what gets layered. Footprints must not overlap, so `derive.py` can
stack `mouth_open` and `eye_shut` in either order and get the same pixels.

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


PATCHES: dict[str, Patch] = {
    # Generated with the whole `face` box so the model had room for a real open
    # mouth, then the eye is put back — the mouth opening must not restyle the eye.
    "mouth_open": Patch(
        job="5b8a26d0-f08f-4c9d-8562-a60f48133d4e",
        keep="face",
        revert=("eye",),
        note="snout with the mouth wide open below it, tongue showing",
    ),
    "eye_shut": Patch(
        job="e8e25e4f-3007-4122-8bf4-9fbc4dc7c418",
        keep="eye",
        note="eye closed to a short curved line, a contented squint",
    ),
}


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
