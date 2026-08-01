import Link from "next/link";
import { Show, SignInButton, SignUpButton } from "@clerk/nextjs";
import Sprite from "@/components/Sprite";

export default function LandingPage() {
  return (
    <main className="flex-1 flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 max-w-4xl w-full mx-auto">
        <span className="font-pixel text-xl text-pig-deep">Kayletter</span>
        <nav className="flex items-center gap-3">
          <Show when="signed-out">
            <SignInButton mode="modal">
              <button className="font-pixel text-sm px-3 py-1.5 text-ink hover:text-pig-deep cursor-pointer">
                Sign in
              </button>
            </SignInButton>
          </Show>
          <Show when="signed-in">
            <Link
              href="/notes"
              className="font-pixel text-sm px-4 py-2 bg-pig-deep text-white border-2 border-ink shadow-[3px_3px_0_0_var(--ink)] hover:bg-[#d96679]"
            >
              My notes
            </Link>
          </Show>
        </nav>
      </header>

      <section className="flex-1 flex flex-col items-center justify-center text-center px-6 py-10 gap-6">
        <div className="animate-bounce [animation-duration:2.5s]">
          <Sprite name="pig-envelope" alt="A pixel pig carrying a letter" height={160} />
        </div>
        <h1 className="font-pixel text-4xl sm:text-5xl text-ink max-w-xl leading-tight">
          Little letters, delivered by <span className="text-pig-deep">pig</span>
        </h1>
        <p className="text-lg text-ink/70 max-w-md">
          Write a stack of notes for someone you love. A tiny pig delivers one a day in a garden
          that grows a sunflower for every letter they read.
        </p>
        <div className="flex gap-4 mt-2">
          <Show when="signed-out">
            <SignUpButton mode="modal">
              <button className="font-pixel text-base px-6 py-3 bg-pig-deep text-white border-2 border-ink shadow-[4px_4px_0_0_var(--ink)] active:shadow-none active:translate-x-1 active:translate-y-1 hover:bg-[#d96679] cursor-pointer">
                Write your first note
              </button>
            </SignUpButton>
          </Show>
          <Show when="signed-in">
            <Link
              href="/notes"
              className="font-pixel text-base px-6 py-3 bg-pig-deep text-white border-2 border-ink shadow-[4px_4px_0_0_var(--ink)] active:shadow-none active:translate-x-1 active:translate-y-1 hover:bg-[#d96679]"
            >
              Write a note
            </Link>
          </Show>
        </div>
        <p className="text-sm text-ink/50">5 notes free, then $1 once for unlimited.</p>
      </section>

      <footer className="relative h-40 overflow-hidden" aria-hidden>
        <div className="absolute inset-x-0 bottom-0 h-16 bg-leaf border-t-4 border-leaf-deep" />
        <div className="absolute inset-x-0 bottom-14 flex items-end justify-center gap-8 sm:gap-14">
          <Sprite name="sunflower-bloom" alt="" height={90} className="translate-y-2" />
          <Sprite name="sunflower-bud" alt="" height={70} className="translate-y-2" />
          <Sprite name="pig-idle" alt="" height={80} className="translate-y-3" flip />
          <Sprite name="sunflower-bloom" alt="" height={100} className="translate-y-2" />
          <Sprite name="sunflower-sprout" alt="" height={36} className="translate-y-2" />
        </div>
      </footer>
    </main>
  );
}
