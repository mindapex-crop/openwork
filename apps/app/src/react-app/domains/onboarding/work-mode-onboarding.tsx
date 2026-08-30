/** @jsxImportSource react */
import { useEffect, useState } from "react";
import { useLocation } from "react-router";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { t } from "@/i18n";

import { writeWorkMode, WORK_MODE_KEY, type WorkMode } from "./work-mode";
import { WorkModeStep } from "./work-mode-step";

const ONBOARDING_EXCLUDED_PATHS = ["/welcome", "/signin", "/onboarding"];

/**
 * 首启三模式引导：首次进入主界面且尚未选择工作模式时弹出选择
 * （日常办公 / 代码开发 / 设计创意），选择结果存 localStorage。
 */
export function WorkModeOnboarding() {
  const location = useLocation();
  const [open, setOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(WORK_MODE_KEY) === null;
    } catch {
      return false;
    }
  });

  // 首启引导只在主界面出现（welcome/signin/onboarding 由各自流程接管）。
  useEffect(() => {
    if (!open) return;
    const path = location.pathname;
    if (ONBOARDING_EXCLUDED_PATHS.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
      setOpen(false);
    }
  }, [location.pathname, open]);

  if (!open) return null;

  const handleSelect = (mode: WorkMode) => {
    writeWorkMode(mode);
    setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setOpen(false);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("work_mode.onboarding_title")}</DialogTitle>
          <DialogDescription>{t("work_mode.onboarding_subtitle")}</DialogDescription>
        </DialogHeader>
        <WorkModeStep onSelect={handleSelect} />
      </DialogContent>
    </Dialog>
  );
}
