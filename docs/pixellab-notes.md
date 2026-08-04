# Working with PixelLab

Notes from building the pig's animation set and its props. The short version: the
model is very good at drawing *one small thing* and unreliable at drawing *the same
character twice*. Everything below follows from that.

For how the pig's clips are actually cut, see
[pig-sprite-rework.md](./pig-sprite-rework.md). This file is about the tool.

## Pick the tool for the amount of redrawing you want

| Tool | What it does | Use it for |
|---|---|---|
| `inpaint_image` | Regenerates one rectangle, freezes the rest | Feature changes on an existing sprite — the workhorse |
| `create_image_pixflux` | Freeform image from text, optional forced palette | New props and icons |
| `animate_image` | A whole clip from one frame | Only where identity drift does not matter |
| `edit_image` | Redraws the subject | Rarely — it returns a *different* character |
| `create_character` + `animate_character` | Rigged directional character | Characters with limbs to rig and a need for 8 directions |

What we tried and abandoned:

- **Whole-clip generation** (`animate_image`) gave frames where the pig's face, body
  mass and size all wandered. Individually they looked fine; played in sequence the
  character visibly changed shape.
- **`edit_image`** to pose the pig came back with a giant round body and stubby legs.
  It is not an edit, it is a re-draw.
- **Skeleton rigging** was the wrong shape for the problem: the pig is a blob with no
  neck and barely any limbs, and we wanted control over individual beats, not canned
  cycles.

## Don't animate the character. Compose it.

The approach that finally worked has one canonical pose (`public/sprites/pig-idle.png`)
as the only source of truth for identity and size, and builds every frame from it:

1. **Feature patches** — inpaint one small region (a mouth, an eye), then keep *only
   that region* and composite it onto the canonical pose. Every frame is therefore
   byte-identical to the canonical pose outside the few pixels that had to change.
2. **Gross body motion in code** — squash, lift, shift, rotate. Not from the model.

Identity and size cannot drift when ~95% of every frame is literally the same pixels.
This is also much cheaper than generating frames.

`inpaint_image` still drifted ~150 pixels *outside* the mask it was given, so trusting
the mask is not enough — you have to crop the result yourself.

### Generate wide, keep narrow

The mask you send and the region you keep are separate decisions, and they should be.
The pig's face is tiny, so a mask tight enough to leave the eye alone left the model no
room to draw a decent open mouth. So the mouth patch is generated with a generous face
mask and then has the eye box **reverted** to the canonical pose.

- `keep` minus `revert` = the patch's **footprint**, the pixels it owns.
- Footprints must be **disjoint**, so patches can be layered in any order and give the
  same result.
- Assert both in the build: disjoint footprints, and zero changed pixels outside a
  footprint. Art bugs are silent otherwise — the earlier version quietly restyled the
  eye on every mouth frame, which is exactly the "his face goes weird" complaint.

## Fewer frames, more deliberate

Simplifying helped every clip. Eight frames at 150ms beat twenty generated ones.

- **Two drawings per feature, not three.** The snout has exactly two states, idle and
  open, alternating. A third read as the face changing shape rather than the mouth
  working.
- **Hold the extreme.** A crouch only reads if the pig *stays* down for several frames.
  Dipping through the low pose on the way back up reads as a wobble, not a bend.
- **Loop on a whole cycle, and hold a multiple of it.** Both feed clips start and end on
  the canonical upright pose, so every cycle boundary is a safe place to stop and the
  pig is never yanked out of a pose mid-chew.
- **Let the build export the beats.** Which frames close the jaw is a fact about the
  clip, so `derive.py` records it and the app reads it, instead of anyone retyping
  frame numbers that would silently rot.

### What the model cannot do for a blob character

There is no neck, so there is nothing to lower or turn. Asking for a lowered head gets
a different pig. Body language has to come from transforms:

- **Bending** is a vertical squash anchored at the feet — that brings the head down.
  Depth matters: it has to reach ~0.86–0.90 to read as intentional rather than noise.
- **Rotation** only stays full-size at multiples of 90°. Anything else grows the
  bounding box and forces a shrink to fit the frame, which reads as pulsing unless the
  same scale is applied across the whole clip.

## Matching the style of a new asset

Two things have to match. The second is the one that gets missed.

### 1. Palette — force it

`create_image_pixflux` takes a `color_image` whose colours become a hard palette. It
holds exactly: an 11-colour palette in gave 10–11 colours out, every time. This is the
most reliable lever available.

Deriving the palette matters, though. Hue-rotating the pig's own ramp to red produced
washed-out pink, because the pig's ramp is nearly all very light tints. What transfers
is the *logic*, not the hues:

- a coloured outline that is a darker version of the fill, never black
- two or three shading steps per material
- mid saturation

So hand-build a ramp that follows those rules in the new hue, and include the existing
art's darkest accent so the two share an anchor.

### 2. Pixel density — the one that actually looked wrong

Apparent pixel size on screen is `display_height / source_height`. Match it to the
neighbouring art or the new asset reads as a different medium:

| Sprite | Source | On screen | Screen px per art px |
|---|---|---|---|
| Pig | 199px tall | 110px | 0.55 |
| Strawberry (old) | 206px tall | 32px | **0.17** |
| Strawberry (new) | 70px tall | 32px | 0.46 |

The old berry's pixels were **3.3× finer** than the pig's. That is the whole reason it
looked smooth, detailed and out of place — nothing to do with its colours. It was drawn
at 178×206 for a 32px slot.

Density and on-screen size are coupled: `subject_on_screen = subject_source × density`.
Fix the density you want and the source size follows. To show a berry ~32px tall at
~0.5 density it needs ~64px of *subject*, and since the model fills roughly 70% of the
canvas, that means an **80px canvas**, not 64. A 64px canvas gave a 45px berry, which at
matched density could only be 25px on screen — too small to read.

### Practical asset checklist

- **Trim to the artwork before shipping.** `Sprite` scales the whole canvas, so padding
  silently shrinks the subject and makes the `height` prop a lie.
- **Generate 3–4 candidates.** They cost one generation each. Vary the seed and the
  outline/shading hints.
- **Compare in place, at true display size**, next to the sprite it has to live with —
  not zoomed, and not on its own. Half the candidates that look best zoomed in lose
  their shape at 32px. Compositing the options offline with Pillow was faster and more
  honest than wiring each into the app.
- **Record provenance.** Job id, seed, canvas and palette, so the asset can be
  regenerated (`assets/pixellab/props/props.json`).

## Prompting notes

- The style knobs (`outline`, `shading`, `detail`, `view`) are documented as *weakly*
  guiding, and that is accurate — they nudge. The palette and canvas size are what
  actually pin the result down.
- `outline: "single color outline"` / `"selective outline"` matter for fitting soft art;
  the default tends toward a hard black outline that will not sit next to pastel work.
- `init_image_strength` is inverted from most img2img APIs: it is how much of the input
  is **kept**. 500 barely moves it, ~150 is a real edit.
- Generations are async and rate-limited. Submit a batch, then do other work; polling
  one at a time wastes far more time than the generations take.

## Integrating pixel art (bit us, worth knowing)

An `<img>` sized only by `height`, inside an absolutely positioned (shrink-to-fit)
wrapper, collapses to **zero width**. Preflight sets `max-width: 100%` on images, and
the percentage has no resolved parent width to measure against, so it resolves to 0. The
element is present, loaded, `complete`, with correct `naturalWidth` — and invisible.

`Sprite` sets `max-w-none` to prevent this. A fixed-height sprite should never be
clamped by a percentage.

Also: `image-rendering: pixelated` is a *nearest-neighbour* filter in both directions, so
a non-integer downscale drops pixels unevenly. It is tolerable when every sprite is
downscaled by a similar factor — which is another reason to match density rather than
authoring everything large.
