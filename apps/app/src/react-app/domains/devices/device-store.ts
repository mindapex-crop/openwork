/**
 * 多设备远程控制：桌面端 Zustand store。
 *
 * 管理：已配对设备列表、配对码生成/展示、远程控制指令轮询与执行。
 * 桌面端以 owner scope 调用 /api/devices/* 系列接口。
 */

import { create } from "zustand";

import { resolveOpenworkConnection } from "../../shell/openwork-connection";

type DevicePlatform = "ios" | "android" | "web" | "desktop";
type DeviceControlCommand = "continue" | "stop" | "lock" | "unlock";
type DeviceControlStatus = "pending" | "delivered" | "executed" | "failed";

interface PairedDevice {
  deviceId: string;
  name: string;
  platform: DevicePlatform;
  pairedAt: number;
  lastSeenAt: number | null;
  active: boolean;
  remoteControlActive: boolean;
}

interface DeviceControlRecord {
  commandId: string;
  deviceId: string;
  command: DeviceControlCommand;
  threadId: string | null;
  note: string | null;
  status: DeviceControlStatus;
  createdAt: number;
  executedAt: number | null;
}

interface DeviceState {
  devices: PairedDevice[];
  pairCode: string | null;
  pairCodeExpiresInSeconds: number;
  loading: boolean;
  error: string | null;
  locked: boolean;
  activeControlCommand: DeviceControlRecord | null;

  fetchDevices: () => Promise<void>;
  issuePairCode: () => Promise<void>;
  revokeDevice: (deviceId: string) => Promise<void>;
  pollControlCommands: () => Promise<void>;
  ackCommand: (commandId: string, status: "executed" | "failed") => Promise<void>;
  setLocked: (locked: boolean) => void;
  clearError: () => void;
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const { normalizedBaseUrl, resolvedToken } = await resolveOpenworkConnection();
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  if (resolvedToken) headers.set("Authorization", `Bearer ${resolvedToken}`);
  const response = await fetch(normalizedBaseUrl ? `${normalizedBaseUrl}${path}` : path, { ...init, headers });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorBody = body as { message?: string; hint?: string };
    const reason = errorBody.message ?? `Request failed: ${response.status}`;
    throw new Error(errorBody.hint ? `${reason}: ${errorBody.hint}` : reason);
  }
  return body as T;
}

export const useDeviceStore = create<DeviceState>((set, get) => ({
  devices: [],
  pairCode: null,
  pairCodeExpiresInSeconds: 0,
  loading: false,
  error: null,
  locked: false,
  activeControlCommand: null,

  fetchDevices: async () => {
    try {
      const body = await fetchJson<{ devices?: PairedDevice[] }>("/api/devices");
      set({ devices: Array.isArray(body.devices) ? body.devices : [], error: null });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) });
    }
  },

  issuePairCode: async () => {
    set({ loading: true, error: null });
    try {
      const body = await fetchJson<{ pairCode: string; expiresInSeconds: number }>(
        "/api/devices/pair-code",
        { method: "POST" },
      );
      set({
        pairCode: body.pairCode,
        pairCodeExpiresInSeconds: body.expiresInSeconds,
        loading: false,
      });
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },

  revokeDevice: async (deviceId: string) => {
    try {
      await fetchJson(`/api/devices/${encodeURIComponent(deviceId)}`, {
        method: "DELETE",
      });
      const { devices } = get();
      set({ devices: devices.filter((d) => d.deviceId !== deviceId), error: null });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) });
    }
  },

  pollControlCommands: async () => {
    try {
      const body = await fetchJson<{ commands: DeviceControlRecord[] }>(
        "/api/devices/control/pending",
      );
      const commands = body.commands;
      if (commands.length === 0) {
        set({ activeControlCommand: null });
        return;
      }
      const command = commands[0];
      set({ activeControlCommand: command });
      if (command.command === "lock") {
        set({ locked: true });
      } else if (command.command === "unlock") {
        set({ locked: false });
      }
    } catch {
      // 轮询失败静默处理，下次重试
    }
  },

  ackCommand: async (commandId: string, status: "executed" | "failed") => {
    const { activeControlCommand } = get();
    if (!activeControlCommand) return;
    try {
      await fetchJson(
        `/api/devices/${encodeURIComponent(activeControlCommand.deviceId)}/control/ack`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ commandId, status }),
        },
      );
      set({ activeControlCommand: null });
    } catch {
      // 确认失败静默处理，下次轮询会再次拿到该指令
    }
  },

  setLocked: (locked: boolean) => set({ locked }),

  clearError: () => set({ error: null }),
}));