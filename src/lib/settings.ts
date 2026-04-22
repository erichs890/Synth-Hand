import { useCallback, useState } from "react";
import type { Waveform } from "../audio/AudioSynthEngine";

export type ScaleMode = "diatonic" | "pentatonic" | "blues";

export interface Settings {
  waveform: Waveform;
  scale: ScaleMode;
  deadzone: number;
}

export const DEFAULT_SETTINGS: Settings = {
  waveform: "sine",
  scale: "diatonic",
  deadzone: 70,
};

export const DEADZONE_MIN = 40;
export const DEADZONE_MAX = 160;

const STORAGE_KEY = "synth-hand:settings:v1";

function isWaveform(x: unknown): x is Waveform {
  return x === "sine" || x === "square" || x === "sawtooth" || x === "triangle";
}

function isScale(x: unknown): x is ScaleMode {
  return x === "diatonic" || x === "pentatonic" || x === "blues";
}

function clampDeadzone(x: unknown): number {
  if (typeof x !== "number" || !Number.isFinite(x)) return DEFAULT_SETTINGS.deadzone;
  return Math.max(DEADZONE_MIN, Math.min(DEADZONE_MAX, Math.round(x)));
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return DEFAULT_SETTINGS;
    const record = parsed as Record<string, unknown>;
    return {
      waveform: isWaveform(record.waveform) ? record.waveform : DEFAULT_SETTINGS.waveform,
      scale: isScale(record.scale) ? record.scale : DEFAULT_SETTINGS.scale,
      deadzone: clampDeadzone(record.deadzone),
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // quota cheio ou storage indisponível — ignoramos
  }
}

export interface UseSettingsResult {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  reset: () => void;
}

export function useSettings(): UseSettingsResult {
  const [settings, setSettings] = useState<Settings>(loadSettings);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
    saveSettings(DEFAULT_SETTINGS);
  }, []);

  return { settings, update, reset };
}
