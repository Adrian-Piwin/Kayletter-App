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
  height: number;
  className?: string;
  flip?: boolean;
}) {
  return (
    <img
      src={`/sprites/${name}.png`}
      alt={alt}
      style={{ height, transform: flip ? "scaleX(-1)" : undefined }}
      className={`pixelated w-auto ${className}`}
      draggable={false}
    />
  );
}
