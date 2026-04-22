import { useEffect, useState } from "react";
import { useHandTracking, type HandData, type TrackingStatus } from "./hooks/useHandTracking";
import { useRadialMenu, type Point } from "./hooks/useRadialMenu";
import { useAudioSynth } from "./hooks/useAudioSynth";
import type { ChordQuality, Note } from "./audio/AudioSynthEngine";
import { useSettings, type ScaleMode } from "./lib/settings";
import { SettingsPanel } from "./components/SettingsPanel";

const LEFT_SLICES = 8;
const RIGHT_SLICES = 8;
const MENU_RADIUS = 180;

type Accent = "sky" | "emerald";
const ACCENT_HEX: Record<Accent, string> = {
  sky: "#38bdf8",
  emerald: "#34d399",
};

const CHROMATIC: Note[] = [
  "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
];

/* ------------------------------------------------------------------ */
/*  Escalas (8 slots cada — 1 slot por fatia da roleta)               */
/* ------------------------------------------------------------------ */

const SCALE_NOTES: Record<ScaleMode, Array<{ note: Note; octave: number }>> = {
  diatonic: [
    { note: "C", octave: 4 }, { note: "D", octave: 4 },
    { note: "E", octave: 4 }, { note: "F", octave: 4 },
    { note: "G", octave: 4 }, { note: "A", octave: 4 },
    { note: "B", octave: 4 }, { note: "C", octave: 5 },
  ],
  pentatonic: [
    // C major pentatonic — 5 graus + 3 extras na oitava acima
    { note: "C", octave: 4 }, { note: "D", octave: 4 },
    { note: "E", octave: 4 }, { note: "G", octave: 4 },
    { note: "A", octave: 4 }, { note: "C", octave: 5 },
    { note: "D", octave: 5 }, { note: "E", octave: 5 },
  ],
  blues: [
    // C blues hexatonic — 6 graus + 2 extras na oitava acima
    { note: "C",  octave: 4 }, { note: "D#", octave: 4 }, // E♭
    { note: "F",  octave: 4 }, { note: "F#", octave: 4 },
    { note: "G",  octave: 4 }, { note: "A#", octave: 4 }, // B♭
    { note: "C",  octave: 5 }, { note: "D#", octave: 5 },
  ],
};

const SCALE_LABELS: Record<ScaleMode, string[]> = {
  diatonic:   ["C", "D", "E", "F", "G", "A", "B", "C"],
  pentatonic: ["C", "D", "E", "G", "A", "C", "D", "E"],
  blues:      ["C", "E♭", "F", "F♯", "G", "B♭", "C", "E♭"],
};

const SHARP_LABELS = ["C♯", "D♯", "E♯", "F♯", "G♯", "A♯", "B♯", "C♯"];

const RIGHT_SLICE_TO_QUALITY: ChordQuality[] = [
  "Major", "Minor", "Sus4", "Major7",
  "Minor7", "Dominant7", "Diminished", "Augmented",
];

function applyAccidental(
  base: { note: Note; octave: number },
  sharp: boolean,
): { note: Note; octave: number } {
  if (!sharp) return base;
  const idx = CHROMATIC.indexOf(base.note);
  const next = idx + 1;
  if (next >= 12) return { note: CHROMATIC[0], octave: base.octave + 1 };
  return { note: CHROMATIC[next], octave: base.octave };
}

/* ------------------------------------------------------------------ */
/*  App                                                               */
/* ------------------------------------------------------------------ */

export default function App() {
  const { videoRef, status, error, left, right } = useHandTracking();
  const engine = useAudioSynth();
  const viewport = useViewportSize();
  const { settings, update, reset } = useSettings();

  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const accidentalThreshold = (settings.deadzone + MENU_RADIUS) / 2;
  const canAccidentalize = settings.scale === "diatonic";

  const leftCenter: Point = { x: viewport.width * 0.22, y: viewport.height * 0.55 };
  const rightCenter: Point = { x: viewport.width * 0.78, y: viewport.height * 0.55 };

  const leftFinger = toPixels(left.indexTip, viewport);
  const rightFinger = toPixels(right.indexTip, viewport);

  const leftMenu = useRadialMenu({
    point: leftFinger,
    center: leftCenter,
    slices: LEFT_SLICES,
    deadzone: settings.deadzone,
  });
  const rightMenu = useRadialMenu({
    point: rightFinger,
    center: rightCenter,
    slices: RIGHT_SLICES,
    deadzone: settings.deadzone,
  });

  const scaleNotes = SCALE_NOTES[settings.scale];
  const scaleLabels = SCALE_LABELS[settings.scale];

  const leftOuter =
    canAccidentalize &&
    leftMenu.selectedIndex !== null &&
    leftMenu.distance !== null &&
    leftMenu.distance >= accidentalThreshold;

  const baseSlot =
    leftMenu.selectedIndex !== null ? scaleNotes[leftMenu.selectedIndex] : null;
  const noteSlot = baseSlot ? applyAccidental(baseSlot, leftOuter) : null;

  const quality =
    rightMenu.selectedIndex !== null
      ? RIGHT_SLICE_TO_QUALITY[rightMenu.selectedIndex]
      : null;

  useEffect(() => {
    if (!engine) return;
    engine.setWaveform(settings.waveform);
  }, [engine, settings.waveform]);

  useEffect(() => {
    if (!engine || !audioUnlocked) return;
    if (noteSlot) {
      engine.playChord(noteSlot.note, quality, noteSlot.octave);
    } else {
      engine.release();
    }
  }, [engine, audioUnlocked, noteSlot?.note, noteSlot?.octave, quality]);

  const handleUnlock = async () => {
    if (!engine) return;
    await engine.resume();
    setAudioUnlocked(true);
  };

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[var(--color-bg)] text-neutral-200">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 h-full w-full scale-x-[-1] object-cover opacity-70"
      />

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/70" />
      <div className="pointer-events-none absolute inset-0 [background:radial-gradient(ellipse_at_center,transparent_40%,rgba(0,0,0,0.6)_100%)]" />

      <svg
        className="pointer-events-none absolute inset-0"
        width={viewport.width}
        height={viewport.height}
      >
        <RadialMenuViz
          center={leftCenter}
          radius={MENU_RADIUS}
          deadzone={settings.deadzone}
          slices={LEFT_SLICES}
          selectedIndex={leftMenu.selectedIndex}
          cursor={leftFinger}
          labels={scaleLabels}
          accent="sky"
          split={
            canAccidentalize
              ? {
                  threshold: accidentalThreshold,
                  outerLabels: SHARP_LABELS,
                  outerActive: leftOuter,
                }
              : undefined
          }
        />
        <RadialMenuViz
          center={rightCenter}
          radius={MENU_RADIUS}
          deadzone={settings.deadzone}
          slices={RIGHT_SLICES}
          selectedIndex={rightMenu.selectedIndex}
          cursor={rightFinger}
          labels={RIGHT_SLICE_TO_QUALITY.map(shortenQuality)}
          accent="emerald"
        />
      </svg>

      {!audioUnlocked && engine && (
        <button
          onClick={handleUnlock}
          className="pointer-events-auto absolute left-1/2 top-24 -translate-x-1/2 rounded-full border border-[var(--color-accent)] bg-black/70 px-6 py-3 text-xs font-semibold uppercase tracking-widest text-[var(--color-accent)] backdrop-blur-md transition hover:bg-[var(--color-accent)]/15"
        >
          Click to enable audio
        </button>
      )}

      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-6">
        <header className="pointer-events-auto flex items-start justify-between">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.3em] text-neutral-400">
              Synth Hand
            </p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight text-white">
              Computer Vision Synthesizer
            </h1>
          </div>
          <div className="flex flex-col items-end gap-2">
            <StatusPill status={status} />
            <button
              onClick={() => setSettingsOpen(true)}
              className="flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-black/50 px-3 py-1.5 text-xs font-medium tracking-wide text-neutral-200 backdrop-blur-md transition hover:bg-white/[.06]"
            >
              <GearIcon />
              Settings
            </button>
          </div>
        </header>

        <div className="pointer-events-none flex items-center justify-center">
          {status !== "ready" ? (
            <div className="rounded-2xl border border-[var(--color-border)] bg-black/50 px-6 py-4 backdrop-blur-md">
              <p className="text-sm text-neutral-300">
                {status === "loading" && "Carregando modelo de mãos…"}
                {status === "error" && (error ?? "Erro ao iniciar.")}
                {status === "idle" && "Inicializando…"}
              </p>
            </div>
          ) : noteSlot ? (
            <NowPlaying
              note={noteSlot.note}
              octave={noteSlot.octave}
              quality={quality}
              sharp={leftOuter}
              scale={settings.scale}
            />
          ) : null}
        </div>

        <footer className="pointer-events-auto grid grid-cols-2 gap-3">
          <HandCard
            label="Left Hand · Root"
            hand={left}
            slice={leftMenu.selectedIndex}
            sliceLabel={
              noteSlot
                ? `${noteSlot.note}${noteSlot.octave}${leftOuter ? " · ♯" : ""}`
                : null
            }
            accent="sky"
          />
          <HandCard
            label="Right Hand · Quality"
            hand={right}
            slice={rightMenu.selectedIndex}
            sliceLabel={quality ?? "Major (default)"}
            accent="emerald"
          />
        </footer>
      </div>

      {/* Overlay clicável que fecha o painel ao clicar fora */}
      {settingsOpen && (
        <div
          onClick={() => setSettingsOpen(false)}
          className="absolute inset-0 z-40 bg-black/30 backdrop-blur-[2px]"
        />
      )}

      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onChange={update}
        onReset={reset}
      />
    </main>
  );
}

/* ------------------------------------------------------------------ */
/*  Viewport                                                          */
/* ------------------------------------------------------------------ */

interface ViewportSize {
  width: number;
  height: number;
}

function useViewportSize(): ViewportSize {
  const [size, setSize] = useState<ViewportSize>(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));
  useEffect(() => {
    const onResize = () =>
      setSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return size;
}

function toPixels(
  p: { x: number; y: number } | null,
  v: ViewportSize,
): Point | null {
  if (!p) return null;
  return { x: p.x * v.width, y: p.y * v.height };
}

/* ------------------------------------------------------------------ */
/*  Radial menu (SVG)                                                 */
/* ------------------------------------------------------------------ */

interface SplitConfig {
  threshold: number;
  outerLabels: string[];
  outerActive: boolean;
}

interface RadialMenuVizProps {
  center: Point;
  radius: number;
  deadzone: number;
  slices: number;
  selectedIndex: number | null;
  cursor: Point | null;
  labels: string[];
  accent: Accent;
  split?: SplitConfig;
}

function RadialMenuViz({
  center,
  radius,
  deadzone,
  slices,
  selectedIndex,
  cursor,
  labels,
  accent,
  split,
}: RadialMenuVizProps) {
  const color = ACCENT_HEX[accent];
  const sliceSize = (Math.PI * 2) / slices;

  const singleLabelR = radius * 0.72;
  const innerLabelR = split ? (deadzone + split.threshold) / 2 : singleLabelR;
  const outerLabelR = split ? (split.threshold + radius) / 2 : singleLabelR;

  const highlightInnerR = split
    ? split.outerActive ? split.threshold : deadzone
    : deadzone;
  const highlightOuterR = split
    ? split.outerActive ? radius : split.threshold
    : radius;

  return (
    <g>
      <circle cx={center.x} cy={center.y} r={radius + 6} fill="rgba(0,0,0,0.45)" />

      <circle
        cx={center.x}
        cy={center.y}
        r={radius}
        fill="none"
        stroke={color}
        strokeOpacity={0.85}
        strokeWidth={2.5}
      />

      <circle
        cx={center.x}
        cy={center.y}
        r={deadzone}
        fill="none"
        stroke={color}
        strokeOpacity={0.85}
        strokeWidth={1.5}
        strokeDasharray="5 4"
      />

      {split && (
        <circle
          cx={center.x}
          cy={center.y}
          r={split.threshold}
          fill="none"
          stroke={color}
          strokeOpacity={0.55}
          strokeWidth={1}
          strokeDasharray="2 4"
        />
      )}

      {selectedIndex !== null && (
        <path
          d={annularSectorPath(
            center,
            highlightInnerR,
            highlightOuterR,
            selectedIndex,
            sliceSize,
          )}
          fill={color}
          fillOpacity={0.4}
          stroke={color}
          strokeOpacity={1}
          strokeWidth={2.5}
        />
      )}

      {Array.from({ length: slices }).map((_, i) => {
        const a = i * sliceSize - sliceSize / 2 - Math.PI / 2;
        const x1 = center.x + deadzone * Math.cos(a);
        const y1 = center.y + deadzone * Math.sin(a);
        const x2 = center.x + radius * Math.cos(a);
        const y2 = center.y + radius * Math.sin(a);
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={color}
            strokeOpacity={0.55}
            strokeWidth={1.5}
          />
        );
      })}

      {labels.map((label, i) => {
        const a = i * sliceSize - Math.PI / 2;
        const x = center.x + innerLabelR * Math.cos(a);
        const y = center.y + innerLabelR * Math.sin(a);
        const active = selectedIndex === i && !(split?.outerActive ?? false);
        return (
          <text
            key={`inner-${i}`}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="central"
            fill={active ? color : "#ffffff"}
            fillOpacity={active ? 1 : 0.85}
            stroke="rgba(0,0,0,0.75)"
            strokeWidth={3}
            paintOrder="stroke"
            fontSize={active ? 16 : 14}
            fontFamily="ui-monospace, SFMono-Regular, monospace"
            fontWeight={active ? 700 : 600}
          >
            {label}
          </text>
        );
      })}

      {split &&
        split.outerLabels.map((label, i) => {
          const a = i * sliceSize - Math.PI / 2;
          const x = center.x + outerLabelR * Math.cos(a);
          const y = center.y + outerLabelR * Math.sin(a);
          const active = selectedIndex === i && split.outerActive;
          return (
            <text
              key={`outer-${i}`}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="central"
              fill={active ? color : "#ffffff"}
              fillOpacity={active ? 1 : 0.6}
              stroke="rgba(0,0,0,0.75)"
              strokeWidth={3}
              paintOrder="stroke"
              fontSize={active ? 14 : 12}
              fontFamily="ui-monospace, SFMono-Regular, monospace"
              fontWeight={active ? 700 : 500}
            >
              {label}
            </text>
          );
        })}

      {cursor && (
        <>
          <circle cx={cursor.x} cy={cursor.y} r={14} fill={color} fillOpacity={0.25} />
          <circle
            cx={cursor.x}
            cy={cursor.y}
            r={7}
            fill={color}
            stroke="#000"
            strokeOpacity={0.4}
            strokeWidth={1.5}
          />
        </>
      )}
    </g>
  );
}

function annularSectorPath(
  center: Point,
  innerR: number,
  outerR: number,
  sliceIndex: number,
  sliceSize: number,
): string {
  const start = sliceIndex * sliceSize - sliceSize / 2 - Math.PI / 2;
  const end = sliceIndex * sliceSize + sliceSize / 2 - Math.PI / 2;
  const oStartX = center.x + outerR * Math.cos(start);
  const oStartY = center.y + outerR * Math.sin(start);
  const oEndX = center.x + outerR * Math.cos(end);
  const oEndY = center.y + outerR * Math.sin(end);
  const iStartX = center.x + innerR * Math.cos(start);
  const iStartY = center.y + innerR * Math.sin(start);
  const iEndX = center.x + innerR * Math.cos(end);
  const iEndY = center.y + innerR * Math.sin(end);
  return (
    `M ${iStartX} ${iStartY} ` +
    `L ${oStartX} ${oStartY} ` +
    `A ${outerR} ${outerR} 0 0 1 ${oEndX} ${oEndY} ` +
    `L ${iEndX} ${iEndY} ` +
    `A ${innerR} ${innerR} 0 0 0 ${iStartX} ${iStartY} Z`
  );
}

function shortenQuality(q: ChordQuality): string {
  switch (q) {
    case "Major": return "maj";
    case "Minor": return "min";
    case "Diminished": return "dim";
    case "Augmented": return "aug";
    case "Sus4": return "sus4";
    case "Major7": return "M7";
    case "Minor7": return "m7";
    case "Dominant7": return "7";
  }
}

/* ------------------------------------------------------------------ */
/*  HUD pieces                                                        */
/* ------------------------------------------------------------------ */

function GearIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function StatusPill({ status }: { status: TrackingStatus }) {
  const map: Record<TrackingStatus, { label: string; dot: string }> = {
    idle: { label: "Idle", dot: "bg-neutral-500" },
    loading: { label: "Loading", dot: "bg-amber-400 animate-pulse" },
    ready: { label: "Tracking", dot: "bg-[var(--color-accent)]" },
    error: { label: "Error", dot: "bg-red-500" },
  };
  const { label, dot } = map[status];
  return (
    <div className="flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-black/50 px-3 py-1.5 backdrop-blur-md">
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      <span className="text-xs font-medium tracking-wide text-neutral-200">{label}</span>
    </div>
  );
}

function NowPlaying({
  note,
  octave,
  quality,
  sharp,
  scale,
}: {
  note: Note;
  octave: number;
  quality: ChordQuality | null;
  sharp: boolean;
  scale: ScaleMode;
}) {
  return (
    <div className="rounded-2xl border border-[var(--color-accent)]/40 bg-black/60 px-8 py-5 backdrop-blur-md">
      <p className="text-[10px] uppercase tracking-[0.3em] text-neutral-400">
        Playing
        {sharp && <span className="ml-2 text-sky-400">· accidental</span>}
        {scale !== "diatonic" && (
          <span className="ml-2 text-emerald-400">· {scale} scale</span>
        )}
      </p>
      <p className="mt-1 text-4xl font-semibold text-white">
        {note}
        <span className="text-neutral-500">{octave}</span>{" "}
        <span className="text-[var(--color-accent)]">{quality ?? "Major"}</span>
        {quality === null && (
          <span className="ml-2 align-middle text-[10px] font-medium uppercase tracking-widest text-neutral-500">
            default
          </span>
        )}
      </p>
    </div>
  );
}

function HandCard({
  label,
  hand,
  slice,
  sliceLabel,
  accent,
}: {
  label: string;
  hand: HandData;
  slice: number | null;
  sliceLabel: string | null;
  accent: Accent;
}) {
  const active = hand.wrist !== null;
  const accentClass = accent === "sky" ? "text-sky-400" : "text-emerald-400";

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-black/40 p-4 backdrop-blur-md">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-neutral-400">
          {label}
        </p>
        <span
          className={`text-[10px] font-semibold uppercase tracking-widest ${active ? accentClass : "text-neutral-600"}`}
        >
          {active ? "detected" : "—"}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-3 font-mono text-sm">
        <Coord title="Wrist (0)" p={hand.wrist} />
        <Coord title="Index (8)" p={hand.indexTip} />
        <div>
          <p className="text-[10px] uppercase tracking-wider text-neutral-500">
            Slice
          </p>
          <p className={`text-lg font-semibold ${slice !== null ? accentClass : "text-neutral-600"}`}>
            {slice !== null ? `${slice} · ${sliceLabel}` : sliceLabel ?? "—"}
          </p>
        </div>
      </div>
    </div>
  );
}

function Coord({ title, p }: { title: string; p: { x: number; y: number } | null }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-neutral-500">{title}</p>
      <p className="text-white">
        x: <span className="text-neutral-300">{p ? p.x.toFixed(3) : "—"}</span>
      </p>
      <p className="text-white">
        y: <span className="text-neutral-300">{p ? p.y.toFixed(3) : "—"}</span>
      </p>
    </div>
  );
}
