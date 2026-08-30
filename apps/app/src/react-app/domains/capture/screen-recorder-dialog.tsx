/** @jsxImportSource react */
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { t } from "@/i18n";

import { ScreenRecorder } from "./screen-recorder";

export type ScreenRecorderDialogProps = {
  open: boolean;
  onClose: () => void;
  /** Receives the finished recording; the caller decides where the bytes go. */
  onSave: (blob: Blob) => void;
};

/** Hosts the recorder in a dialog so a capture flow can sit on any surface without owning its state. */
export function ScreenRecorderDialog(props: ScreenRecorderDialogProps) {
  return (
    <Dialog
      open={props.open}
      onOpenChange={(open) => {
        if (!open) props.onClose();
      }}
    >
      <DialogContent className="flex max-h-[calc(100vh-2rem)] min-h-0 w-full max-w-2xl flex-col overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("screen_recorder.select_screen")}</DialogTitle>
        </DialogHeader>
        <ScreenRecorder
          onSave={(blob) => {
            props.onSave(blob);
            props.onClose();
          }}
          onCancel={props.onClose}
        />
      </DialogContent>
    </Dialog>
  );
}
