/** @jsxImportSource react */
import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * 权限模式（WorkBuddy "权限管理：默认权限 / 完全访问" 对标）。
 *
 * - "manual"（默认权限）：敏感操作（文件修改、命令执行等）仍需用户在
 *   PermissionApprovalPanel 中逐次确认。
 * - "full"（完全访问）：会话收到的权限请求自动以 "always" 应答，减少确认
 *   步骤；仅在用户信任当前任务时建议开启。
 */
export type PermissionMode = "manual" | "full";

type PermissionModeState = {
  mode: PermissionMode;
  setMode: (mode: PermissionMode) => void;
  toggle: () => void;
};

const STORAGE_KEY = "openwork.permissionMode";

export const usePermissionModeStore = create<PermissionModeState>()(
  persist(
    (set) => ({
      mode: "manual",
      setMode: (mode) => set({ mode }),
      toggle: () => set((state) => ({ mode: state.mode === "manual" ? "full" : "manual" })),
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({ mode: state.mode }),
    },
  ),
);

export function readPermissionMode(): PermissionMode {
  if (typeof window === "undefined") return "manual";
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw === '"full"' || raw === "full" ? "full" : "manual";
  } catch {
    return "manual";
  }
}
