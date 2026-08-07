"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { REVEAL, scatterPetals, type Petal, type RevealPhase } from "@/lib/letter-reveal";
import { sounds } from "@/lib/sound";
import type { Note } from "@/lib/types";

type Options = {
  /** Reduced motion skips the ceremony outright rather than flashing through it. */
  reduceMotion: boolean;
  /** The garden's own flower colours, thrown when the seal breaks. */
  petalColours: readonly string[];
  /** The letter has arrived and its card should be on screen. */
  onOpen: (note: Note) => void;
  /** The unlock failed — put the envelope back on the pig. */
  onFail: () => void;
  /** The card is away: clear it and walk the camera out to the new flower. */
  onLanded: () => void;
};

/**
 * Drives the ceremony of opening today's letter.
 *
 * Every beat is scheduled from the click rather than from the server's reply,
 * the same rule the pet actions follow — a slow round-trip must not be able to
 * stretch one part of the sequence past the others. The request is raced
 * against the opening beats instead: by the time any of the letter's own text
 * is needed, roughly a second of cover has already played, and if the network
 * is slower than that the envelope simply hangs sealed a moment longer.
 */
export function useLetterReveal({
  reduceMotion,
  petalColours,
  onOpen,
  onFail,
  onLanded,
}: Options) {
  const [phase, setPhase] = useState<RevealPhase>("idle");
  const [petals, setPetals] = useState<Petal[]>([]);
  /** The letter this ceremony is for, held while its flower waits to sprout. */
  const [sproutNoteId, setSproutNoteId] = useState<string | null>(null);
  /** Finishers for the beat in flight, so a skip can cut it short. */
  const beat = useRef<(() => void)[]>([]);
  const alive = useRef(true);
  const running = useRef(false);
  const skipped = useRef(false);

  const cutBeat = () => beat.current.splice(0).forEach((finish) => finish());

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      cutBeat();
    };
  }, []);

  /** A beat of the sequence, resolvable early by `skip`. */
  const wait = useCallback(
    (ms: number) =>
      new Promise<void>((resolve) => {
        let timer: ReturnType<typeof setTimeout>;
        const finish = () => {
          clearTimeout(timer);
          beat.current = beat.current.filter((f) => f !== finish);
          resolve();
        };
        timer = setTimeout(finish, ms);
        beat.current.push(finish);
      }),
    []
  );

  const begin = useCallback(
    async (request: Promise<Note | null>) => {
      if (running.current) return;
      running.current = true;
      skipped.current = false;

      if (reduceMotion) {
        const note = await request;
        if (!alive.current) return;
        if (!note) {
          running.current = false;
          onFail();
          return;
        }
        setPhase("reading");
        onOpen(note);
        return;
      }

      setPhase("lifting");
      sounds.rustle();
      await wait(REVEAL.lift.duration);
      if (!alive.current) return;
      if (!skipped.current) setPhase("sealed");

      // The gate: whichever of the letter and the held beat finishes last.
      const [note] = await Promise.all([request, wait(REVEAL.sealed.duration)]);
      if (!alive.current) return;

      if (!note) {
        running.current = false;
        setPhase("idle");
        onFail();
        return;
      }

      // Its flower is planted now but held back until the closing payoff, so
      // the garden looks untouched behind the letter being read.
      setSproutNoteId(note.id);

      if (!skipped.current) {
        setPetals(scatterPetals(petalColours));
        setPhase("breaking");
        sounds.seal();
        await wait(REVEAL.breaking.duration);
        if (!alive.current) return;
      }

      setPhase("reading");
      sounds.reveal();
      onOpen(note);
    },
    [reduceMotion, petalColours, onOpen, onFail, wait]
  );

  /** Cut to the letter itself. Someone on their fifth letter has seen this. */
  const skip = useCallback(() => {
    if (!running.current || skipped.current) return;
    skipped.current = true;
    cutBeat();
  }, []);

  const dismiss = useCallback(async () => {
    if (!running.current) return;

    if (reduceMotion) {
      setPhase("idle");
      setSproutNoteId(null);
      running.current = false;
      onLanded();
      sounds.bloom();
      return;
    }

    setPhase("closing");
    sounds.rustle();
    await wait(REVEAL.closing.duration);
    if (!alive.current) return;

    // Clears the card and sets the camera walking; the flower it is walking to
    // is still hidden at this point.
    onLanded();
    setPhase("sprouting");
    await wait(REVEAL.sprouting.pan);
    if (!alive.current) return;
    sounds.bloom();

    await wait(REVEAL.sprouting.duration);
    if (!alive.current) return;
    setPhase("idle");
    setSproutNoteId(null);
    running.current = false;
  }, [reduceMotion, onLanded, wait]);

  return {
    phase,
    petals,
    /** True for a letter being opened with the ceremony, false for a re-read. */
    ceremonial: phase !== "idle",
    /**
     * How the field should treat the new flower: out of sight while its letter
     * is being read, then breaking ground once the camera has gone to find it.
     */
    sprout: sproutNoteId ? { noteId: sproutNoteId, playing: phase === "sprouting" } : null,
    begin,
    skip,
    dismiss,
  };
}
