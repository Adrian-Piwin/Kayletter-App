#!/usr/bin/env python3
"""Turn raw PixelLab flower output into shippable sprites, and show the result.

    python3 scripts/flowers/finish.py            # clean + ship + contact sheets
    python3 scripts/flowers/finish.py --sheets   # contact sheets only

Reads the chosen job per sprite from assets/pixellab/flowers/flowers.json,
downloads it once into assets/pixellab/flowers/raw/, then does the three things
docs/pixellab-notes.md says nothing generated is ready to ship without:

  1. harden alpha to 0 or 255   — or the sprite haloes over the sky gradient
  2. drop detached pixels       — there is nothing to hide them on a transparent
                                  sprite, and a stray grows the bounding box, so
                                  this must happen *before* the trim
  3. trim to the artwork        — `Sprite` scales the whole canvas, so padding
                                  silently shrinks the flower and makes its
                                  `height` prop a lie

Then it composites every species at its true display height beside the
sunflower, because that is the only honest way to judge pixel art that ships at
0.4x. Zoomed in you will throw away sprites that are fine.
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.request
from collections import deque
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from pig.pixels import harden_alpha, islands, opaque_mask  # noqa: E402
from flowers.restyle import restyle  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
ASSETS = ROOT / "assets/pixellab/flowers"
RAW = ASSETS / "raw"
SPRITES = ROOT / "public/sprites/flowers"
PREVIEWS = ROOT / "docs/previews"

# From STAGE_HEIGHT in src/lib/garden-layout.ts — the height a front-row flower
# actually draws at. Judge candidates here, not at 1:1.
DISPLAY_HEIGHT = {"sprout": 34, "bud": 66, "bloom": 92}
STAGES = ["sprout", "bud", "bloom"]
# A rule drawn under a sprout is this thin at most; deeper than this and the
# flat band at the bottom of a sprite is soil, which the flower stands in.
MAX_GROUND_ROWS = 3


def manifest() -> dict:
    return json.loads((ASSETS / "flowers.json").read_text())


def download(job_id: str, dest: Path) -> Path:
    if dest.exists():
        return dest
    dest.parent.mkdir(parents=True, exist_ok=True)
    url = f"https://api.pixellab.ai/mcp/images/{job_id}/download"
    with urllib.request.urlopen(url) as response:
        dest.write_bytes(response.read())
    return dest


def key_background(im: Image.Image) -> tuple[Image.Image, int]:
    """Clear the flat backdrop the generator returns instead of transparency.

    A forced palette overrides `no_background`: the art comes back opaque on the
    palette's lightest colour rather than on nothing. Keying it out has to be a
    flood from the border rather than a colour match over the whole image,
    because that same lightest tint is a legitimate highlight *inside* the
    flower — on the lily it is most of the petal. Anything the outline encloses
    is unreachable from the edge, so it survives.
    """
    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()

    # Small canvases come back genuinely transparent, and then there is nothing
    # to key. Running anyway would be actively harmful: a cleared pixel keeps
    # whatever RGB it was flattened from, so the corner reads as some dark green
    # and the flood would erase every outline pixel of that colour it can reach.
    if px[0, 0][3] == 0:
        return im, 0

    backdrop = px[0, 0][:3]

    seen = [[False] * w for _ in range(h)]
    queue = deque(
        [(x, y) for x in range(w) for y in (0, h - 1)] + [(x, y) for y in range(h) for x in (0, w - 1)]
    )
    cleared = 0
    while queue:
        x, y = queue.popleft()
        if not (0 <= x < w and 0 <= y < h) or seen[y][x] or px[x, y][:3] != backdrop:
            continue
        seen[y][x] = True
        px[x, y] = (0, 0, 0, 0)
        cleared += 1
        queue.extend([(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)])
    return im, cleared


def drop_specks(im: Image.Image, min_share: float = 0.02) -> tuple[Image.Image, int]:
    """Erase loose pixel clusters, keeping every substantial piece of the plant.

    The pig's `drop_strays` keeps only the largest island, which is right for a
    pig — it is one connected blob. A flower is not: keying the backdrop can cut
    a highlight-coloured band clean through a stem, and a leaf may only touch it
    diagonally. Keeping the largest island alone threw away a rose's entire stem
    and left a floating head. So the test is size, not rank: anything under
    `min_share` of the drawn pixels is generator dirt, anything over it is the
    plant.
    """
    im = im.convert("RGBA")
    regions = islands(opaque_mask(im))
    total = sum(len(r) for r in regions)
    px = im.load()
    dropped = 0
    for region in regions:
        if len(region) >= total * min_share:
            continue
        for x, y in region:
            px[x, y] = (0, 0, 0, 0)
            dropped += 1
    return im, dropped


def strip_ground_line(im: Image.Image) -> tuple[Image.Image, int]:
    """Peel off the flat bar the generator sometimes paints under a plant.

    Asking for soil at the base of a sprout gets soil — and, on every one of
    them, a 2px rule ruled clean across the canvas underneath it in a petal
    colour. It touches the soil, so it is not a stray, and it is opaque, so the
    trim keeps it: the flower ships standing on a coloured line.

    A drawn rule gives itself away by shape rather than colour: it is markedly
    wider than the plant immediately above it, where real soil tapers a few
    pixels a row. So peel from the bottom while each row is a single colour and
    overhangs what it stands on.
    """
    im = im.convert("RGBA")
    px = im.load()
    w, h = im.size

    def row(y: int) -> list[tuple[int, int, int, int]]:
        return [px[x, y] for x in range(w) if px[x, y][3] > 0]

    # Start at the lowest drawn row, not the bottom of the canvas: the plant
    # rarely reaches it, and empty rows would end the peel before it began.
    bottom = max((y for y in range(h) if row(y)), default=0)
    if not row(bottom) or len({c[:3] for c in row(bottom)}) > 1:
        return im, 0

    # Measure the contiguous run of rows drawn in the bottom row's one colour.
    line = row(bottom)[0][:3]
    top = bottom
    while top > 0 and row(top - 1) and {c[:3] for c in row(top - 1)} == {line}:
        top -= 1

    # Two things have to hold, and both are needed. The run must be thin: a rule
    # is a couple of rows, whereas a mound of soil can be a flat brown fifteen
    # rows deep, and height alone is what separates them — the tulip's mound was
    # peeled away entirely before this test existed. And it must overhang what
    # it stands on, which is what makes it a rule rather than the plant's base.
    above = row(top - 1) if top > 0 else []
    widest = max(len(row(y)) for y in range(top, bottom + 1))
    if bottom - top + 1 > MAX_GROUND_ROWS or not above or widest < len(above) * 1.25:
        return im, 0

    for y in range(top, bottom + 1):
        for x in range(w):
            px[x, y] = (0, 0, 0, 0)
    return im, bottom - top + 1


def finish(src: Path, dest: Path, stage: str | None = None) -> dict:
    im = Image.open(src).convert("RGBA")
    im, cleared = key_background(im)
    im, softened = harden_alpha(im)
    im, strays = drop_specks(im)
    im, peeled = strip_ground_line(im)
    # Last, so it repaints only pixels that survive to ship.
    im, repainted = restyle(im, stage)
    box = im.getbbox()
    im = im.crop(box)
    dest.parent.mkdir(parents=True, exist_ok=True)
    im.save(dest)
    return {
        "cleared": cleared,
        "softened": softened,
        "strays": strays,
        "peeled": peeled,
        "repainted": repainted,
        "size": list(im.size),
    }


def contact_sheet(species: list[str], stage: str, out: Path) -> None:
    """Every species at this stage, drawn at the height it ships at."""
    height = DISPLAY_HEIGHT[stage]
    pad = 12
    tiles = []
    for name in species:
        path = SPRITES / f"{name}-{stage}.png"
        if not path.exists():
            continue
        im = Image.open(path).convert("RGBA")
        width = max(1, round(im.width * height / im.height))
        tiles.append(im.resize((width, height), Image.NEAREST))

    if not tiles:
        return
    sheet = Image.new(
        "RGBA",
        (sum(t.width + pad for t in tiles) + pad, height + pad * 2),
        (198, 226, 168, 255),  # the garden's grass, so white petals still read
    )
    x = pad
    for tile in tiles:
        sheet.paste(tile, (x, pad), tile)
        x += tile.width + pad
    out.parent.mkdir(parents=True, exist_ok=True)
    sheet.resize((sheet.width * 3, sheet.height * 3), Image.NEAREST).save(out)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--sheets", action="store_true", help="skip the clean-up pass")
    args = parser.parse_args()

    data = manifest()
    # The sunflower leads every sheet: it is the art everything else has to
    # stand next to, and it is not generated, so it has no job to fetch.
    species = ["sunflower", *data["flowers"]]

    if not args.sheets:
        for name, stages in data["flowers"].items():
            for stage, job in stages.items():
                raw = download(job["job"], RAW / f"{name}-{stage}.png")
                report = finish(raw, SPRITES / f"{name}-{stage}.png", stage)
                print(f"{name}-{stage}: {report['size'][0]}x{report['size'][1]}px "
                      f"({report['cleared']} backdrop px keyed, "
                      f"{report['softened']} soft px hardened, {report['strays']} strays dropped, "
                      f"{report['peeled']} ground rows peeled, "
                      f"{report['repainted']} px repainted to the sunflower's greens)")

    for stage in STAGES:
        out = PREVIEWS / f"flowers-{stage}.png"
        contact_sheet(species, stage, out)
        print(f"wrote {out.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
