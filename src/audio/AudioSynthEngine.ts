export type Note =
  | "C" | "C#" | "D" | "D#" | "E" | "F"
  | "F#" | "G" | "G#" | "A" | "A#" | "B";

export type ChordQuality =
  | "Major" | "Minor" | "Diminished" | "Augmented"
  | "Sus4" | "Major7" | "Minor7" | "Dominant7";

export type Waveform = "sine" | "square" | "sawtooth" | "triangle";

const NOTE_TO_SEMITONE: Record<Note, number> = {
  C: 0, "C#": 1, D: 2, "D#": 3, E: 4, F: 5,
  "F#": 6, G: 7, "G#": 8, A: 9, "A#": 10, B: 11,
};

const CHORD_INTERVALS: Record<ChordQuality, number[]> = {
  Major:       [0, 4, 7],
  Minor:       [0, 3, 7],
  Diminished:  [0, 3, 6],
  Augmented:   [0, 4, 8],
  Sus4:        [0, 5, 7],
  Major7:      [0, 4, 7, 11],
  Minor7:      [0, 3, 7, 10],
  Dominant7:   [0, 4, 7, 10],
};

const MAX_VOICES = 4;
const DEFAULT_OCTAVE = 4;
const MASTER_LEVEL = 0.18;
const RAMP_FREQ = 0.005;    // glide quase imperceptível
const RAMP_GAIN = 0.03;
const RAMP_RELEASE = 0.2;

/** Converte nota + oitava em Hz usando temperamento igual (A4 = 440Hz). */
export function noteToFrequency(note: Note, octave = DEFAULT_OCTAVE): number {
  const semisFromC0 = octave * 12 + NOTE_TO_SEMITONE[note];
  const A4 = 4 * 12 + NOTE_TO_SEMITONE.A; // 57
  return 440 * Math.pow(2, (semisFromC0 - A4) / 12);
}

/** Frequências em Hz para cada nota do acorde. */
export function computeChordFrequencies(
  note: Note,
  quality: ChordQuality,
  octave = DEFAULT_OCTAVE,
): number[] {
  const root = noteToFrequency(note, octave);
  return CHORD_INTERVALS[quality].map((s) => root * Math.pow(2, s / 12));
}

interface Voice {
  osc: OscillatorNode;
  gain: GainNode;
}

export class AudioSynthEngine {
  private ctx: AudioContext;
  private master: GainNode;
  private voices: Voice[] = [];
  private waveform: Waveform = "sine";
  private active = false;

  constructor() {
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(this.ctx.destination);

    for (let i = 0; i < MAX_VOICES; i++) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = this.waveform;
      osc.frequency.value = 440;
      gain.gain.value = 0;
      osc.connect(gain).connect(this.master);
      osc.start();
      this.voices.push({ osc, gain });
    }
  }

  /** Precisa ser chamado a partir de um user-gesture (click/tap). */
  async resume(): Promise<void> {
    if (this.ctx.state === "suspended") await this.ctx.resume();
  }

  get isRunning(): boolean {
    return this.ctx.state === "running";
  }

  setWaveform(w: Waveform): void {
    this.waveform = w;
    for (const v of this.voices) v.osc.type = w;
  }

  /**
   * Toca um acorde. `quality === null` (mão direita ausente/deadzone) cai
   * em "Major" por padrão, conforme spec.
   */
  playChord(note: Note, quality: ChordQuality | null, octave = DEFAULT_OCTAVE): void {
    const q = quality ?? "Major";
    const freqs = computeChordFrequencies(note, q, octave);
    const now = this.ctx.currentTime;
    const voiceLevel = 1 / freqs.length;

    for (let i = 0; i < this.voices.length; i++) {
      const v = this.voices[i];
      if (i < freqs.length) {
        v.osc.frequency.setTargetAtTime(freqs[i], now, RAMP_FREQ);
        v.gain.gain.setTargetAtTime(voiceLevel, now, RAMP_GAIN);
      } else {
        // Vozes extras silenciam (caso tríade após 7ª, p.ex.)
        v.gain.gain.setTargetAtTime(0, now, RAMP_GAIN);
      }
    }

    if (!this.active) {
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setTargetAtTime(MASTER_LEVEL, now, RAMP_GAIN);
      this.active = true;
    }
  }

  /** Mute com release suave. */
  release(): void {
    if (!this.active) return;
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(0, now, RAMP_RELEASE);
    this.active = false;
  }

  dispose(): void {
    try {
      for (const v of this.voices) v.osc.stop();
    } catch {
      // already stopped — safe to ignore
    }
    void this.ctx.close();
  }
}
