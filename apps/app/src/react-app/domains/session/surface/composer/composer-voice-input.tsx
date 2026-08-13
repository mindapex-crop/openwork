/** @jsxImportSource react */
import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";
import { registerComposerAction, type ComposerContributionContext } from "./composer-contributions";

/** Minimal structural types for the Web Speech API. */
type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    length: number;
    [index: number]: { transcript: string };
  }>;
};
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function getRecognitionConstructor(): SpeechRecognitionConstructor | null {
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  if (typeof w.SpeechRecognition === "function") return w.SpeechRecognition;
  if (typeof w.webkitSpeechRecognition === "function") return w.webkitSpeechRecognition;
  return null;
}

let lastVoiceErrorAt = 0;
function showVoiceError() {
  // Avoid spamming toasts if the recognizer errors repeatedly.
  const now = Date.now();
  if (now - lastVoiceErrorAt < 4000) return;
  lastVoiceErrorAt = now;
  toast.error(t("composer.voice_input_error"));
}

function VoiceInputButton({ ctx }: { ctx: ComposerContributionContext }) {
  const [supported] = useState(() => getRecognitionConstructor() !== null);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const baseDraftRef = useRef("");
  const finalTranscriptRef = useRef("");
  const interimTranscriptRef = useRef("");

  const updateDraft = useCallback(() => {
    const interim = interimTranscriptRef.current.trim();
    const transcript = finalTranscriptRef.current + (interim ? ` ${interim}` : "");
    ctx.setDraft(baseDraftRef.current + transcript);
  }, [ctx]);

  const stopListening = useCallback(() => {
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    recognition?.abort();
    finalTranscriptRef.current = "";
    interimTranscriptRef.current = "";
    setListening(false);
  }, []);

  const startListening = useCallback(() => {
    const Ctor = getRecognitionConstructor();
    if (!Ctor) return;
    const recognition = new Ctor();
    recognition.lang = navigator.language || "en-US";
    // One utterance per run: after a natural pause the recognizer ends and
    // the result is committed to the draft automatically.
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    baseDraftRef.current = ctx.draft;
    finalTranscriptRef.current = "";
    interimTranscriptRef.current = "";

    recognition.onresult = (event) => {
      interimTranscriptRef.current = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0]?.transcript ?? "";
        if (result.isFinal) finalTranscriptRef.current += transcript;
        else interimTranscriptRef.current += transcript;
      }
      updateDraft();
    };

    recognition.onerror = (event) => {
      // no-speech is the normal "user stayed silent" path — stop quietly.
      if (event.error !== "no-speech" && event.error !== "aborted") showVoiceError();
      stopListening();
    };

    recognition.onend = () => {
      stopListening();
    };

    recognitionRef.current = recognition;
    setListening(true);
    try {
      recognition.start();
    } catch {
      // start() can throw if a recognizer is already running.
      stopListening();
    }
  }, [ctx.draft, stopListening, updateDraft]);

  // Always stop the recognizer when the component unmounts.
  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, []);

  if (!supported) return null;

  const micDisabled = ctx.disabled || ctx.busy;

  return (
    <button
      type="button"
      aria-label={listening ? t("composer.voice_input_listening") : t("composer.voice_input")}
      title={listening ? t("composer.voice_input_listening") : t("composer.voice_input")}
      aria-pressed={listening}
      disabled={micDisabled}
      onClick={() => {
        if (listening) stopListening();
        else startListening();
      }}
      className={cn(
        "relative inline-flex h-9 max-h-9 w-9 items-center justify-center rounded-md transition-colors",
        listening ? "bg-gray-3 text-red-11" : "text-gray-10 hover:bg-gray-3",
        micDisabled && "cursor-not-allowed opacity-60",
      )}
    >
      {listening ? (
        <>
          <span className="absolute inline-flex h-8 w-8 animate-ping rounded-full bg-red-9/20" />
          <Square size={12} fill="currentColor" />
        </>
      ) : (
        <Mic size={16} />
      )}
    </button>
  );
}


