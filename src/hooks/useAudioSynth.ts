import { useEffect, useState } from "react";
import { AudioSynthEngine } from "../audio/AudioSynthEngine";

/**
 * Cria o `AudioSynthEngine` após mount. Retorna `null` no primeiro render —
 * isso é intencional: instancing dentro de `useEffect` evita vazar um
 * `AudioContext` extra no Strict Mode (dev double-invoke).
 */
export function useAudioSynth(): AudioSynthEngine | null {
  const [engine, setEngine] = useState<AudioSynthEngine | null>(null);

  useEffect(() => {
    const e = new AudioSynthEngine();
    setEngine(e);
    return () => e.dispose();
  }, []);

  return engine;
}
