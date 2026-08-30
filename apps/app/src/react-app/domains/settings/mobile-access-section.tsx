/** @jsxImportSource react */
import { useEffect, useState } from "react";
import { Smartphone, X } from "lucide-react";

import { t } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  LayoutSection,
  LayoutSectionDescription,
  LayoutSectionHeader,
  LayoutSectionItem,
  LayoutSectionItemDescription,
  LayoutSectionItemHeader,
  LayoutSectionItemHeaderActions,
  LayoutSectionItemTitle,
  LayoutSectionTitle,
} from "./settings-layout";
import { useFeatureFlagsPreferences } from "./state/feature-flags-preferences";
import { useDeviceStore } from "@/react-app/domains/devices/device-store";

const CONTROL_POLL_INTERVAL_MS = 3_000;

function platformLabel(platform: string): string {
  switch (platform) {
    case "ios":
      return "iOS";
    case "android":
      return "Android";
    case "web":
      return "Web";
    case "desktop":
      return "Desktop";
    default:
      return platform;
  }
}

function formatRelativeTime(timestamp: number | null): string {
  if (!timestamp) return t("devices.never_seen");
  const diff = Date.now() - timestamp;
  if (diff < 60_000) return t("devices.just_now");
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return t("devices.minutes_ago", { count: minutes });
  const hours = Math.floor(minutes / 60);
  return t("devices.hours_ago", { count: hours });
}

export function MobileAccessSection() {
  const { mobileAccessEnabled, toggleMobileAccess } = useFeatureFlagsPreferences();
  const {
    devices,
    pairCode,
    pairCodeExpiresInSeconds,
    loading,
    error,
    fetchDevices,
    issuePairCode,
    revokeDevice,
    pollControlCommands,
  } = useDeviceStore();

  const [showPairCode, setShowPairCode] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (mobileAccessEnabled) {
      fetchDevices();
      const interval = setInterval(() => {
        fetchDevices();
        pollControlCommands();
      }, CONTROL_POLL_INTERVAL_MS);
      return () => clearInterval(interval);
    }
  }, [mobileAccessEnabled, fetchDevices, pollControlCommands]);

  useEffect(() => {
    if (showPairCode && pairCodeExpiresInSeconds > 0) {
      setCountdown(pairCodeExpiresInSeconds);
      const interval = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            setShowPairCode(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [showPairCode, pairCodeExpiresInSeconds]);

  async function handleGeneratePairCode() {
    await issuePairCode();
    setShowPairCode(true);
  }

  if (!mobileAccessEnabled) {
    return (
      <LayoutSection>
        <LayoutSectionHeader>
          <LayoutSectionTitle>{t("devices.section_title")}</LayoutSectionTitle>
          <LayoutSectionDescription>{t("devices.section_desc")}</LayoutSectionDescription>
        </LayoutSectionHeader>
        <LayoutSectionItem>
          <LayoutSectionItemHeader>
            <LayoutSectionItemTitle>{t("devices.allow_mobile")}</LayoutSectionItemTitle>
            <LayoutSectionItemDescription>{t("devices.allow_mobile_desc")}</LayoutSectionItemDescription>
            <LayoutSectionItemHeaderActions>
              <Switch
                aria-label={t("devices.allow_mobile")}
                checked={mobileAccessEnabled}
                onCheckedChange={toggleMobileAccess}
              />
            </LayoutSectionItemHeaderActions>
          </LayoutSectionItemHeader>
        </LayoutSectionItem>
      </LayoutSection>
    );
  }

  return (
    <LayoutSection>
      <LayoutSectionHeader>
        <LayoutSectionTitle>{t("devices.section_title")}</LayoutSectionTitle>
        <LayoutSectionDescription>{t("devices.section_desc")}</LayoutSectionDescription>
      </LayoutSectionHeader>

      <LayoutSectionItem>
        <LayoutSectionItemHeader>
          <LayoutSectionItemTitle>{t("devices.allow_mobile")}</LayoutSectionItemTitle>
          <LayoutSectionItemDescription>{t("devices.allow_mobile_desc")}</LayoutSectionItemDescription>
          <LayoutSectionItemHeaderActions>
            <Switch
              aria-label={t("devices.allow_mobile")}
              checked={mobileAccessEnabled}
              onCheckedChange={toggleMobileAccess}
            />
          </LayoutSectionItemHeaderActions>
        </LayoutSectionItemHeader>
      </LayoutSectionItem>

      <LayoutSectionItem>
        <LayoutSectionItemHeader>
          <LayoutSectionItemTitle>{t("devices.pair_new_device")}</LayoutSectionItemTitle>
          <LayoutSectionItemDescription>{t("devices.pair_new_device_desc")}</LayoutSectionItemDescription>
          <LayoutSectionItemHeaderActions>
            <Button
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={handleGeneratePairCode}
            >
              <Smartphone className="size-4" />
              {t("devices.generate_pair_code")}
            </Button>
          </LayoutSectionItemHeaderActions>
        </LayoutSectionItemHeader>
        {showPairCode && pairCode ? (
          <div className="flex flex-col gap-2 px-4 pb-4">
            <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3">
              <span className="font-mono text-2xl font-bold tracking-[0.3em] text-foreground">
                {pairCode}
              </span>
              <span className="text-sm text-muted-foreground">
                {t("devices.expires_in", { seconds: countdown })}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {t("devices.pair_code_hint")}
            </p>
          </div>
        ) : null}
        {error ? (
          <p className="px-4 pb-2 text-sm text-destructive">{error}</p>
        ) : null}
      </LayoutSectionItem>

      {devices.length > 0 ? (
        <LayoutSectionItem>
          <LayoutSectionItemHeader>
            <LayoutSectionItemTitle>{t("devices.paired_devices")}</LayoutSectionItemTitle>
            <LayoutSectionItemDescription>
              {t("devices.paired_count", { count: devices.length })}
            </LayoutSectionItemDescription>
          </LayoutSectionItemHeader>
          <div className="flex flex-col gap-1 px-4 pb-4">
            {devices.map((device) => (
              <div
                key={device.deviceId}
                className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
              >
                <div className="flex items-center gap-3">
                  <Smartphone className="size-4 text-muted-foreground" />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-foreground">{device.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {platformLabel(device.platform)} · {formatRelativeTime(device.lastSeenAt)}
                      {device.remoteControlActive ? ` · ${t("devices.remote_active")}` : ""}
                    </span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("devices.revoke", { name: device.name })}
                  onClick={() => revokeDevice(device.deviceId)}
                >
                  <X className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        </LayoutSectionItem>
      ) : null}
    </LayoutSection>
  );
}