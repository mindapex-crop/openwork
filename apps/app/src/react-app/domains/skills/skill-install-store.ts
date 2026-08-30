/**
 * 技能安装状态（WorkBuddy 技能页 "已安装 / 使用中" 对标）。
 *
 * 真实安装/卸载由 `@/app/lib/desktop` 桥接（仅桌面 + 有工作区时生效），本 store
 * 镜像一份到 localStorage，使 web/headless 也能稳定展示 "已安装"；两者取并集。
 * "使用中" 为近似态：当技能被应用到当前上下文时标记，非运行时真实 active 标志。
 */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export const SKILL_INSTALL_KEY = "openwork:skills:installed:v1";

export type InstalledSkill = { installedAt: string };

type SkillInstallState = {
  installed: Record<string, InstalledSkill>;
  inUse: string[];
  markInstalled: (name: string) => void;
  markUninstalled: (name: string) => void;
  markInUse: (name: string) => void;
  clearInUse: (name?: string) => void;
  isInstalled: (name: string) => boolean;
};

export const useSkillInstallStore = create<SkillInstallState>()(
  persist(
    (set, get) => ({
      installed: {},
      inUse: [],
      markInstalled: (name) =>
        set((state) =>
          state.installed[name]
            ? state
            : { installed: { ...state.installed, [name]: { installedAt: new Date().toISOString() } } },
        ),
      markUninstalled: (name) =>
        set((state) => {
          if (!state.installed[name]) return state;
          const next = { ...state.installed };
          delete next[name];
          return { installed: next, inUse: state.inUse.filter((x) => x !== name) };
        }),
      markInUse: (name) =>
        set((state) => (state.inUse.includes(name) ? state : { inUse: [...state.inUse, name] })),
      clearInUse: (name) =>
        set((state) => (name ? { inUse: state.inUse.filter((x) => x !== name) } : { inUse: [] })),
      isInstalled: (name) => Boolean(get().installed[name]),
    }),
    {
      name: SKILL_INSTALL_KEY,
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

/** Union of the desktop-bridge result and the localStorage mirror. */
export function mergedInstalledNames(bridgeNames: Iterable<string>): Set<string> {
  const merged = new Set<string>(bridgeNames);
  for (const name of Object.keys(useSkillInstallStore.getState().installed)) merged.add(name);
  return merged;
}
