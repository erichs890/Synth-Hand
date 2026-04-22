import type { ReactNode } from "react";
import type { Waveform } from "../audio/AudioSynthEngine";
import {
  DEADZONE_MAX,
  DEADZONE_MIN,
  type ScaleMode,
  type Settings,
} from "../lib/settings";

const WAVEFORMS: Waveform[] = ["sine", "square", "sawtooth"];

const SCALES: Array<{ id: ScaleMode; label: string; hint: string }> = [
  { id: "diatonic", label: "Diatonic · C Major", hint: "7 notes + accidental ring" },
  { id: "pentatonic", label: "Pentatonic", hint: "5 notes — no wrong notes" },
  { id: "blues", label: "Blues", hint: "6 notes with blue 3rd + ♭5 + ♭7" },
];

interface Props {
  open: boolean;
  onClose: () => void;
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  onReset: () => void;
}

export function SettingsPanel({ open, onClose, settings, onChange, onReset }: Props) {
  return (
    <aside
      className={`pointer-events-auto fixed right-0 top-0 bottom-0 z-50 flex w-80 flex-col border-l border-[var(--color-border)] bg-black/90 shadow-[-20px_0_60px_rgba(0,0,0,0.6)] backdrop-blur-xl transition-transform duration-300 ease-out ${
        open ? "translate-x-0" : "translate-x-full"
      }`}
      aria-hidden={!open}
    >
      <header className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.3em] text-neutral-200">
          Settings
        </h2>
        <button
          onClick={onClose}
          aria-label="Close settings"
          className="flex h-7 w-7 items-center justify-center rounded-md text-lg leading-none text-neutral-400 transition hover:bg-white/5 hover:text-white"
        >
          ×
        </button>
      </header>

      <div className="flex-1 space-y-8 overflow-y-auto px-5 py-6">
        <Section label="Waveform">
          <div className="grid grid-cols-3 gap-2">
            {WAVEFORMS.map((w) => {
              const active = settings.waveform === w;
              const display = w === "sawtooth" ? "saw" : w;
              return (
                <button
                  key={w}
                  onClick={() => onChange({ waveform: w })}
                  className={`rounded-md border px-3 py-2 text-[11px] font-semibold uppercase tracking-wider transition ${
                    active
                      ? "border-[var(--color-accent)] bg-[var(--color-accent)]/15 text-[var(--color-accent)]"
                      : "border-[var(--color-border)] bg-white/[.02] text-neutral-400 hover:bg-white/[.05] hover:text-white"
                  }`}
                >
                  {display}
                </button>
              );
            })}
          </div>
        </Section>

        <Section label="Scale lock" hint="Constrains the left roleta to musical scales">
          <div className="flex flex-col gap-2">
            {SCALES.map(({ id, label, hint }) => {
              const active = settings.scale === id;
              return (
                <button
                  key={id}
                  onClick={() => onChange({ scale: id })}
                  className={`rounded-md border px-3 py-2 text-left transition ${
                    active
                      ? "border-[var(--color-accent)] bg-[var(--color-accent)]/15"
                      : "border-[var(--color-border)] bg-white/[.02] hover:bg-white/[.05]"
                  }`}
                >
                  <p
                    className={`text-sm font-medium ${
                      active ? "text-[var(--color-accent)]" : "text-white"
                    }`}
                  >
                    {label}
                  </p>
                  <p className="text-[11px] text-neutral-500">{hint}</p>
                </button>
              );
            })}
          </div>
        </Section>

        <Section
          label="Deadzone"
          value={`${settings.deadzone} px`}
          hint="Zona morta interna — o dedo precisa sair dela pra selecionar"
        >
          <input
            type="range"
            min={DEADZONE_MIN}
            max={DEADZONE_MAX}
            step={1}
            value={settings.deadzone}
            onChange={(e) => onChange({ deadzone: Number(e.target.value) })}
            className="w-full accent-[var(--color-accent)]"
          />
          <div className="mt-1 flex justify-between text-[10px] text-neutral-500">
            <span>{DEADZONE_MIN} px</span>
            <span>{DEADZONE_MAX} px</span>
          </div>
        </Section>
      </div>

      <footer className="border-t border-[var(--color-border)] px-5 py-4">
        <button
          onClick={onReset}
          className="w-full rounded-md border border-[var(--color-border)] bg-white/[.02] px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 transition hover:bg-white/[.05] hover:text-white"
        >
          Reset to defaults
        </button>
        <p className="mt-3 text-center text-[10px] text-neutral-600">
          Saved locally — persists between sessions
        </p>
      </footer>
    </aside>
  );
}

function Section({
  label,
  hint,
  value,
  children,
}: {
  label: string;
  hint?: string;
  value?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-neutral-400">
          {label}
        </p>
        {value && <p className="font-mono text-xs text-[var(--color-accent)]">{value}</p>}
      </div>
      {children}
      {hint && <p className="mt-2 text-[10px] leading-relaxed text-neutral-500">{hint}</p>}
    </div>
  );
}
