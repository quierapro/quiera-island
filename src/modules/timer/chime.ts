/**
 * The timer's chime, made with Web Audio: no sound file to ship. The audio
 * context is created while the user starts the timer (browsers only let a
 * page make sound after a gesture), then sleeps until the timer rings.
 */
let context: AudioContext | null = null;

/** Called from the gesture that starts a timer. */
export function primeChime(): void {
  try {
    context ??= new AudioContext();
    void context.suspend();
  } catch {
    // No audio: the timer still rings on the island.
  }
}

/** A rising three-note phrase, played this many times. */
const NOTES = [880, 1174.66, 1567.98];
const REPEATS = 3;
const PHRASE_S = 1.4;

/** Plays the chime; the returned function silences it. */
export function ring(): () => void {
  try {
    context ??= new AudioContext();
  } catch {
    return () => {};
  }
  const ctx = context;
  void ctx.resume();
  const master = ctx.createGain();
  master.gain.value = 0.22;
  master.connect(ctx.destination);
  const start = ctx.currentTime + 0.05;
  for (let r = 0; r < REPEATS; r++) {
    NOTES.forEach((frequency, i) => {
      const at = start + r * PHRASE_S + i * 0.16;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(1, at + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.9);
      osc.connect(gain).connect(master);
      osc.start(at);
      osc.stop(at + 0.95);
    });
  }
  const end = setTimeout(() => void ctx.suspend(), (REPEATS * PHRASE_S + 1.2) * 1000);
  return () => {
    clearTimeout(end);
    master.disconnect();
    void ctx.suspend();
  };
}
