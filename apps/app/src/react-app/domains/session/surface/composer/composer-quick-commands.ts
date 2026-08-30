/** @jsxImportSource react */
import { create } from "zustand";

import { CircleDot, Globe, RotateCw, Eye } from "lucide-react";

import { t } from "@/i18n";

export type QuickCommandMode = "loop" | "watch" | "site" | "record";

export interface QuickCommandDefinition {
  id: QuickCommandMode;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
  shortcut: string;
}

export const QUICK_COMMAND_DEFINITIONS: readonly QuickCommandDefinition[] = [
  { id: "loop", labelKey: "quick_cmd.loop", icon: RotateCw, shortcut: "\u2318L" },
  { id: "watch", labelKey: "quick_cmd.watch", icon: Eye, shortcut: "\u2318W" },
  { id: "site", labelKey: "quick_cmd.site", icon: Globe, shortcut: "\u2318S" },
  { id: "record", labelKey: "quick_cmd.record", icon: CircleDot, shortcut: "\u2318R" },
] as const;

type QuickCommandsStoreState = {
  active: Record<QuickCommandMode, boolean>;
  toggle: (mode: QuickCommandMode) => void;
  isActive: (mode: QuickCommandMode) => boolean;
};

export const useQuickCommandsStore = create<QuickCommandsStoreState>((set, get) => ({
  active: { loop: false, watch: false, site: false, record: false },

  toggle: (mode) => {
    set((state) => ({
      active: { ...state.active, [mode]: !state.active[mode] },
    }));
  },

  isActive: (mode) => get().active[mode],
}));

/** Pure function: append mode-specific prompt suffixes (same pattern as task-mode.ts frameTaskPrompt). */
export function appendQuickCommandSuffixes(rawPrompt: string, active: Record<QuickCommandMode, boolean>): string {
  const trimmed = rawPrompt.trimEnd();
  let result = trimmed;

  const pushSuffix = (suffix: string) => {
    result = `${result}\n\n${suffix}`;
  };

  if (active.loop) {
    pushSuffix(t("quick_cmd.loop_suffix"));
  }
  if (active.watch) {
    pushSuffix(t("quick_cmd.watch_suffix"));
  }
  if (active.site) {
    pushSuffix(t("quick_cmd.site_suffix"));
  }
  if (active.record) {
    pushSuffix(t("quick_cmd.record_suffix"));
  }

  return result;
}
