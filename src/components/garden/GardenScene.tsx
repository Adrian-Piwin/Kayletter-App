"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Sprite from "@/components/Sprite";
import Backdrop, { SKY_GRADIENT, type SkyPhase } from "./Backdrop";
import FieldNav from "./FieldNav";
import FlowerField from "./FlowerField";
import LetterModal from "./LetterModal";
import Mailbox from "./Mailbox";
import { useCamera, type ScrollDirection } from "./useCamera";
import { analyticsFetch, track } from "@/lib/analytics";
import { entrance, INTRO, INTRO_MS, type IntroPhase } from "@/lib/garden-intro";
import { FIELD_REFRESH_MS, nominalWidth, planField } from "@/lib/garden-layout";
import { useElementWidth, useIsMobile, usePrefersReducedMotion } from "@/lib/hooks";
import { getUnlockState } from "@/lib/unlock";
import { petMood, TRICKS } from "@/lib/pet";
import { sounds } from "@/lib/sound";
import type { Note } from "@/lib/types";

type PetStats = { happiness: number; hunger: number; tricks_unlocked: number };
type PigState = "idle" | "walk" | "eat" | "play" | "spin" | "backflip" | "sit";
type Heart = { id: number; x: number; y: number; kind: "heart" | "sparkle" };

const WALK_FRAME_MS = 170;
/** How long the pig takes to cross to a new spot, and its faster scripted gait. */
const PIG_WALK_MS = 2500;
const PIG_STEP_MS = 900;
/** The pig never wanders off the edges of the screen. */
const PIG_BOUNDS = { min: 12, max: 85 };
/** How far the pig drifts ahead when the field starts scrolling, in percent. */
const PIG_LEAD = 9;

const actionButtonClass =
  "font-pixel text-xs sm:text-sm min-h-11 px-3 bg-cream border-2 border-ink shadow-[3px_3px_0_0_var(--ink)] active:shadow-none active:translate-x-[3px] active:translate-y-[3px] hover:bg-white disabled:opacity-50 cursor-pointer touch-manipulation";

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

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
  /** Screen position of the pig, with the duration of the walk taking it there. */
  const [pigMove, setPigMove] = useState({ x: 50, ms: PIG_WALK_MS });
  /** Starts facing right: the pig walks in from the left when the scene opens. */
  const [pigFlip, setPigFlip] = useState(true);
  const [walkFrame, setWalkFrame] = useState(0);
  const [scrollDir, setScrollDir] = useState<ScrollDirection>(0);
  const [hearts, setHearts] = useState<Heart[]>([]);
  const [openNote, setOpenNote] = useState<Note | null>(null);
  const [mailboxOpen, setMailboxOpen] = useState(false);
  const [now, setNow] = useState(serverNow);
  const [phase, setPhase] = useState<SkyPhase>("day");
  const [showFood, setShowFood] = useState(false);
  const [introPhase, setIntroPhase] = useState<IntroPhase>("waiting");
  const heartId = useRef(0);
  const pigXRef = useRef(pigMove.x);
  const sceneRef = useRef<HTMLElement>(null);
  const isMobile = useIsMobile();
  const reduceMotion = usePrefersReducedMotion();
  const busy = pigState !== "idle" && pigState !== "walk";
  /** Reduced motion skips the opening outright rather than flashing through it. */
  const intro: IntroPhase = reduceMotion ? "done" : introPhase;
  const opening = intro === "playing";

  const unlock = useMemo(() => getUnlockState(notes), [notes]);
  const mood = petMood(pet);
  const readNotes = unlock.readNotes;

  /* --- pig movement --- */

  /** Walks the pig to a spot on screen, turning it to face the way it travels. */
  const movePig = useCallback((x: number, ms = PIG_WALK_MS) => {
    const next = clamp(x, PIG_BOUNDS.min, PIG_BOUNDS.max);
    if (next !== pigXRef.current) setPigFlip(next > pigXRef.current);
    pigXRef.current = next;
    setPigMove({ x: next, ms });
  }, []);

  /**
   * The camera reports which way the field is travelling. The pig sets off in
   * the same direction and leads by a step, so it looks like it is walking the
   * garden rather than being dragged along by it.
   */
  const handleScroll = useCallback(
    (dir: ScrollDirection) => {
      setScrollDir(dir);
      if (dir === 0 || busy) return;
      setPigFlip(dir > 0);
      movePig(pigXRef.current + dir * PIG_LEAD, PIG_STEP_MS);
    },
    [busy, movePig]
  );

  /* --- the field --- */

  const sceneWidth = useElementWidth(sceneRef, nominalWidth(isMobile));
  // Flowers only change stage hours apart, so the field is re-planned on a
  // coarse clock rather than with every tick of the countdown.
  const fieldNow = Math.floor(now / FIELD_REFRESH_MS) * FIELD_REFRESH_MS;
  const layout = useMemo(
    () => planField(readNotes, { isMobile, viewportWidth: sceneWidth, now: fieldNow }),
    [readNotes, isMobile, sceneWidth, fieldNow]
  );
  const scrollable = layout.screens > 1;

  const { camera, surfaceRef } = useCamera({
    screens: layout.screens,
    viewportWidth: sceneWidth,
    enabled: scrollable && !openNote && !mailboxOpen,
    onDirection: handleScroll,
  });

  useEffect(() => {
    track("garden_viewed", {
      note_count: notes.length,
      notes_delivered: readNotes.length,
      can_unlock: unlock.canUnlock,
      pet_mood: mood,
      field_screens: layout.screens,
    });
    // Funnel top-of-garden view — fire once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* --- the opening sequence --- */
  /**
   * Held until the scene has mounted rather than started from the server's
   * markup: the client re-plans the field as soon as it knows the real
   * viewport and the time of day, and a garden that had already begun
   * assembling itself would start over halfway through.
   *
   * Waiting on a frame also waits on the tab being looked at, so a letter
   * opened in the background is still greeted with its full opening.
   */
  useEffect(() => {
    const start = requestAnimationFrame(() => setIntroPhase("playing"));
    return () => cancelAnimationFrame(start);
  }, []);

  useEffect(() => {
    if (introPhase !== "playing") return;
    const done = setTimeout(() => setIntroPhase("done"), INTRO_MS);
    return () => clearTimeout(done);
  }, [introPhase]);

  /* --- ambient: clock tick for countdown + time-of-day sky --- */
  useEffect(() => {
    const tick = () => {
      setNow(Date.now());
      const hour = new Date().getHours();
      setPhase(hour >= 20 || hour < 6 ? "night" : hour >= 17 ? "sunset" : "day");
    };
    // The first tick lands on the frame the scene opens on, so the sky is the
    // right time of day before any of it is on screen.
    const first = requestAnimationFrame(tick);
    const t = setInterval(tick, 1000);
    return () => {
      cancelAnimationFrame(first);
      clearInterval(t);
    };
  }, []);

  /* --- pig wandering when idle --- */
  useEffect(() => {
    if (busy || unlock.canUnlock || scrollDir !== 0) return;
    const t = setInterval(() => {
      if (Math.random() < 0.5) return;
      setPigState("walk");
      movePig(15 + Math.random() * 70);
    }, 5000);
    return () => clearInterval(t);
  }, [busy, unlock.canUnlock, scrollDir, movePig]);

  /* --- walking frame animation --- */
  const walking = opening || pigState === "walk" || pigState === "play" || scrollDir !== 0;
  useEffect(() => {
    if (!walking) return;
    // The pig covers the whole screen on its way in, so it takes quicker steps
    // than it does pottering around the field.
    const every = opening ? INTRO.pig.frameMs : WALK_FRAME_MS;
    const frames = setInterval(() => setWalkFrame((f) => f ^ 1), every);
    return () => clearInterval(frames);
  }, [walking, opening]);

  /* --- stop walking once the pig has reached where it was headed --- */
  useEffect(() => {
    if (pigState !== "walk") return;
    const stop = setTimeout(() => setPigState("idle"), PIG_WALK_MS + 100);
    return () => clearTimeout(stop);
  }, [pigState]);

  /* --- pig walks to centre when a letter is ready --- */
  useEffect(() => {
    if (!unlock.canUnlock || busy) return;
    movePig(50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlock.canUnlock]);

  const burstHearts = useCallback((count: number, kind: Heart["kind"] = "heart") => {
    const burst: Heart[] = Array.from({ length: count }, () => ({
      id: heartId.current++,
      x: clamp(pigXRef.current - 8 + Math.random() * 16, 2, 96),
      y: 30 + Math.random() * 20,
      kind,
    }));
    setHearts((h) => [...h, ...burst]);
    setTimeout(() => setHearts((h) => h.filter((x) => !burst.includes(x))), 1600);
  }, []);

  /* --- actions --- */

  async function petAction(action: "feed" | "play" | "trick") {
    if (busy) return;
    const res = await analyticsFetch(`/api/l/${token}/pet`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (!res.ok) return;
    const { pet: saved } = await res.json();
    track("pet_action", { action, happiness: saved.happiness, hunger: saved.hunger });

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
      const here = pigXRef.current;
      movePig(here + 22, PIG_STEP_MS);
      setTimeout(() => movePig(here - 22, PIG_STEP_MS), 900);
      setTimeout(() => movePig(here, PIG_STEP_MS), 1800);
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
      setTimeout(
        () => {
          setPigState("idle");
          burstHearts(5, "sparkle");
          setPet((p) => ({ ...p, ...saved }));
        },
        state === "sit" ? 2000 : 1300
      );
    }
  }

  /** Set when a letter is opened, so the camera can walk out to its new flower. */
  const showNewFlower = useRef(false);

  async function openTodaysLetter() {
    if (!unlock.canUnlock || busy) return;
    const res = await analyticsFetch(`/api/l/${token}/unlock`, { method: "POST" });
    if (!res.ok) return;
    const { note } = await res.json();
    sounds.unlock();
    burstHearts(6);
    showNewFlower.current = true;
    setNotes((ns) => ns.map((n) => (n.id === note.id ? note : n)));
    setOpenNote(note);
    track("letter_opened", {
      delivery_index: readNotes.length + 1,
      note_count: notes.length,
      source: "unlock",
    });
    setPet((p) => ({
      ...p,
      tricks_unlocked: Math.max(p.tricks_unlocked, Math.floor((readNotes.length + 1) / 2)),
    }));
  }

  // Runs after the new flower has been planted and the world resized.
  useEffect(() => {
    if (!showNewFlower.current) return;
    showNewFlower.current = false;
    camera.panToEnd();
  }, [camera, readNotes.length]);

  async function toggleFavorite(note: Note) {
    sounds.pop();
    const nextFavorite = !note.is_favorite;
    const res = await analyticsFetch(`/api/l/${token}/favorite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ noteId: note.id, isFavorite: nextFavorite }),
    });
    if (!res.ok) return;
    const { note: saved } = await res.json();
    setNotes((ns) => ns.map((n) => (n.id === saved.id ? saved : n)));
    if (openNote?.id === saved.id) setOpenNote(saved);
    track(nextFavorite ? "letter_favorited" : "letter_unfavorited");
  }

  const openFlower = useCallback((note: Note) => {
    track("letter_opened", { source: "sunflower", is_favorite: note.is_favorite });
    setOpenNote(note);
  }, []);

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
          : walking
            ? walkFrame
              ? "pig-walk1"
              : "pig-walk2"
            : unlock.canUnlock
              ? "pig-envelope"
              : mood === "sad" || mood === "hungry"
                ? "pig-sad"
                : "pig-idle";

  const allDelivered = !unlock.nextNote && notes.length > 0;

  return (
    /*
     * h-svh rather than inset-0 so mobile browser chrome can't crop the scene.
     * `clip` rather than `hidden`: the field is far wider than the viewport, and
     * a scroll container would let focus or a stray gesture shunt the whole
     * scene sideways behind the camera's back.
     */
    <main
      ref={sceneRef}
      className="fixed inset-x-0 top-0 h-svh overflow-clip select-none"
      style={{ background: SKY_GRADIENT[phase] }}
    >
      {/* the walkable world — everything in here moves with the camera */}
      <div
        ref={surfaceRef}
        className={`absolute inset-0 ${scrollable ? "cursor-grab active:cursor-grabbing" : ""}`}
        // The page never scrolls, so a horizontal drag belongs to the field.
        style={scrollable ? { touchAction: "none" } : undefined}
      >
        <Backdrop
          camera={camera}
          phase={phase}
          screens={layout.screens}
          horizonPct={layout.horizonPct}
          isMobile={isMobile}
          intro={intro}
        />

        <FlowerField layout={layout} camera={camera} onOpen={openFlower} intro={intro} />

        {/*
         * The pig — held on screen while the field slides past underneath.
         * Centring is left to the `translate` property so the opening walk has
         * `transform` to itself, and a steady gait rather than an eased one.
         */}
        <div
          className="absolute ease-in-out -translate-x-1/2"
          style={{
            left: `${pigMove.x}%`,
            bottom: `${layout.pig.bottomPct}%`,
            zIndex: layout.pig.zIndex,
            transitionProperty: "left",
            transitionDuration: `${pigMove.ms}ms`,
            ...entrance(intro, "pig-walk-in", INTRO.pig, { easing: "linear" }),
          }}
        >
          <button
            onClick={openTodaysLetter}
            disabled={!unlock.canUnlock || busy}
            className={`block cursor-${unlock.canUnlock ? "pointer" : "default"} ${
              pigState === "spin"
                ? "[animation:spin-once_0.6s_ease-in-out_2]"
                : pigState === "backflip"
                  ? "[animation:backflip_1.1s_ease-in-out]"
                  : pigState === "idle" && !opening
                    ? "[animation:bob_2s_ease-in-out_infinite]"
                    : ""
            }`}
            aria-label={unlock.canUnlock ? "open today's letter" : petName}
          >
            <Sprite name={pigSprite} alt={petName} height={isMobile ? 102 : 110} flip={pigFlip} />
          </button>
          {showFood && (
            <div className="absolute -left-8 sm:-left-10 bottom-0">
              <Sprite name="strawberry" alt="a strawberry" height={isMobile ? 32 : 34} />
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
            className="absolute font-pixel text-2xl pointer-events-none [animation:heart-float_1.5s_ease-out_forwards] z-[14]"
            style={{
              left: `${h.x}%`,
              bottom: `${h.y}%`,
              color: h.kind === "heart" ? "#e8788a" : "#f7c948",
            }}
          >
            {h.kind === "heart" ? "♥" : "✦"}
          </span>
        ))}
      </div>

      {scrollable && <FieldNav camera={camera} intro={intro} />}

      {/*
       * Top bar: stats and mailbox share a row; the title wraps below them on
       * small screens. Three columns rather than a flex row, with matching
       * flexible tracks either side, so the title centres on the scene itself
       * instead of on whatever space the two cards happen to leave it.
       */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 grid grid-cols-[auto_1fr] sm:grid-cols-[1fr_auto_1fr] items-start gap-2 p-3 sm:p-4">
        {/* HUD: pet stats */}
        <div
          className="justify-self-start bg-cream/90 border-2 border-ink px-2.5 py-1.5 sm:px-3 sm:py-2 shadow-[3px_3px_0_0_var(--ink)]"
          style={entrance(intro, "enter-drop", INTRO.hud, { extraDelay: INTRO.hud.stagger })}
        >
          <p className="font-pixel text-xs sm:text-sm text-ink mb-1 max-w-28 sm:max-w-none truncate">
            {petName}
          </p>
          <p className="font-pixel text-xs text-pig-deep" title="happiness">
            {"♥".repeat(Math.max(1, Math.round(pet.happiness / 20)))}
            <span className="opacity-25">
              {"♥".repeat(5 - Math.max(1, Math.round(pet.happiness / 20)))}
            </span>
          </p>
          <p className="font-pixel text-xs text-sunflower-deep" title="fullness">
            {"●".repeat(Math.max(0, 5 - Math.round(pet.hunger / 20)))}
            <span className="opacity-25">{"●".repeat(Math.min(5, Math.round(pet.hunger / 20)))}</span>
          </p>
        </div>

        {/* title */}
        <h1
          className="order-last col-span-2 min-w-0 text-center sm:order-none sm:col-span-1 font-pixel text-lg sm:text-3xl text-ink"
          style={entrance(intro, "enter-drop", INTRO.hud)}
        >
          <span className="inline-block max-w-full truncate align-bottom bg-cream/90 border-2 border-ink px-3 py-1.5 sm:px-4 sm:py-2 shadow-[4px_4px_0_0_var(--ink)]">
            {title}
          </span>
        </h1>

        {/* mailbox */}
        <button
          onClick={() => {
            track("mailbox_opened", { letters_count: readNotes.length });
            setMailboxOpen(true);
          }}
          className="pointer-events-auto justify-self-end min-h-11 bg-cream/90 border-2 border-ink px-3 shadow-[3px_3px_0_0_var(--ink)] font-pixel text-xs sm:text-sm text-ink hover:bg-cream cursor-pointer touch-manipulation"
          style={entrance(intro, "enter-drop", INTRO.hud, { extraDelay: INTRO.hud.stagger * 2 })}
        >
          ✉ <span className="hidden sm:inline">letters </span>({readNotes.length})
        </button>
      </div>

      {/* status chip: countdown / all delivered / no notes — clears the action bar on short screens */}
      {!unlock.canUnlock && (
        <div
          className="absolute bottom-20 sm:bottom-[8%] left-1/2 -translate-x-1/2 bg-cream/95 border-2 border-ink px-3 sm:px-4 py-2 shadow-[3px_3px_0_0_var(--ink)] font-pixel text-xs sm:text-sm text-ink text-center z-20 max-w-[90vw]"
          style={entrance(intro, "enter-rise", INTRO.controls)}
        >
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
      <div
        className="absolute bottom-4 sm:bottom-[2%] inset-x-0 flex flex-wrap justify-center gap-2 px-3 z-20"
        style={entrance(intro, "enter-rise", INTRO.controls)}
      >
        <button onClick={() => petAction("feed")} disabled={busy} className={actionButtonClass}>
          🍓 feed
        </button>
        <button onClick={() => petAction("play")} disabled={busy} className={actionButtonClass}>
          ⚽ play
        </button>
        <button
          onClick={() => petAction("trick")}
          disabled={busy || pet.tricks_unlocked === 0}
          title={pet.tricks_unlocked === 0 ? `${petName} learns tricks as you read letters` : undefined}
          className={actionButtonClass}
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
            track("letter_opened", { source: "mailbox", is_favorite: n.is_favorite });
            setMailboxOpen(false);
            setOpenNote(n);
          }}
        />
      )}
    </main>
  );
}
