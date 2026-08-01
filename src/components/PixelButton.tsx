"use client";

import { type ButtonHTMLAttributes } from "react";

type Variant = "primary" | "sunflower" | "leaf" | "ghost";

const styles: Record<Variant, string> = {
  primary: "bg-pig-deep text-white hover:bg-[#d96679]",
  sunflower: "bg-sunflower text-ink hover:bg-[#eebd3a]",
  leaf: "bg-leaf text-white hover:bg-[#6da05a]",
  ghost: "bg-cream-dark text-ink hover:bg-[#eedabb]",
};

/** Chunky pixel-styled button used across the app. */
export default function PixelButton({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={`font-pixel text-sm sm:text-base px-4 py-2 border-2 border-ink shadow-[3px_3px_0_0_var(--ink)] active:shadow-none active:translate-x-[3px] active:translate-y-[3px] transition-[transform,box-shadow,background-color] duration-100 disabled:opacity-50 disabled:pointer-events-none cursor-pointer select-none ${styles[variant]} ${className}`}
      {...props}
    />
  );
}
