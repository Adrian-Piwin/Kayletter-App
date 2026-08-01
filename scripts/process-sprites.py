#!/usr/bin/env python3
"""One-time sprite processing: make generated sprite backgrounds transparent.

Flood-fills near-white pixels connected to the image border (so interior white
details like the pig's eye highlight are preserved), then crops to content.
"""
import sys
from collections import deque
from pathlib import Path

from PIL import Image

TOLERANCE = 26  # how close to white a pixel must be to count as background


def is_bg(px):
    r, g, b = px[0], px[1], px[2]
    return r >= 255 - TOLERANCE and g >= 255 - TOLERANCE and b >= 255 - TOLERANCE


def process(src: Path, dst: Path):
    img = Image.open(src).convert("RGBA")
    w, h = img.size
    pixels = img.load()

    # BFS flood fill from all border pixels
    visited = bytearray(w * h)
    queue = deque()
    for x in range(w):
        for y in (0, h - 1):
            if is_bg(pixels[x, y]):
                queue.append((x, y))
                visited[y * w + x] = 1
    for y in range(h):
        for x in (0, w - 1):
            if is_bg(pixels[x, y]) and not visited[y * w + x]:
                queue.append((x, y))
                visited[y * w + x] = 1

    while queue:
        x, y = queue.popleft()
        pixels[x, y] = (0, 0, 0, 0)
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and not visited[ny * w + nx] and is_bg(pixels[nx, ny]):
                visited[ny * w + nx] = 1
                queue.append((nx, ny))

    # Crop to content with a small margin
    bbox = img.getbbox()
    if bbox:
        m = 4
        bbox = (max(0, bbox[0] - m), max(0, bbox[1] - m), min(w, bbox[2] + m), min(h, bbox[3] + m))
        img = img.crop(bbox)

    dst.parent.mkdir(parents=True, exist_ok=True)
    img.save(dst)
    print(f"{src.name} -> {dst} ({img.size[0]}x{img.size[1]})")


if __name__ == "__main__":
    src_dir = Path(sys.argv[1])
    dst_dir = Path(sys.argv[2])
    for f in sorted(src_dir.glob("*.png")):
        process(f, dst_dir / f.name)
