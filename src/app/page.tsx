import Sprite from "@/components/Sprite";
import LandingCtas, { LandingHeroCta } from "@/components/LandingCtas";

export default function LandingPage() {
  return (
    <main className="flex-1 flex flex-col">
      <header className="flex items-center justify-between gap-3 px-4 sm:px-6 py-4 max-w-4xl w-full mx-auto">
        <span className="font-pixel text-lg sm:text-xl text-pig-deep">Kayletter</span>
        <LandingCtas />
      </header>

      <section className="flex-1 flex flex-col items-center justify-center text-center px-5 sm:px-6 py-8 sm:py-10 gap-5 sm:gap-6">
        <div className="animate-bounce [animation-duration:2.5s]">
          <Sprite
            name="pig-envelope"
            alt="A pixel pig carrying a letter"
            height="clamp(112px, 32vw, 160px)"
          />
        </div>
        <h1 className="font-pixel text-3xl sm:text-5xl text-ink max-w-xl leading-tight text-balance">
          Little letters, delivered by <span className="text-pig-deep">pig</span>
        </h1>
        <p className="text-base sm:text-lg text-ink/70 max-w-md text-pretty">
          Write a stack of notes for someone you love. A tiny pig delivers one a day in a garden
          that grows a sunflower for every letter they read.
        </p>
        <LandingHeroCta />
        <p className="text-sm text-ink/50">5 notes free, then $1 once for unlimited.</p>
      </section>

      <footer className="relative h-32 sm:h-40 overflow-hidden" aria-hidden>
        <div className="absolute inset-x-0 bottom-0 h-12 sm:h-16 bg-leaf border-t-4 border-leaf-deep" />
        <div className="absolute inset-x-0 bottom-10 sm:bottom-14 flex items-end justify-center gap-3 sm:gap-14">
          <Sprite name="sunflower-bloom" alt="" height="clamp(54px, 17vw, 90px)" className="translate-y-2" />
          <Sprite name="sunflower-bud" alt="" height="clamp(42px, 13vw, 70px)" className="translate-y-2" />
          <Sprite name="pig-idle" alt="" height="clamp(48px, 15vw, 80px)" className="translate-y-3" flip />
          <Sprite name="sunflower-bloom" alt="" height="clamp(60px, 19vw, 100px)" className="translate-y-2" />
          <Sprite name="sunflower-sprout" alt="" height="clamp(22px, 7vw, 36px)" className="translate-y-2" />
        </div>
      </footer>
    </main>
  );
}
