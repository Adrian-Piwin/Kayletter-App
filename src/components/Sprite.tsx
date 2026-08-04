/* eslint-disable @next/next/no-img-element */

/** Crisp-scaled pixel art sprite. Plain <img> keeps nearest-neighbor scaling simple. */
export default function Sprite({
  name,
  alt,
  height,
  className = "",
  flip = false,
}: {
  name: string;
  alt: string;
  /** Pixel number, or any CSS length (e.g. `clamp(56px, 16vw, 90px)`) to scale with the viewport. */
  height: number | string;
  className?: string;
  flip?: boolean;
}) {
  return (
    <img
      src={`/sprites/${name}.png`}
      alt={alt}
      style={{ height, transform: flip ? "scaleX(-1)" : undefined }}
      /*
       * `max-w-none` undoes the preflight `max-width: 100%`. A sprite is sized by
       * its height, so inside a shrink-to-fit parent (any absolutely positioned
       * wrapper) the percentage has nothing to resolve against and collapses the
       * image to zero width.
       */
      className={`pixelated w-auto max-w-none ${className}`}
      draggable={false}
    />
  );
}
