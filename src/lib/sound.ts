"use client";

/** Tiny WebAudio chiptune blips — no audio assets needed. */

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    try {
      ctx = new AudioContext();
    } catch {
      return null;
    }
  }
  return ctx;
}

function blip(freq: number, start: number, duration: number, volume = 0.08) {
  const ac = audio();
  if (!ac) return;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = "square";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(volume, ac.currentTime + start);
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + start + duration);
  osc.connect(gain).connect(ac.destination);
  osc.start(ac.currentTime + start);
  osc.stop(ac.currentTime + start + duration);
}

export const sounds = {
  /** Rising chime when a letter opens. */
  unlock() {
    blip(523, 0, 0.12);
    blip(659, 0.1, 0.12);
    blip(784, 0.2, 0.2);
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
