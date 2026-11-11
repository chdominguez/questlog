import { useCallback, useEffect, useRef, useState } from "react";

// Minimal Web Speech API typing (not in lib.dom).
interface SpeechResult { isFinal: boolean; 0: { transcript: string } }
interface SpeechEvent { resultIndex: number; results: ArrayLike<SpeechResult> }
interface Recognition {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((e: SpeechEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void; stop(): void; abort(): void;
}
type RecognitionCtor = new () => Recognition;

const Ctor: RecognitionCtor | undefined =
  typeof window === "undefined" ? undefined : (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;

const ERRORS: Record<string, string> = {
  "not-allowed": "Microphone blocked",
  "service-not-allowed": "Microphone blocked",
  "audio-capture": "No microphone",
  network: "Dictation offline",
  "no-speech": "No speech heard",
};

const FATAL = new Set(["not-allowed", "service-not-allowed", "audio-capture"]);
const RESTART_WINDOW_MS = 2000;
const MAX_RESTARTS = 3;

/** Chrome ends continuous sessions on its own (silence, network, ~1 min). Restart unless the user stopped or it keeps failing. */
export function shouldRestart(wanted: boolean, lastError: string, restarts: number[], now: number): boolean {
  if (!wanted || FATAL.has(lastError)) return false;
  return restarts.filter((t) => now - t < RESTART_WINDOW_MS).length < MAX_RESTARTS;
}

/** Web Speech dictation in es-ES. `onFinal` gets each final chunk; `interim` is the live partial text. */
export function useDictation(onFinal: (text: string) => void, lang = "en-US") {
  const [recording, setRecording] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState("");
  const rec = useRef<Recognition | null>(null);
  const wanted = useRef(false);
  const restarts = useRef<number[]>([]);
  const finalRef = useRef(onFinal);
  finalRef.current = onFinal;

  useEffect(() => () => { wanted.current = false; rec.current?.abort(); }, []);
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(""), 4000);
    return () => clearTimeout(t);
  }, [error]);

  const begin = useCallback(() => {
    if (!Ctor || rec.current) return;
    const r = new Ctor();
    let lastError = "";
    r.lang = lang;
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e) => {
      let partial = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finalRef.current(res[0].transcript);
        else partial += res[0].transcript;
      }
      setInterim(partial);
    };
    r.onerror = (e) => {
      lastError = e.error;
      if (e.error === "aborted" || (e.error === "no-speech" && wanted.current)) return;
      setError(ERRORS[e.error] ?? "Dictation failed");
    };
    r.onend = () => {
      rec.current = null;
      setInterim("");
      const now = Date.now();
      if (shouldRestart(wanted.current, lastError, restarts.current, now)) {
        restarts.current = [...restarts.current.filter((t) => now - t < RESTART_WINDOW_MS), now];
        begin();
      } else {
        wanted.current = false;
        setRecording(false);
      }
    };
    try {
      r.start();
      rec.current = r;
      setRecording(true);
    } catch {
      wanted.current = false;
      setRecording(false);
      setError("Dictation failed");
    }
  }, []);

  const start = useCallback(() => {
    wanted.current = true;
    restarts.current = [];
    setError("");
    begin();
  }, [begin]);
  const stop = useCallback(() => { wanted.current = false; rec.current?.stop(); }, []);

  return { supported: Boolean(Ctor), recording, interim, error, start, stop };
}
