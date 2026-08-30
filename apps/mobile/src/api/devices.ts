import type { ApiClient } from "./client";

export type DevicePlatform = "ios" | "android" | "web" | "desktop";
export type DeviceControlCommand = "continue" | "stop" | "lock" | "unlock";

export interface PairedDevice {
  deviceId: string;
  name: string;
  platform: DevicePlatform;
  pairedAt: number;
  lastSeenAt: number | null;
  active: boolean;
  remoteControlActive: boolean;
}

export interface PairResult {
  deviceId: string;
  deviceToken: string;
  pairedAt: number;
}

export interface DeviceControlRecord {
  commandId: string;
  deviceId: string;
  command: DeviceControlCommand;
  threadId: string | null;
  note: string | null;
  status: "pending" | "delivered" | "executed" | "failed";
  createdAt: number;
  executedAt: number | null;
}

export function devicesApi(client: ApiClient) {
  return {
    pair: (pairCode: string, name: string, platform: DevicePlatform): Promise<PairResult> =>
      client.post<PairResult>("/api/devices/pair", { pairCode, name, platform }),

    heartbeat: (deviceId: string, remoteControlActive?: boolean): Promise<{ ok: boolean }> =>
      client.post<{ ok: boolean }>(`/api/devices/${encodeURIComponent(deviceId)}/heartbeat`, {
        remoteControlActive,
      }),

    sendControl: (
      deviceId: string,
      command: DeviceControlCommand,
      threadId?: string,
      note?: string,
    ): Promise<DeviceControlRecord> =>
      client.post<DeviceControlRecord>(
        `/api/devices/${encodeURIComponent(deviceId)}/control`,
        { command, threadId, note },
      ),

    getPendingControl: (deviceId: string): Promise<{ command: DeviceControlRecord | null }> =>
      client.get<{ command: DeviceControlRecord | null }>(
        `/api/devices/${encodeURIComponent(deviceId)}/control`,
      ),

    ackControl: (
      deviceId: string,
      commandId: string,
      status: "executed" | "failed",
    ): Promise<{ ok: boolean; commandId: string }> =>
      client.post<{ ok: boolean; commandId: string }>(
        `/api/devices/${encodeURIComponent(deviceId)}/control/ack`,
        { commandId, status },
      ),
  };
}