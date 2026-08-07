"use client";

import { useEffect, useRef, useState } from "react";

import SpriteSheet from "@/components/SpriteSheet";
import { DISPLAY_HEIGHT } from "@/components/garden/pig-display";
import { PIG_CLIPS, type PigClip } from "@/lib/pig-anim.generated";

const CLIPS = Object.keys(PIG_CLIPS) as PigClip[];

/**
 * Speeds worth having. Slower than a quarter turns judging a clip into judging
 * a slideshow, and the interesting question at low speed — "does this frame
 * read?" — is better answered by stepping.
 */
const SPEEDS = [0.25, 0.5, 1, 2] as const;

export default function PigDevPage() {
  const [clip, setClip] = useState<PigClip>(CLIPS[0]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState<number>(1);

  const def = PIG_CLIPS[clip];
  const chomps: readonly number[] = "chomps" in def ? def.chomps : [];

  // The playhead is mirrored in a ref so the timer can resume from wherever
  // stepping left it without `index` becoming an effect dependency — that would
  // tear down and rebuild the interval on every single frame.
  const indexRef = useRef(0);
  function goto(i: number) {
    indexRef.current = i;
    setIndex(i);
  }

  // Stepping is owned here rather than by `useSpriteAnimation`, which has no way
  // to be driven to a specific frame — and giving the production hook one purely
  // for a dev tool would be the tool leaking into the app.
  useEffect(() => {
    if (!playing || def.frames <= 1) return;
    const timer = setInterval(
      () => {
        const next = indexRef.current + 1;
        if (next < def.frames) return goto(next);
        if (def.loop) return goto(0);
        // A one-shot rests on its last frame, the way it does in the garden.
        clearInterval(timer);
        setPlaying(false);
      },
      Math.max(16, Math.round(def.ms / speed))
    );
    return () => clearInterval(timer);
  }, [playing, speed, def.frames, def.ms, def.loop]);

  function select(name: PigClip) {
    setClip(name);
    goto(0);
    setPlaying(true);
  }

  function step(by: number) {
    setPlaying(false);
    goto((indexRef.current + by + def.frames) % def.frames);
  }

  return (
    <main className="min-h-screen bg-cream p-6 font-sans text-ink">
      <h1 className="font-pixel text-lg">pig animations</h1>
      <p className="mt-1 text-sm opacity-70">
        Local tool — this route 404s in production. {CLIPS.length} clips in the atlas.
      </p>

      <div className="mt-6 flex flex-wrap gap-8">
        {/* The stage is the garden's own sky, because that is the only background
            these sprites are ever seen against, and a stray pixel or an alpha
            halo shows up against a gradient and vanishes against white. */}
        <div className="flex shrink-0 flex-col items-center gap-3">
          <div
            className="flex items-end justify-center rounded-lg bg-sky"
            style={{ width: 320, height: 260, paddingBottom: 24 }}
          >
            <SpriteSheet frame={def.start + index} alt={clip} height={DISPLAY_HEIGHT} />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => step(-1)}
              className="rounded border border-ink/20 px-3 py-1 text-sm hover:bg-ink/5"
            >
              ◀
            </button>
            <button
              type="button"
              onClick={() => {
                // Restarting a finished one-shot is the common case, so pressing
                // play on its last frame rewinds instead of doing nothing.
                if (!playing && index === def.frames - 1 && !def.loop) goto(0);
                setPlaying((p) => !p);
              }}
              className="w-24 rounded border border-ink/20 px-3 py-1 text-sm hover:bg-ink/5"
            >
              {playing ? "❚❚ pause" : "▶ play"}
            </button>
            <button
              type="button"
              onClick={() => step(1)}
              className="rounded border border-ink/20 px-3 py-1 text-sm hover:bg-ink/5"
            >
              ▶
            </button>
          </div>

          <div className="flex items-center gap-1">
            {SPEEDS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSpeed(s)}
                className={`rounded border px-2 py-1 text-xs ${
                  speed === s ? "border-ink bg-ink text-cream" : "border-ink/20 hover:bg-ink/5"
                }`}
              >
                {s}×
              </button>
            ))}
          </div>

          <p className="font-mono text-xs opacity-70">
            frame {index + 1}/{def.frames} · {def.ms}ms · {def.loop ? "loop" : "once"}
            {chomps.length > 0 && ` · chomps ${chomps.join(",")}`}
          </p>
          {/* The frames a chew hangs off drive the munch crumbs, so seeing which
              frame is a chomp is the fastest way to check a retimed feed clip. */}
          {chomps.includes(index) && (
            <p className="font-mono text-xs text-pig-deep">chomp frame</p>
          )}
        </div>

        <div className="grid min-w-56 flex-1 auto-rows-min grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-1 self-start">
          {CLIPS.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => select(name)}
              className={`rounded px-3 py-2 text-left font-mono text-sm ${
                name === clip ? "bg-ink text-cream" : "hover:bg-ink/5"
              }`}
            >
              {name}
              <span className="ml-2 opacity-50">{PIG_CLIPS[name].frames}f</span>
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}
