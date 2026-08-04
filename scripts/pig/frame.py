"""The frame contract every pig sprite obeys.

PixelLab generations keep the original pig's native resolution (~189×199).
Every clip is padded onto this canvas with a shared ground line so poses never
jump baseline. Display scale is chosen so the on-screen pig stays near today's
102/110px height without non-integer CSS `height` on the source pixels.
"""

FRAME_W = 189
"""Frame width in sprite pixels."""

FRAME_H = 199
"""Frame height in sprite pixels."""

# Back-compat aliases used by older tooling / docs.
SIZE = FRAME_W
GROUND = FRAME_H - 2
CENTER = FRAME_W // 2

# Display: ~0.55× would match old CSS heights, but we keep source pixels and
# size the box with integer CSS pixels close to the current look.
DISPLAY_HEIGHT = 110
"""CSS height of the pig box on desktop."""

DISPLAY_HEIGHT_MOBILE = 102
"""CSS height of the pig box on mobile."""

ATLAS_COLS = 12
"""Columns in the packed atlas."""
