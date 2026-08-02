"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import type { CameraController } from "./useCamera";

/**
 * A band of scenery that slides at its own share of the camera's movement.
 * The transform is written straight to the DOM so panning never re-renders
 * the hundreds of sprites a full field can hold.
 */
export default function ParallaxLayer({
  camera,
  factor,
  className = "",
  style,
  children,
}: {
  camera: CameraController;
  /** 1 keeps pace with the camera; less is further away, more is nearer. */
  factor: number;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(
    () =>
      camera.subscribe(({ x }) => {
        const el = ref.current;
        if (el) el.style.transform = `translate3d(${-x * factor}px, 0, 0)`;
      }),
    [camera, factor]
  );

  return (
    <div
      ref={ref}
      className={`absolute inset-y-0 left-0 ${className}`}
      style={{ willChange: "transform", ...style }}
    >
      {children}
    </div>
  );
}
