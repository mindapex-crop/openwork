/** @jsxImportSource react */
import { useCallback, useEffect, useRef, useState } from "react";

interface SpeechSynthesisUtteranceLike {
  text: string;
  rate: number;
  pitch: number;
  volume: number;
  onend: (() => void) | null;
  onerror: ((event: unknown) => void) | null;
}

interface SpeechSynthesisLike {
  speak: (utterance: SpeechSynthesisUtteranceLike) => void;
  cancel: () => void;
  getVoices: () => { lang: string; name: string }[];
}

function getSynthesis(): SpeechSynthesisLike | null {
  if (typeof window === "undefined") return null;
  return (window.speechSynthesis as unknown as SpeechSynthesisLike) ?? null;
}

export interface UseTextToSpeechResult {
  speaking: boolean;
  speak: (text: string, lang?: string) => void;
  stop: () => void;
  supported: boolean;
}

export function useTextToSpeech(): UseTextToSpeechResult {
  const [speaking, setSpeaking] = useState(false);
  const supported = getSynthesis() !== null;
  const currentUtterance = useRef<SpeechSynthesisUtteranceLike | null>(null);

  const stop = useCallback(() => {
    const synth = getSynthesis();
    if (!synth) return;
    synth.cancel();
    setSpeaking(false);
    currentUtterance.current = null;
  }, []);

  const speak = useCallback((text: string, lang?: string) => {
    const synth = getSynthesis();
    if (!synth) return;
    synth.cancel();

    const utterance: SpeechSynthesisUtteranceLike = {
      text,
      rate: 1.0,
      pitch: 1.0,
      volume: 1.0,
      onend: () => {
        setSpeaking(false);
        currentUtterance.current = null;
      },
      onerror: () => {
        setSpeaking(false);
        currentUtterance.current = null;
      },
    };

    if (lang) {
      const voices = synth.getVoices();
      const match = voices.find((v) => v.lang.startsWith(lang));
      if (match) {
        (utterance as unknown as Record<string, unknown>).voice = match;
        (utterance as unknown as Record<string, unknown>).lang = match.lang;
      }
    }

    currentUtterance.current = utterance;
    setSpeaking(true);
    synth.speak(utterance);
  }, []);

  useEffect(() => {
    return () => {
      const synth = getSynthesis();
      synth?.cancel();
    };
  }, []);

  return { speaking, speak, stop, supported };
}