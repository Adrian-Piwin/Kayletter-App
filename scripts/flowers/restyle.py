#!/usr/bin/env python3
"""Repaint a generated flower's leaves and soil in the sunflower's own colours.

Getting the *resolution* right made the new flowers read as pixel art; it did
not make them read as the same garden. Measured against the sunflower, their
foliage was a different plant entirely:

    sunflower leaves   sat 0.39-0.45   luminance 0.38-0.47   soft sage
    generated leaves   sat 0.77-1.00   luminance 0.13-0.26   vivid, near-black

A flower's petals are meant to differ — that is the whole feature. Its stem and
leaves are not: every species in the field grows the same greenery out of the
same ground, and letting each one invent its own green is what made six gardens
look like six art styles. So foliage and soil are remapped onto ramps taken from
the sunflower's own sprites, and petals are left alone.

The mapping is by **luminance rank, not nearest colour**. Nearest-RGB snapping is
the trap `docs/pixellab-notes.md` warns about — it collapses colours that happen
to sit close together and destroys the shading. Ranking instead preserves the
order the artist drew: the darkest green in the source becomes the darkest green
in the ramp, the lightest becomes the lightest, and the steps between keep their
relative spacing.
"""

from __future__ import annotations

import colorsys

from PIL import Image

# Taken from public/sprites/flowers/sunflower-{bloom,bud,sprout}.png — the
# greens and browns those three sprites actually use, ordered dark to light.
FOLIAGE_RAMP = ["#124523", "#21532f", "#397530", "#4c8733", "#599333", "#75a836", "#79ac42"]
SOIL_RAMP = ["#33280e", "#462218", "#6b3727", "#7d422d", "#83452e"]

# Hue windows, in degrees. Soil is a dark, unsaturated orange-brown — the
# saturation and luminance caps keep a red tulip petal or a golden daisy centre
# out of it.
FOLIAGE_HUES = (60, 175)
SOIL_HUES = (10, 50)
SOIL_MAX_SAT = 0.75
SOIL_MAX_LUM = 0.6

# Hue alone is not enough to call something a leaf, and trusting it wasn't a
# theoretical risk: a daisy's grey petal shadows carry a nominal hue somewhere in
# the greens, so the first version repainted them leaf-green and the flower came
# back with grass growing through its petals. A leaf is never near-grey and never
# near-white, so both floors are needed.
FOLIAGE_MIN_SAT = 0.25
FOLIAGE_MAX_LUM = 0.7
# Soil, likewise, is never a near-grey.
SOIL_MIN_SAT = 0.15
# At or below this luminance a colour is treated as an outline rather than as
# anything the flower is made of.
NEAR_BLACK_LUM = 0.06


def _rgb(hex_colour: str) -> tuple[int, int, int]:
    h = hex_colour.lstrip("#")
    return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4))


def _hls(colour: tuple[int, int, int]) -> tuple[float, float, float]:
    return colorsys.rgb_to_hls(*[v / 255 for v in colour])


def classify(colour: tuple[int, int, int]) -> str:
    hue, lum, sat = _hls(colour)
    degrees = hue * 360
    if (
        FOLIAGE_HUES[0] <= degrees <= FOLIAGE_HUES[1]
        and sat >= FOLIAGE_MIN_SAT
        and lum <= FOLIAGE_MAX_LUM
    ):
        return "foliage"
    if (
        SOIL_HUES[0] <= degrees < SOIL_HUES[1]
        and SOIL_MIN_SAT <= sat <= SOIL_MAX_SAT
        and lum <= SOIL_MAX_LUM
    ):
        return "soil"
    return "petal"


def _remap(colours: list[tuple[int, int, int]], ramp: list[str]) -> dict:
    """Rank `colours` by luminance and spread them across `ramp`."""
    if not colours:
        return {}
    ordered = sorted(colours, key=lambda c: _hls(c)[1])
    target = [_rgb(c) for c in ramp]
    if len(ordered) == 1:
        return {ordered[0]: target[len(target) // 2]}
    return {
        colour: target[round(i * (len(target) - 1) / (len(ordered) - 1))]
        for i, colour in enumerate(ordered)
    }


def restyle(im: Image.Image, stage: str | None = None) -> tuple[Image.Image, int]:
    """Repaint foliage, soil and black outlines; return the image and pixels changed."""
    im = im.convert("RGBA")
    px = im.load()
    w, h = im.size
    present = {px[x, y][:3] for y in range(h) for x in range(w) if px[x, y][3] > 0}

    # A seedling is leaves, a stem and dirt — there is nothing else in the
    # frame. So on a sprout anything that isn't foliage is soil, whatever hue
    # the generator reached for: one came back with a navy mound, another with a
    # brown far too saturated to pass the general test, and both would otherwise
    # have shipped as drawn.
    kinds = {}
    for colour in present:
        kind = classify(colour)
        if stage == "sprout" and kind == "petal" and _hls(colour)[1] > NEAR_BLACK_LUM:
            # Hue alone decides on a sprout. The saturation floor that protects a
            # daisy's grey petals has no petals to protect here, and applying it
            # anyway sent every pale leaf highlight to the soil ramp — the
            # seedlings shipped with dirt speckled across their leaves.
            hue = _hls(colour)[0] * 360
            kind = "foliage" if FOLIAGE_HUES[0] <= hue <= FOLIAGE_HUES[1] else "soil"
        kinds[colour] = kind

    groups = {"foliage": [], "soil": [], "petal": []}
    for colour, kind in kinds.items():
        groups[kind].append(colour)

    mapping = {**_remap(groups["foliage"], FOLIAGE_RAMP), **_remap(groups["soil"], SOIL_RAMP)}

    # The sunflower outlines in a dark version of whatever it is outlining and
    # never in black — the same rule the strawberry broke (see pixellab-notes).
    # Pixen reaches for pure black freely, so those pixels are reassigned by what
    # they surround: black around a leaf becomes the darkest green, black around
    # dirt the darkest brown, black around a petal the darkest tint the flower
    # already owns. Neighbours decide, because one black serves all three jobs.
    blacks = [c for c in present if _hls(c)[1] <= NEAR_BLACK_LUM]
    dark_petal = min(
        (c for c in groups["petal"] if _hls(c)[1] > NEAR_BLACK_LUM),
        key=lambda c: _hls(c)[1],
        default=None,
    )
    changed = 0
    if blacks:
        black_set = set(blacks)
        # Neighbours are read from an untouched copy. Reading from the image
        # being written would let a pixel this pass has already repainted vote on
        # the next one, which is both order-dependent and a lookup into `kinds`
        # for a colour that was never in the source.
        source = im.copy().load()
        for y in range(h):
            for x in range(w):
                if px[x, y][3] == 0 or source[x, y][:3] not in black_set:
                    continue
                tally = {"foliage": 0, "soil": 0, "petal": 0}
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        nx, ny = x + dx, y + dy
                        if not (0 <= nx < w and 0 <= ny < h) or source[nx, ny][3] == 0:
                            continue
                        neighbour = source[nx, ny][:3]
                        if neighbour in black_set:
                            continue
                        tally[kinds[neighbour]] += 1
                if not any(tally.values()):
                    continue
                winner = max(tally, key=tally.get)
                target = (
                    _rgb(FOLIAGE_RAMP[0]) if winner == "foliage"
                    else _rgb(SOIL_RAMP[0]) if winner == "soil"
                    else dark_petal
                )
                if target and target != px[x, y][:3]:
                    px[x, y] = (*target, px[x, y][3])
                    changed += 1

    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            new = mapping.get((r, g, b))
            if new and new != (r, g, b):
                px[x, y] = (*new, a)
                changed += 1
    return im, changed
