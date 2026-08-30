/** @jsxImportSource react */
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/sonner";
import { Mic, MicOff, Video, Square, Download, X, CircleDot } from "lucide-react";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";

import { isScreenRecordingSupported, recordingFileName } from "./recording-file";

export interface ScreenRecorderProps {
  onSave?: (blob: Blob) => void;
  onCancel?: () => void;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function ScreenRecorder({ onSave, onCancel }: ScreenRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  const [duration, setDuration] = useState(0);
  const [includeAudio, setIncludeAudio] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const timerRef = useRef<number | null>(null);

  // Set video srcObject when stream changes
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [stream, previewUrl]);

  const startRecording = useCallback(async () => {
    try {
      setError(null);

      // Check for browser support
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        throw new Error(t("screen_recorder.error_starting"));
      }

      const mediaStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: includeAudio,
      });

      setStream(mediaStream);

      // Create MediaRecorder
      const recorder = new MediaRecorder(mediaStream, {
        mimeType: "video/webm;codecs=vp9",
      });

      const chunks: Blob[] = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: "video/webm" });
        setRecordedChunks(chunks);
        setPreviewUrl(URL.createObjectURL(blob));

        // Stop all tracks
        mediaStream.getTracks().forEach((track) => track.stop());
        setStream(null);

        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      };

      recorder.onerror = () => {
        setError(t("screen_recorder.error_starting"));
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      setDuration(0);

      // Start timer
      timerRef.current = window.setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        setError(t("screen_recorder.permission_denied"));
        toast.error(t("screen_recorder.permission_denied"));
      } else {
        const message =
          err instanceof Error ? err.message : t("screen_recorder.error_starting");
        setError(message);
        toast.error(message);
      }
    }
  }, [includeAudio]);

  const stopRecording = useCallback(() => {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    }
    setIsRecording(false);
  }, [mediaRecorder]);

  const saveRecording = useCallback(() => {
    if (recordedChunks.length === 0) return;

    const blob = new Blob(recordedChunks, { type: "video/webm" });

    if (onSave) {
      onSave(blob);
    } else {
      // Trigger download
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = recordingFileName();
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }, [recordedChunks, onSave]);

  const handleCancel = useCallback(() => {
    if (isRecording) {
      stopRecording();
    }
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    onCancel?.();
  }, [isRecording, stream, previewUrl, stopRecording, onCancel]);

  const resetRecording = useCallback(() => {
    setRecordedChunks([]);
    setPreviewUrl(null);
    setDuration(0);
    setError(null);
  }, []);

  // Browser compatibility check
  const isSupported = isScreenRecordingSupported(navigator);

  if (!isSupported) {
    return (
      <Card className="w-full max-w-2xl">
        <CardContent className="p-6">
          <div className="text-center text-destructive">
            <p>{t("screen_recorder.error_starting")}</p>
            <p className="text-sm mt-2 text-muted-foreground">
              Your browser does not support screen recording.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Video className="h-5 w-5" />
            {t("screen_recorder.select_screen")}
          </CardTitle>
          {onCancel && (
            <Button variant="ghost" size="icon" onClick={handleCancel}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Audio toggle */}
        {!isRecording && recordedChunks.length === 0 && (
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-3">
              {includeAudio ? (
                <Mic className="h-4 w-4 text-primary" />
              ) : (
                <MicOff className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="text-sm font-medium">
                {t("screen_recorder.include_audio")}
              </span>
            </div>
            <Switch
              checked={includeAudio}
              onCheckedChange={setIncludeAudio}
              aria-label={t("screen_recorder.include_audio")}
            />
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Recording state */}
        {isRecording && (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-primary/10 rounded-lg border border-primary/20">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="h-3 w-3 bg-red-500 rounded-full animate-pulse" />
                </div>
                <span className="font-medium">{t("screen_recorder.recording")}</span>
              </div>
              <div className="font-mono text-lg">{formatDuration(duration)}</div>
            </div>

            {/* Live preview */}
            {stream && (
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="w-full rounded-lg border bg-black"
                style={{ maxHeight: "400px" }}
              >
                <source src="" type="video/webm" />
              </video>
            )}

            <div className="flex justify-center">
              <Button
                variant="destructive"
                size="lg"
                onClick={stopRecording}
                className="gap-2"
              >
                <Square className="h-4 w-4 fill-current" />
                {t("screen_recorder.stop")}
              </Button>
            </div>
          </div>
        )}

        {/* Not recording and no preview */}
        {!isRecording && recordedChunks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Video className="h-16 w-16 text-muted-foreground/50" />
            <p className="text-muted-foreground text-center max-w-md">
              {t("screen_recorder.select_screen")}
            </p>
            <Button onClick={startRecording} size="lg" className="gap-2">
              <CircleDot className="h-4 w-4" />
              {t("screen_recorder.start")}
            </Button>
          </div>
        )}

        {/* Preview after recording */}
        {!isRecording && recordedChunks.length > 0 && previewUrl && (
          <div className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <Video className="h-4 w-4" />
                {t("screen_recorder.preview")}
              </h3>
              <video
                ref={videoRef}
                controls
                src={previewUrl}
                className="w-full rounded-lg border bg-black"
                style={{ maxHeight: "400px" }}
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <span className="text-sm font-medium">
                {t("screen_recorder.duration")}
              </span>
              <span className="font-mono">{formatDuration(duration)}</span>
            </div>

            <div className="flex gap-2">
              <Button onClick={saveRecording} className="flex-1 gap-2">
                <Download className="h-4 w-4" />
                {t("screen_recorder.save")}
              </Button>
              <Button variant="outline" onClick={resetRecording} className="gap-2">
                <X className="h-4 w-4" />
                {t("screen_recorder.cancel")}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
