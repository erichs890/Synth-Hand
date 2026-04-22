import { useEffect, useRef, useState } from "react";
import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";

export interface Landmark {
  x: number; // 0..1, já espelhado p/ bater com a UI
  y: number; // 0..1
}

export interface HandData {
  wrist: Landmark | null; // landmark 0
  indexTip: Landmark | null; // landmark 8
}

export type TrackingStatus = "idle" | "loading" | "ready" | "error";

export interface UseHandTrackingResult {
  videoRef: React.RefObject<HTMLVideoElement>;
  status: TrackingStatus;
  error: string | null;
  left: HandData;
  right: HandData;
}

const EMPTY_HAND: HandData = { wrist: null, indexTip: null };

const WASM_CDN =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

export function useHandTracking(): UseHandTrackingResult {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<TrackingStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [left, setLeft] = useState<HandData>(EMPTY_HAND);
  const [right, setRight] = useState<HandData>(EMPTY_HAND);

  useEffect(() => {
    let cancelled = false;
    let rafId = 0;
    let stream: MediaStream | null = null;
    let landmarker: HandLandmarker | null = null;
    let lastVideoTime = -1;

    async function init() {
      const video = videoRef.current;
      if (!video) {
        setStatus("error");
        setError("videoRef não está anexado a um elemento <video>.");
        return;
      }

      setStatus("loading");

      try {
        // 1) Câmera
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720, facingMode: "user" },
          audio: false,
        });
        if (cancelled) return;

        video.srcObject = stream;
        video.playsInline = true;
        video.muted = true;
        await video.play();

        // 2) Fileset WASM + modelo .task
        const fileset = await FilesetResolver.forVisionTasks(WASM_CDN);
        if (cancelled) return;

        landmarker = await HandLandmarker.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath: MODEL_URL,
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numHands: 2,
        });
        if (cancelled) return;

        setStatus("ready");

        // 3) Loop rAF
        const tick = () => {
          if (cancelled || !landmarker || !video) return;

          // Só processa frame novo (evita trabalho redundante quando o vídeo
          // não avançou entre frames do rAF).
          if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
            lastVideoTime = video.currentTime;

            const result = landmarker.detectForVideo(video, performance.now());

            let nextLeft: HandData = EMPTY_HAND;
            let nextRight: HandData = EMPTY_HAND;

            const hands = result.landmarks ?? [];
            const handedness = result.handedness ?? [];

            for (let i = 0; i < hands.length; i++) {
              const lm = hands[i];
              const label = handedness[i]?.[0]?.categoryName;
              const wrist = lm[0];
              const index = lm[8];

              // Espelha X pra casar com o vídeo exibido com scale-x-[-1].
              const data: HandData = {
                wrist: { x: 1 - wrist.x, y: wrist.y },
                indexTip: { x: 1 - index.x, y: index.y },
              };

              // Handedness já vem da perspectiva do usuário (confirmado
              // empiricamente no tasks-vision 0.10.x).
              if (label === "Left") nextLeft = data;
              else if (label === "Right") nextRight = data;
            }

            setLeft(nextLeft);
            setRight(nextRight);
          }

          rafId = requestAnimationFrame(tick);
        };

        rafId = requestAnimationFrame(tick);
      } catch (err) {
        if (cancelled) return;
        setStatus("error");
        setError(
          err instanceof Error
            ? err.message
            : "Falha ao inicializar hand tracking.",
        );
      }
    }

    init();

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      landmarker?.close();
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return { videoRef, status, error, left, right };
}
