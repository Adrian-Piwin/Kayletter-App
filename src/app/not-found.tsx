import Link from "next/link";
import Sprite from "@/components/Sprite";

export default function NotFound() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center gap-5 text-center px-5 sm:px-6 py-12 sm:py-20">
      <Sprite name="pig-sad" alt="A sad pixel pig" height="clamp(88px, 26vw, 120px)" />
      <h1 className="font-pixel text-xl sm:text-2xl text-ink">nothing planted here</h1>
      <p className="text-ink/60 max-w-sm text-pretty">
        This garden doesn&apos;t exist — the link may be mistyped or the letters were removed.
      </p>
      <Link
        href="/"
        className="font-pixel text-sm min-h-11 flex items-center px-4 py-2 bg-pig-deep text-white border-2 border-ink shadow-[3px_3px_0_0_var(--ink)]"
      >
        go home
      </Link>
    </main>
  );
}
