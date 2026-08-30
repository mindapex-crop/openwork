/** @jsxImportSource react */
import { useEffect } from "react";
import { Lock } from "lucide-react";

import { t } from "@/i18n";
import { Button } from "@/components/ui/button";
import { useDeviceStore } from "@/react-app/domains/devices/device-store";

/**
 * 远程锁定遮罩：当移动端下发 lock 指令时覆盖整个应用，
 * 阻止桌面端本地操作，直到移动端下发 unlock 或桌面端手动解锁。
 */
export function RemoteLockOverlay() {
  const { locked, activeControlCommand, ackCommand, setLocked } = useDeviceStore();

  useEffect(() => {
    if (!locked || !activeControlCommand) return;
    void ackCommand(activeControlCommand.commandId, "executed");
  }, [locked, activeControlCommand, ackCommand]);

  if (!locked) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/95 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-6">
        <div className="flex size-20 items-center justify-center rounded-full border-2 border-border bg-muted/30">
          <Lock className="size-10 text-muted-foreground" />
        </div>
        <div className="flex flex-col items-center gap-2">
          <h2 className="text-xl font-semibold text-foreground">
            {t("devices.locked_title")}
          </h2>
          <p className="max-w-md text-center text-sm text-muted-foreground">
            {t("devices.locked_desc")}
          </p>
        </div>
        <Button variant="outline" onClick={() => setLocked(false)}>
          {t("devices.unlock_locally")}
        </Button>
      </div>
    </div>
  );
}