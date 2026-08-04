"""The pig's locked colour ramp.

Sampled from `public/sprites/pig-idle.png` by frequency, after dropping the
anti-aliased fringe the generator left behind. Eight colours describe the whole
character, and nothing in the pipeline may introduce a ninth - `trace.py` snaps
every source pixel to the nearest entry here and the sheet build re-checks the
count, so palette drift cannot creep in as clips are added.

Note there is no black: the darkest line on the pig is a deep pink, and the only
near-black is the eye. That is the single biggest thing that makes this art read
as soft rather than as a game sprite, so it is worth protecting.
"""

from __future__ import annotations

RAMP: dict[str, str] = {
    "L": "#fdd2d7",  # highlight - top of the head, snout bridge
    "B": "#fdadb6",  # base - most of the pig
    "D": "#f3889b",  # shadow - underside, far legs
    "S": "#f7788f",  # deep shadow, and the blush
    "P": "#de5e7a",  # inner line - nostrils, leg separations
    "O": "#c94868",  # outline
    "E": "#390a14",  # eye
    "W": "#fffdfd",  # gleam
}

PALETTE = tuple(RAMP.values())


def rgba(hex_color: str, alpha: int = 255) -> tuple[int, int, int, int]:
    h = hex_color.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), alpha)


RGB = tuple(rgba(c)[:3] for c in PALETTE)


def nearest(color: tuple[int, int, int]) -> tuple[int, int, int]:
    """Snap a colour to the ramp by squared distance."""
    r, g, b = color
    return min(RGB, key=lambda c: (c[0] - r) ** 2 + (c[1] - g) ** 2 + (c[2] - b) ** 2)
