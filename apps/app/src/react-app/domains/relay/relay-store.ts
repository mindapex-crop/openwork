/**
 * Relay Sync（接力同步）前端 store。
 *
 * 轮询 GET /api/relay-sync/:threadId/status 展示当前会话的接力同步状态，
 * 提供"发起接力"动作（POST /api/relay-sync/:threadId/relay）。
 * baseUrl/token 沿用 Den settings（与 collab-api 同机制）。
 */

import { create } from "zustand";
import { readDenSettings } from "@/app/lib/den";

export type RelaySyncStatus = {
  threadId: string;
  localVersion: number;
  remoteVersion: number;
  pendingCount: number;
  sentCount: number;
  lastSyncedAt: number | null;
  lastSyncDirection: "push" | "pull" | null;
  relayEventCount: number;
  updatedAt: number;
};

export type RelayStatusPhase = "idle" | "loading" | "ready" | "error";

export const RELAY_POLL_INTERVAL_MS = 5_000;

function relayBaseUrl(): string {
  return readDenSettings().baseUrl.replace(/\/+$/, "");
}

function relayHeaders(): Record<string, string> {
  const { authToken } = readDenSettings();
  const headers: Record<string, string> = { Accept: "application/json" };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  return headers;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function normalizeRelaySyncStatus(data: unknown): RelaySyncStatus | null {
  if (!isRecord(data)) return null;
  const threadId = typeof data.threadId === "string" ? data.threadId : "";
  if (!threadId) return null;
  const direction = data.lastSyncDirection;
  return {
    threadId,
    localVersion: typeof data.localVersion === "number" ? data.localVersion : 0,
    remoteVersion: typeof data.remoteVersion === "number" ? data.remoteVersion : 0,
    pendingCount: typeof data.pendingCount === "number" ? data.pendingCount : 0,
    sentCount: typeof data.sentCount === "number" ? data.sentCount : 0,
    lastSyncedAt: typeof data.lastSyncedAt === "number" ? data.lastSyncedAt : null,
    lastSyncDirection:
      direction === "push" || direction === "pull" ? direction : null,
    relayEventCount: typeof data.relayEventCount === "number" ? data.relayEventCount : 0,
    updatedAt: typeof data.updatedAt === "number" ? data.updatedAt : 0,
  };
}

export function relayStatusUrl(threadId: string): string {
  return `${relayBaseUrl()}/api/relay-sync/${encodeURIComponent(threadId)}/status`;
}

/** 纯 fetch：拉取当前线程的接力同步状态。 */
export async function fetchRelayStatus(
  baseUrl: string,
  threadId: string,
  options?: { token?: string | null; signal?: AbortSignal },
): Promise<RelaySyncStatus> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options?.token) headers.Authorization = `Bearer ${options.token}`;
  const response = await fetch(
    `${baseUrl.replace(/\/+$/, "")}/api/relay-sync/${encodeURIComponent(threadId)}/status`,
    { headers, signal: options?.signal },
  );
  if (!response.ok) {
    throw new Error(`Relay status request failed: ${response.status}`);
  }
  const data = await response.json();
  const status = normalizeRelaySyncStatus(data);
  if (!status) throw new Error("Relay status response is invalid");
  return status;
}

/** 纯 fetch：发起接力（云下→云上），标注 relay 事件。 */
export async function postRelayEvent(
  baseUrl: string,
  threadId: string,
  note?: string,
  options?: { token?: string | null; signal?: AbortSignal },
): Promise<{ version: number; note: string | null; relayedAt: number }> {
  const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json" };
  if (options?.token) headers.Authorization = `Bearer ${options.token}`;
  const response = await fetch(
    `${baseUrl.replace(/\/+$/, "")}/api/relay-sync/${encodeURIComponent(threadId)}/relay`,
    {
      method: "POST",
      headers,
      body: JSON.stringify(note ? { note } : {}),
      signal: options?.signal,
    },
  );
  if (!response.ok) {
    throw new Error(`Relay event request failed: ${response.status}`);
  }
  const data = await response.json();
  if (!isRecord(data)) throw new Error("Relay event response is invalid");
  return {
    version: typeof data.version === "number" ? data.version : 0,
    note: typeof data.note === "string" ? data.note : null,
    relayedAt: typeof data.relayedAt === "number" ? data.relayedAt : Date.now(),
  };
}

type RelayStoreState = {
  threadId: string | null;
  status: RelaySyncStatus | null;
  phase: RelayStatusPhase;
  error: string | null;
  lastErrorAt: number | null;
  lastRelayedAt: number | null;
  setThreadId: (threadId: string | null) => void;
  fetchStatus: (threadId?: string) => Promise<void>;
  startPolling: (threadId: string, intervalMs?: number) => () => void;
  stopPolling: () => void;
  relay: (note?: string) => Promise<boolean>;
  clearError: () => void;
};

let pollingTimer: ReturnType<typeof setInterval> | null = null;

export const useRelaySyncStore = create<RelayStoreState>((set, get) => ({
  threadId: null,
  status: null,
  phase: "idle",
  error: null,
  lastErrorAt: null,
  lastRelayedAt: null,

  setThreadId: (threadId) => set({ threadId, phase: threadId ? "idle" : "idle" }),

  fetchStatus: async (threadId) => {
    const target = threadId ?? get().threadId;
    if (!target) return;
    set({ phase: "loading", error: null });
    try {
      const { baseUrl, authToken } = readDenSettings();
      const status = await fetchRelayStatus(baseUrl, target, { token: authToken });
      set({ status, phase: "ready", error: null, threadId: target });
    } catch (error) {
      set({
        phase: "error",
        error: error instanceof Error ? error.message : String(error),
        lastErrorAt: Date.now(),
      });
    }
  },

  startPolling: (threadId, intervalMs = RELAY_POLL_INTERVAL_MS) => {
    set({ threadId });
    if (pollingTimer) clearInterval(pollingTimer);
    void get().fetchStatus(threadId);
    pollingTimer = setInterval(() => {
      void get().fetchStatus(threadId);
    }, intervalMs);
    return () => {
      if (pollingTimer) {
        clearInterval(pollingTimer);
        pollingTimer = null;
      }
    };
  },

  stopPolling: () => {
    if (pollingTimer) {
      clearInterval(pollingTimer);
      pollingTimer = null;
    }
  },

  relay: async (note) => {
    const threadId = get().threadId;
    if (!threadId) return false;
    try {
      const { baseUrl, authToken } = readDenSettings();
      const result = await postRelayEvent(baseUrl, threadId, note, { token: authToken });
      set({ lastRelayedAt: result.relayedAt });
      await get().fetchStatus(threadId);
      return true;
    } catch (error) {
      set({
        phase: "error",
        error: error instanceof Error ? error.message : String(error),
        lastErrorAt: Date.now(),
      });
      return false;
    }
  },

  clearError: () => set({ error: null }),
}));

/** 组件卸载 / 单测清理用：停止轮询并复位。 */
export function __resetRelaySyncStoreForTest(): void {
  useRelaySyncStore.getState().stopPolling();
  useRelaySyncStore.setState({
    threadId: null,
    status: null,
    phase: "idle",
    error: null,
    lastErrorAt: null,
    lastRelayedAt: null,
  });
}
