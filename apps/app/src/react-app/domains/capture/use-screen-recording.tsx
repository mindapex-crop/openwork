/** @jsxImportSource react */
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { t } from "@/i18n";

import { recordingFile } from "./recording-file";
import { ScreenRecorderDialog } from "./screen-recorder-dialog";

/**
 * Owns the recorder dialog and turns a finished capture into a composer
 * attachment, so every surface that hosts recording shares one sink.
 */
export function useScreenRecording(attachFiles: (files: File[]) => void) {
  const [open, setOpen] = useState(false);

  const handleSaved = useCallback((blob: Blob) => {
    const file = recordingFile(blob);
    // A capture stopped in the same tick as it started yields an empty blob;
    // attaching that would only put junk in the workspace.
    if (file.size === 0) {
      setOpen(false);
      return;
    }
    attachFiles([file]);
    toast.success(t("screen_recorder.attached", { name: file.name }));
    setOpen(false);
  }, [attachFiles]);

  const dialog = useMemo(() => open ? (
    <ScreenRecorderDialog open onClose={() => setOpen(false)} onSave={handleSaved} />
  ) : null, [handleSaved, open]);

  return { openRecorder: () => setOpen(true), dialog };
}
