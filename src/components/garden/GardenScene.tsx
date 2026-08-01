"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Sprite from "@/components/Sprite";
import LetterModal from "./LetterModal";
import Mailbox from "./Mailbox";
import { getUnlockState } from "@/lib/unlock";
import { petMood, TRICKS } from "@/lib/pet";
import { sounds } from "@/lib/sound";
import type { Note } from "@/lib/types";

type PetStats = { happiness: number; hunger: number; tricks_unlocked: number };
type PigState = "idle" | "walk" | "eat" | "play" | "spin" | "backflip" | "sit";
type Heart = { id: number; x: number; y: number; kind: "heart" | "sparkle" };

const WALK_FRAME_MS = 170;

export default function GardenScene({
  token,
  title,
  petName,
  initialNotes,
  initialPet,
  serverNow,
}: {
  token: string;
  title: string;
  petName: string;
  initialNotes: Note[];
  initialPet: PetStats;
  /** SSR timestamp so the first client render matches the server markup. */
  serverNow: number;
}) {
  const [notes, setNotes] = useState(initialNotes);
  const [pet, setPet] = useState(initialPet);
  const [pigState, setPigState] = useState<PigState>("idle");
  const [pigX, setPigX] = useState(50); // percent across scene
  const [pigFlip, setPigFlip] = useState(false);
  const [walkFrame, setWalkFrame] = useState(0);
  const [hearts, setHearts] = useState<Heart[]>([]);
  const [openNote, setOpenNote] = useState<Note | null>(null);
  const [mailboxOpen, setMailboxOpen] = useState(false);
  const [now, setNow] = useState(serverNow);
  const [phase, setPhase] = useState<"day" | "sunset" | "night">("day");
  const [showFood, setShowFood] = useState(false);
  const heartId = useRef(0);
  const busy = pigState !== "idle" && pigState !== "walk";

  const unlock = useMemo(() => getUnlockState(notes), [notes]);
  const mood = petMood(pet);
  const readNotes = unlock.readNotes;

  /* --- ambient: clock tick for countdown + time-of-day sky --- */
  useEffect(() => {
    const tick = () => {
      setNow(Date.now());
      const hour = new Date().getHours();
      setPhase(hour >= 20 || hour < 6 ? "night" : hour >= 17 ? "sunset" : "day");
    };
    // First tick lands ~immediately so the sky matches local time right away.
    const first = setTimeout(tick, 50);
    const t = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, []);

  /* --- pig wandering when idle --- */
  useEffect(() => {
    if (busy || unlock.canUnlock) return;
    const t = setInterval(() => {
      if (Math.random() < 0.5) return;
      const target = 15 + Math.random() * 70;
      setPigFlip(target > pigX);
      setPigState("walk");
      setPigX(target);
    }, 5000);
    return () => clearInterval(t);
  }, [busy, unlock.canUnlock, pigX]);

  /* --- walking frame animation; stop walking after transit --- */
  useEffect(() => {
    if (pigState !== "walk" && pigState !== "play") return;
    const frames = setInterval(() => setWalkFrame((f) => f ^ 1), WALK_FRAME_MS);
    const stop =
      pigState === "walk" ? setTimeout(() => setPigState("idle"), 2600) : undefined;
    return () => {
      clearInterval(frames);
      if (stop) clearTimeout(stop);
    };
  }, [pigState]);

  /* --- pig walks to center when a letter is ready --- */
  useEffect(() => {
    if (!unlock.canUnlock || busy) return;
    const t = setTimeout(() => {
      setPigFlip(50 > pigX);
      setPigX(50);
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlock.canUnlock]);

  const burstHearts = useCallback((count: number, kind: Heart["kind"] = "heart") => {
    const burst: Heart[] = Array.from({ length: count }, () => ({
      id: heartId.current++,
      x: 42 + Math.random() * 16,
      y: 30 + Math.random() * 20,
      kind,
    }));
    setHearts((h) => [...h, ...burst]);
    setTimeout(() => setHearts((h) => h.filter((x) => !burst.includes(x))), 1600);
  }, []);

  /* --- actions --- */

  async function petAction(action: "feed" | "play" | "trick") {
    if (busy) return;
    const res = await fetch(`/api/l/${token}/pet`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (!res.ok) return;
    const { pet: saved } = await res.json();

    if (action === "feed") {
      sounds.eat();
      setShowFood(true);
      setPigState("eat");
      setTimeout(() => setShowFood(false), 1400);
      setTimeout(() => {
        setPigState("idle");
        burstHearts(3);
        setPet((p) => ({ ...p, ...saved }));
      }, 1800);
    } else if (action === "play") {
      sounds.play();
      setPigState("play");
      const here = pigX;
      setPigFlip(true);
      setPigX(Math.min(85, here + 22));
      setTimeout(() => {
        setPigFlip(false);
        setPigX(Math.max(12, here - 22));
      }, 900);
      setTimeout(() => {
        setPigFlip(here > pigX);
        setPigX(here);
      }, 1800);
      setTimeout(() => {
        setPigState("idle");
        burstHearts(4);
        setPet((p) => ({ ...p, ...saved }));
      }, 2700);
    } else {
      sounds.trick();
      const learned = TRICKS.slice(0, pet.tricks_unlocked);
      const trick = learned[Math.floor(Math.random() * learned.length)] ?? "spin";
      const state: PigState = trick === "backflip" ? "backflip" : trick === "sit" ? "sit" : "spin";
      setPigState(state);
      setTimeout(() => {
        setPigState("idle");
        burstHearts(5, "sparkle");
        setPet((p) => ({ ...p, ...saved }));
      }, state === "sit" ? 2000 : 1300);
    }
  }

  async function openTodaysLetter() {
    if (!unlock.canUnlock || busy) return;
    const res = await fetch(`/api/l/${token}/unlock`, { method: "POST" });
    if (!res.ok) return;
    const { note } = await res.json();
    sounds.unlock();
    burstHearts(6);
    setNotes((ns) => ns.map((n) => (n.id === note.id ? note : n)));
    setOpenNote(note);
    setPet((p) => ({
      ...p,
      tricks_unlocked: Math.max(p.tricks_unlocked, Math.floor((readNotes.length + 1) / 2)),
    }));
  }

  async function toggleFavorite(note: Note) {
    sounds.pop();
    const res = await fetch(`/api/l/${token}/favorite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ noteId: note.id, isFavorite: !note.is_favorite }),
    });
    if (!res.ok) return;
    const { note: saved } = await res.json();
    setNotes((ns) => ns.map((n) => (n.id === saved.id ? saved : n)));
    if (openNote?.id === saved.id) setOpenNote(saved);
  }

  /* --- derived display helpers --- */

  const countdown = useMemo(() => {
    if (!unlock.unlocksAt) return null;
    const ms = Math.max(0, unlock.unlocksAt - now);
    const h = Math.floor(ms / 3_600_000);
    const m = Math.floor((ms % 3_600_000) / 60_000);
    const s = Math.floor((ms % 60_000) / 1000);
    return h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`;
  }, [unlock.unlocksAt, now]);

  const pigSprite =
    pigState === "eat"
      ? "pig-eat"
      : pigState === "sit"
        ? "pig-sit"
        : pigState === "spin" || pigState === "backflip"
          ? "pig-happy"
          : pigState === "walk" || pigState === "play"
            ? walkFrame
              ? "pig-walk1"
              : "pig-walk2"
            : unlock.canUnlock
              ? "pig-envelope"
              : mood === "sad" || mood === "hungry"
                ? "pig-sad"
                : "pig-idle";

  const sky =
    phase === "night"
      ? "linear-gradient(#1d2a52 0%, #2b3a67 55%, #40518a 100%)"
      : phase === "sunset"
        ? "linear-gradient(#7ec8e3 0%, #f9c784 60%, #f4a7b4 100%)"
        : "linear-gradient(#8ed3ee 0%, #aedef5 60%, #d9f3fa 100%)";

  const allDelivered = !unlock.nextNote && notes.length > 0;

  return (
    <main className="fixed inset-0 overflow-hidden select-none" style={{ background: sky }}>
      {/* stars at night */}
      {phase === "night" &&
        [...Array(24)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-white [animation:twinkle_2.4s_ease-in-out_infinite]"
            style={{
              left: `${(i * 41) % 97}%`,
              top: `${(i * 17) % 45}%`,
              animationDelay: `${(i % 5) * 0.5}s`,
            }}
          />
        ))}

      {/* sun / moon */}
      <div
        className="absolute right-[10%] top-[18%] w-14 h-14 border-4 border-ink/20"
        style={{ background: phase === "night" ? "#f0ead6" : "#ffd93d", borderRadius: 4 }}
      />

      {/* drifting clouds */}
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="absolute flex [animation:cloud-drift_linear_infinite]"
          style={{
            top: `${8 + i * 11}%`,
            animationDuration: `${70 + i * 25}s`,
            animationDelay: `${-i * 30}s`,
            opacity: phase === "night" ? 0.25 : 0.85,
          }}
        >
          <div className="w-10 h-6 bg-white" />
          <div className="w-14 h-9 bg-white -ml-2 -mt-3" />
          <div className="w-10 h-6 bg-white -ml-2" />
        </div>
      ))}

      {/* title */}
      <h1 className="absolute top-6 left-1/2 -translate-x-1/2 font-pixel text-xl sm:text-3xl text-ink bg-cream/90 border-2 border-ink px-4 py-2 shadow-[4px_4px_0_0_var(--ink)] max-w-[90vw] truncate z-10">
        {title}
      </h1>

      {/* HUD: pet stats */}
      <div className="absolute top-6 left-4 bg-cream/90 border-2 border-ink px-3 py-2 shadow-[3px_3px_0_0_var(--ink)] z-10">
        <p className="font-pixel text-sm text-ink mb-1">{petName}</p>
        <p className="font-pixel text-xs text-pig-deep" title="happiness">
          {"♥".repeat(Math.max(1, Math.round(pet.happiness / 20)))}
          <span className="opacity-25">{"♥".repeat(5 - Math.max(1, Math.round(pet.happiness / 20)))}</span>
        </p>
        <p className="font-pixel text-xs text-sunflower-deep" title="fullness">
          {"●".repeat(Math.max(0, 5 - Math.round(pet.hunger / 20)))}
          <span className="opacity-25">{"●".repeat(Math.min(5, Math.round(pet.hunger / 20)))}</span>
        </p>
      </div>

      {/* mailbox */}
      <button
        onClick={() => setMailboxOpen(true)}
        className="absolute top-6 right-4 bg-cream/90 border-2 border-ink px-3 py-2 shadow-[3px_3px_0_0_var(--ink)] font-pixel text-sm text-ink hover:bg-cream cursor-pointer z-10"
      >
        ✉ letters ({readNotes.length})
      </button>

      {/* ground */}
      <div className="absolute inset-x-0 bottom-0 h-[26%] bg-leaf border-t-8 border-leaf-deep" />
      <div className="absolute inset-x-0 bottom-0 h-[7%] bg-soil" />

      {/* sunflower garden — one per read note */}
      {readNotes.slice(-14).map((n, i, arr) => {
        const ageHours = n.read_at ? (now - new Date(n.read_at).getTime()) / 3_600_000 : 999;
        const stage = n.is_favorite || ageHours > 72 ? "bloom" : ageHours > 24 ? "bud" : "sprout";
        const size = stage === "bloom" ? (n.is_favorite ? 110 : 92) : stage === "bud" ? 66 : 34;
        const x = 4 + (i * 92) / Math.max(arr.length, 7);
        return (
          <button
            key={n.id}
            onClick={() => setOpenNote(n)}
            className="absolute bottom-[22%] origin-bottom [animation:sway_4s_ease-in-out_infinite] cursor-pointer hover:brightness-110 z-[5]"
            style={{ left: `${x}%`, animationDelay: `${(i % 4) * 0.6}s` }}
            title="re-read this letter"
          >
            <Sprite name={`sunflower-${stage}`} alt="a sunflower grown from a letter" height={size} />
            {n.is_favorite && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-pig-deep text-sm">♥</span>
            )}
          </button>
        );
      })}

      {/* the pig */}
      <div
        className="absolute bottom-[20%] z-10 transition-[left] duration-[2500ms] ease-in-out"
        style={{ left: `${pigX}%`, transform: "translateX(-50%)" }}
      >
        <button
          onClick={openTodaysLetter}
          disabled={!unlock.canUnlock || busy}
          className={`block cursor-${unlock.canUnlock ? "pointer" : "default"} ${
            pigState === "spin"
              ? "[animation:spin-once_0.6s_ease-in-out_2]"
              : pigState === "backflip"
                ? "[animation:backflip_1.1s_ease-in-out]"
                : pigState === "idle"
                  ? "[animation:bob_2s_ease-in-out_infinite]"
                  : ""
          }`}
          aria-label={unlock.canUnlock ? "open today's letter" : petName}
        >
          <Sprite name={pigSprite} alt={petName} height={110} flip={pigFlip} />
        </button>
        {showFood && (
          <div className="absolute -left-10 bottom-0">
            <Sprite name="strawberry" alt="a strawberry" height={34} />
          </div>
        )}
        {unlock.canUnlock && (
          <div className="absolute -top-9 left-1/2 -translate-x-1/2 font-pixel text-xs bg-sunflower border-2 border-ink px-2 py-1 whitespace-nowrap [animation:bob_1.4s_ease-in-out_infinite]">
            a letter for you!
          </div>
        )}
      </div>

      {/* hearts / sparkles */}
      {hearts.map((h) => (
        <span
          key={h.id}
          className="absolute font-pixel text-2xl pointer-events-none [animation:heart-float_1.5s_ease-out_forwards] z-20"
          style={{ left: `${h.x}%`, bottom: `${h.y}%`, color: h.kind === "heart" ? "#e8788a" : "#f7c948" }}
        >
          {h.kind === "heart" ? "♥" : "✦"}
        </span>
      ))}

      {/* status chip: countdown / all delivered / no notes */}
      {!unlock.canUnlock && (
        <div className="absolute bottom-[8%] left-1/2 -translate-x-1/2 bg-cream/95 border-2 border-ink px-4 py-2 shadow-[3px_3px_0_0_var(--ink)] font-pixel text-xs sm:text-sm text-ink text-center z-10 max-w-[90vw]">
          {countdown
            ? `next letter in ${countdown}`
            : allDelivered
              ? "every letter has been delivered ♥"
              : notes.length === 0
                ? "no letters planted here yet"
                : "…"}
        </div>
      )}

      {/* action bar */}
      <div className="absolute bottom-[2%] left-1/2 -translate-x-1/2 flex gap-2 z-10">
        <button
          onClick={() => petAction("feed")}
          disabled={busy}
          className="font-pixel text-xs sm:text-sm px-3 py-2 bg-cream border-2 border-ink shadow-[3px_3px_0_0_var(--ink)] active:shadow-none active:translate-x-[3px] active:translate-y-[3px] hover:bg-white disabled:opacity-50 cursor-pointer"
        >
          🍓 feed
        </button>
        <button
          onClick={() => petAction("play")}
          disabled={busy}
          className="font-pixel text-xs sm:text-sm px-3 py-2 bg-cream border-2 border-ink shadow-[3px_3px_0_0_var(--ink)] active:shadow-none active:translate-x-[3px] active:translate-y-[3px] hover:bg-white disabled:opacity-50 cursor-pointer"
        >
          ⚽ play
        </button>
        <button
          onClick={() => petAction("trick")}
          disabled={busy || pet.tricks_unlocked === 0}
          title={pet.tricks_unlocked === 0 ? `${petName} learns tricks as you read letters` : undefined}
          className="font-pixel text-xs sm:text-sm px-3 py-2 bg-cream border-2 border-ink shadow-[3px_3px_0_0_var(--ink)] active:shadow-none active:translate-x-[3px] active:translate-y-[3px] hover:bg-white disabled:opacity-50 cursor-pointer"
        >
          ✨ trick
        </button>
      </div>

      {openNote && (
        <LetterModal note={openNote} onClose={() => setOpenNote(null)} onToggleFavorite={toggleFavorite} />
      )}
      {mailboxOpen && (
        <Mailbox
          notes={readNotes}
          onClose={() => setMailboxOpen(false)}
          onOpen={(n) => {
            setMailboxOpen(false);
            setOpenNote(n);
          }}
        />
      )}
    </main>
  );
}
