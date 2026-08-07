#!/usr/bin/env python3
"""Forced palettes for the flower sprites.

PixelLab's `color_image` turns an image's colours into a hard palette, and it is
the most reliable lever there is for making a new asset sit beside an old one
(see docs/pixellab-notes.md). Every species shares the sunflower's own green ramp
and stem brown, so six gardens read as one world; only the petal ramp changes.

Writes assets/pixellab/flowers/palette-<species>.png, 8x1 px each.
"""

import base64
import json
from pathlib import Path

from PIL import Image

OUT = Path(__file__).resolve().parents[2] / "assets/pixellab/flowers"

# Lifted from public/sprites/flowers/sunflower-*.png: the three greens that
# carry its leaves and stem, and the brown its stem is outlined with. Sharing
# these is what keeps a rose planted in the same garden as a sunflower.
GREENS = ["#0e4923", "#4e8934", "#a8c848"]
STEM_BROWN = "#894929"

# Four steps per species: outline (a darker version of the fill, never
# near-black), shadow, fill, highlight. Mid saturation throughout.
PETALS = {
    "rose": ["#8c1f3a", "#c23a56", "#e46a80", "#f8b7c2"],
    "tulip": ["#a32a2f", "#d84b3f", "#f27a4e", "#fbc06d"],
    "daisy": ["#c9962a", "#f6d64a", "#fdf3d6", "#fffdf2"],
    "lily": ["#b8683f", "#e89a5c", "#fbd9b0", "#fffaf0"],
    "lavender": ["#4b2d7a", "#7a52b8", "#a985dd", "#d8c6f2"],
}


def rgb(hex_colour: str) -> tuple[int, int, int]:
    h = hex_colour.lstrip("#")
    return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4))


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = {}

    for species, petals in PETALS.items():
        colours = GREENS + [STEM_BROWN] + petals
        img = Image.new("RGB", (len(colours), 1))
        img.putdata([rgb(c) for c in colours])
        path = OUT / f"palette-{species}.png"
        img.save(path)
        manifest[species] = {
            "palette": colours,
            "base64": base64.b64encode(path.read_bytes()).decode(),
        }
        print(f"{path.name}: {len(colours)} colours")

    (OUT / "palettes.json").write_text(json.dumps(manifest, indent=2) + "\n")


if __name__ == "__main__":
    main()
