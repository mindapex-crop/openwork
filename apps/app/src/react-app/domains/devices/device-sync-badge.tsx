/** @jsxImportSource react */
import { useEffect } from "react";
import { Smartphone } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { t } from "@/i18n";

import { useDeviceStore } from "./device-store";

export function DeviceSyncBadge() {
  const devices = useDeviceStore((state) => state.devices);
  const fetchDevices = useDeviceStore((state) => state.fetchDevices);
  const loading = useDeviceStore((state) => state.loading);

  useEffect(() => {
    void fetchDevices();
  }, [fetchDevices]);

  const activeDevices = devices.filter((d) => d.active);
  const lastSeen = devices
    .filter((d) => d.lastSeenAt)
    .sort((a, b) => ((a.lastSeenAt ?? "") < (b.lastSeenAt ?? "") ? 1 : -1))[0];

  if (loading && devices.length === 0) {
    return null;
  }

  return (
    <Badge variant="outline" className="gap-1 text-[10px]">
      <Smartphone size={10} />
      {activeDevices.length > 0
        ? t("devices.synced_count", { count: String(activeDevices.length) })
        : t("devices.not_synced")}
      {lastSeen?.lastSeenAt ? (
        <span className="text-muted-foreground">
          {" · "}
          {t("devices.last_seen", { time: new Date(lastSeen.lastSeenAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) })}
        </span>
      ) : null}
    </Badge>
  );
}
