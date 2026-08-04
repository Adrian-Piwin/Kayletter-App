"use client";

import { PIG_SHEET } from "@/lib/pig-anim.generated";

type Props = {
  frame: number;
  alt: string;
  height: number;
  flip?: boolean;
  className?: string;
};

/**
 * Renders one frame from the pig atlas via background-position.
 * GPU-cheap: one decode, no per-frame DOM churn.
 */
export default function SpriteSheet({ frame, alt, height, flip, className = "" }: Props) {
  const { src, frameW, frameH, cols, totalFrames } = PIG_SHEET;
  const scale = height / frameH;
  const width = Math.round(frameW * scale);
  const col = frame % cols;
  const row = Math.floor(frame / cols);
  // Bust browser cache when the atlas is rebuilt (frame count changes).
  const sheetUrl = `${src}?v=${totalFrames}`;

  return (
    <div
      role="img"
      aria-label={alt}
      className={`pixelated ${className}`}
      style={{
        width,
        height,
        backgroundImage: `url(${sheetUrl})`,
        backgroundRepeat: "no-repeat",
        backgroundSize: `${cols * width}px auto`,
        backgroundPosition: `-${col * width}px -${row * height}px`,
        transform: flip ? "scaleX(-1)" : undefined,
      }}
    />
  );
}
