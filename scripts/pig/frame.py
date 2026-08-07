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

# Must match `src/components/garden/pig-display.ts`, which is what the app
# actually renders at. The review previews are only worth anything if they are
# the size a recipient sees — these drifted to 110/102 at one point and every
# clip was being judged 11% small.
DISPLAY_HEIGHT = 124
"""CSS height of the pig box on desktop."""

DISPLAY_HEIGHT_MOBILE = 114
"""CSS height of the pig box on mobile."""

ATLAS_COLS = 12
"""Columns in the packed atlas."""
