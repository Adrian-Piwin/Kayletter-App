"use client";

/**
 * Every sound in the garden, generated in the browser — there are no audio
 * assets to ship, preload or license. Two primitives carry all of it: `blip`
 * for anything musical and `noise` for anything physical. A bare oscillator
 * cannot make a paper rustle and filtered noise cannot make a chord, so the
 * reveal needs both.
 */

/** Remembered across visits, so someone who wants quiet only has to ask once. */
const MUTE_KEY = "kayletter:muted";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
/** Null until first read; the stored preference is only fetched once. */
let muted: boolean | null = null;
const listeners = new Set<() => void>();

export function isMuted(): boolean {
  if (muted === null) {
    if (typeof window === "undefined") return false;
    try {
      muted = window.localStorage.getItem(MUTE_KEY) === "1";
    } catch {
      // Blocked storage lands here rather than breaking the scene; sound plays.
      muted = false;
    }
  }
  return muted;
}

export function toggleMuted() {
  const next = !isMuted();
  muted = next;
  try {
    window.localStorage.setItem(MUTE_KEY, next ? "1" : "0");
  } catch {
    // Preference is lost on reload, but the toggle still works this visit.
  }
  // Muting rides the master gain rather than a check inside each cue: the
  // reveal schedules its notes well ahead of time, and a flag would let the
  // rest of the sequence play on over someone who has just asked for quiet.
  if (ctx && master) master.gain.setTargetAtTime(next ? 0 : 1, ctx.currentTime, 0.01);
  listeners.forEach((fn) => fn());
}

export function subscribeMuted(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** The server has no stored preference; it arrives on hydration. */
export const mutedOnServer = () => false;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    try {
      const ac = new AudioContext();
      const gain = ac.createGain();
      gain.gain.value = isMuted() ? 0 : 1;
      gain.connect(ac.destination);
      ctx = ac;
      master = gain;
    } catch {
      return null;
    }
  }
  // A context built outside a gesture is handed back suspended. Every cue here
  // follows a tap, so by the time one plays, resuming is allowed.
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

type Wave = "square" | "triangle" | "sine";

function blip(freq: number, start: number, duration: number, volume = 0.08, type: Wave = "square") {
  const ac = audio();
  if (!ac || !master) return;
  const at = ac.currentTime + start;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(volume, at);
  gain.gain.exponentialRampToValueAtTime(0.001, at + duration);
  osc.connect(gain).connect(master);
  osc.start(at);
  osc.stop(at + duration);
}

/**
 * A burst of white noise pushed through a bandpass that sweeps from `from` to
 * `to`. The sweep is what gives each burst its character: falling reads as
 * something settling (paper), rising as something tearing.
 */
function noise(
  start: number,
  duration: number,
  { volume = 0.05, from = 2600, to = 900, q = 1.1 } = {}
) {
  const ac = audio();
  if (!ac || !master) return;
  const at = ac.currentTime + start;
  const frames = Math.max(1, Math.ceil(ac.sampleRate * duration));
  const buffer = ac.createBuffer(1, frames, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;

  const src = ac.createBufferSource();
  src.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = "bandpass";
  filter.Q.value = q;
  filter.frequency.setValueAtTime(from, at);
  filter.frequency.exponentialRampToValueAtTime(to, at + duration);

  const gain = ac.createGain();
  // A short fade in either end: noise cut off square clicks audibly.
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.linearRampToValueAtTime(volume, at + duration * 0.15);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);

  src.connect(filter).connect(gain).connect(master);
  src.start(at);
  src.stop(at + duration);
}

export const sounds = {
  /** Paper handled — two overlapping crumples, falling, for opening and closing. */
  rustle() {
    noise(0, 0.18, { volume: 0.045, from: 3200, to: 1100 });
    noise(0.11, 0.22, { volume: 0.035, from: 2400, to: 700 });
  },
  /** The seal giving way: a sharp tear over a low thump. */
  seal() {
    noise(0, 0.09, { volume: 0.07, from: 1400, to: 5200, q: 0.7 });
    blip(160, 0.02, 0.16, 0.06, "triangle");
    noise(0.08, 0.3, { volume: 0.03, from: 4200, to: 900 });
  },
  /** The letter opening — a soft rising arpeggio, the emotional beat. */
  reveal() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => blip(freq, i * 0.11, 0.5, 0.06, "triangle"));
    // A fifth above the last note, quieter and longer, so the phrase opens out
    // rather than stopping on the top of the run.
    blip(1568, 0.44, 0.9, 0.025, "sine");
  },
  /** The new flower breaking ground — a warm chord that resolves the reveal. */
  bloom() {
    [392, 494, 587].forEach((freq, i) => blip(freq, i * 0.05, 0.8, 0.05, "triangle"));
    blip(784, 0.16, 0.7, 0.03, "sine");
  },
  /** Munching crunch. */
  eat() {
    blip(220, 0, 0.06, 0.06);
    blip(180, 0.12, 0.06, 0.06);
    blip(200, 0.24, 0.08, 0.06);
  },
  /** Boingy play sound. */
  play() {
    blip(392, 0, 0.08);
    blip(523, 0.08, 0.1);
  },
  /** Ta-da for tricks. */
  trick() {
    blip(659, 0, 0.09);
    blip(784, 0.09, 0.09);
    blip(1047, 0.18, 0.18);
  },
  /** Soft pop for hearts/favorites. */
  pop() {
    blip(880, 0, 0.07, 0.05);
  },
};
