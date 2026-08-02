# Changelog

## [0.2.0] - 2026-08-02

### Add a parallax scrolling flower field for gardens of any size

Gardens now grow into a walkable field — swipe or drag to wander, with the pig staying on screen while depth layers slide past.

#### Changes
- Plan flowers across depth rows so five letters sit in view and hundreds stretch into a multi-screen field.
- Pan by swipe, drag, wheel, or arrow keys; drop the edge scroll arrows.
- Keep a clear path for the pig so flowers only partially overlap it.
- Zoom the mobile scene in (taller grass, larger sprites) and centre the title on desktop.
- Root backdrop hills under the grass line so they no longer float.

##### **garden**
- New layout planner, camera controller, and parallax layers (`Backdrop`, `FlowerField`, `FieldNav`, intro timing).
- Pig walks with scroll direction; HUD and progress bar stay fixed while the world moves.
- Local seed script for tiny / small / medium / huge test gardens.

##### **shared**
- `useElementWidth` for live scene measurement.
- Entrance and cloud-float animations in global CSS.
