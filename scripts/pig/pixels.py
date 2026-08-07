"""Pixel-level operations shared by the clip build and the clip review.

Both scripts need to answer the same questions about a frame — where does it
stand, is any of it detached from the body, does it use a colour the pig does
not own — so the answers live here rather than in whichever script needed them
first.
"""

from __future__ import annotations

from collections import deque
from pathlib import Path

from PIL import Image

Colour = tuple[int, int, int]


def opaque_mask(im: Image.Image) -> list[list[bool]]:
    alpha = im.convert("RGBA").split()[3].load()
    w, h = im.size
    return [[alpha[x, y] > 0 for x in range(w)] for y in range(h)]


def islands(mask: list[list[bool]]) -> list[list[tuple[int, int]]]:
    """8-connected opaque regions, largest first.

    The pig is one connected shape — even the tail curl touches the rump — so
    anything past the first region is something the generator invented.
    """
    h, w = len(mask), len(mask[0])
    seen = [[False] * w for _ in range(h)]
    found: list[list[tuple[int, int]]] = []
    for y in range(h):
        for x in range(w):
            if not mask[y][x] or seen[y][x]:
                continue
            region: list[tuple[int, int]] = []
            queue = deque([(x, y)])
            seen[y][x] = True
            while queue:
                cx, cy = queue.popleft()
                region.append((cx, cy))
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        nx, ny = cx + dx, cy + dy
                        if 0 <= nx < w and 0 <= ny < h and mask[ny][nx] and not seen[ny][nx]:
                            seen[ny][nx] = True
                            queue.append((nx, ny))
            found.append(region)
    return sorted(found, key=len, reverse=True)


def silhouette_change(a: Image.Image, b: Image.Image) -> int:
    """Pixels opaque in exactly one of two frames — how much the shape actually moved.

    Every other probe in this file measures what the pig *is*: mass, palette, where
    it stands. All of them are conserved by a clip in which nothing happens, which is
    how six clips shipped showing a pig that blinked and did nothing else. This is
    the one number that measures what the pig *did*.

    A symmetric difference rather than a centroid or a bounding box, because a pose
    can fold a leg under the body without moving either.
    """
    am, bm = opaque_mask(a), opaque_mask(b)
    return sum(1 for y in range(len(am)) for x in range(len(am[0])) if am[y][x] != bm[y][x])


def drop_strays(im: Image.Image) -> tuple[Image.Image, int]:
    """Erase everything not connected to the body. Returns the frame and px removed.

    Generated frames routinely carry a loose cluster a few pixels off the snout
    or in the grass. On a transparent sprite over a sky gradient there is nothing
    to hide it, so it reads as dirt on the screen.
    """
    mask = opaque_mask(im)
    regions = islands(mask)
    if len(regions) < 2:
        return im, 0
    out = im.copy()
    removed = 0
    for region in regions[1:]:
        for x, y in region:
            out.putpixel((x, y), (0, 0, 0, 0))
            removed += 1
    return out, removed


def reground(im: Image.Image, ground: int) -> Image.Image:
    """Slide a frame vertically so the lowest drawn pixel sits on `ground`.

    Generated frames land a few pixels high or low from one to the next, which
    plays back as the pig sinking into the grass and floating out of it again.
    Only y moves: x carries the lean or step the frame was drawn with.
    """
    box = im.getbbox()
    if not box:
        return im
    dy = ground - box[3]
    if dy == 0:
        return im
    out = Image.new("RGBA", im.size, (0, 0, 0, 0))
    out.paste(im, (0, dy), im)
    return out


def harden_alpha(im: Image.Image, threshold: int = 128) -> tuple[Image.Image, int]:
    """Force every pixel to fully opaque or fully clear.

    Partial alpha shows up as a halo against the sky gradient, and the generator
    leaves some behind on every diagonal edge.
    """
    im = im.convert("RGBA")
    r, g, b, a = im.split()
    hard = a.point(lambda v: 255 if v >= threshold else 0)
    changed = sum(1 for v, w in zip(a.getdata(), hard.getdata()) if v != w)
    return Image.merge("RGBA", (r, g, b, hard)), changed


def palette_of(path: Path) -> tuple[Colour, ...]:
    """Every fully opaque colour in a sprite."""
    with Image.open(path) as im:
        return tuple({p[:3] for p in im.convert("RGBA").getdata() if p[3] == 255})


def dist2(a: Colour, b: Colour) -> int:
    return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2
