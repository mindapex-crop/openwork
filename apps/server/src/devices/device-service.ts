/**
 * 多设备配对与远程控制服务层。
 *
 * 配对码由桌面端调用 issuePairCode 生成（60s TTL），移动端调用 pair
 * 消费配对码并获得 deviceToken。后续移动端使用 deviceToken 进行心跳
 * 上报与远程控制指令下发。
 */

import type { DeviceStore } from "./device-store.js";
import type {
  DeviceControlAck,
  DeviceControlRecord,
  DeviceControlRequest,
  DevicePlatform,
  PairRequest,
  PairResult,
  PairedDevice,
} from "./types.js";

const PAIR_CODE_TTL_MS = 60_000;
const DEVICE_TOKEN_PREFIX = "owd_";

interface PendingPairCode {
  code: string;
  issuedAt: number;
  expiresAt: number;
  consumed: boolean;
}

export interface DeviceService {
  issuePairCode(now: number): string;
  getPendingPairCode(): PendingPairCode | null;
  pair(request: PairRequest, now: number): PairResult;
  listDevices(): PairedDevice[];
  getDevice(deviceId: string): PairedDevice | null;
  revokeDevice(deviceId: string): boolean;
  heartbeat(deviceId: string, now: number, remoteControlActive?: boolean): boolean;
  enqueueControl(deviceId: string, request: DeviceControlRequest, now: number): DeviceControlRecord;
  pendingControl(deviceId: string): DeviceControlRecord | null;
  pendingControlAll(): DeviceControlRecord[];
  ackControl(ack: DeviceControlAck): boolean;
}

export function createDeviceService(store: DeviceStore): DeviceService {
  let pendingPairCode: PendingPairCode | null = null;

  function generatePairCode(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }

  function generateDeviceId(): string {
    return `dev_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }

  function generateDeviceToken(): string {
    return `${DEVICE_TOKEN_PREFIX}${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  }

  return {
    issuePairCode(now: number): string {
      const code = generatePairCode();
      pendingPairCode = {
        code,
        issuedAt: now,
        expiresAt: now + PAIR_CODE_TTL_MS,
        consumed: false,
      };
      return code;
    },

    getPendingPairCode(): PendingPairCode | null {
      return pendingPairCode;
    },

    pair(request: PairRequest, now: number): PairResult {
      if (!pendingPairCode || pendingPairCode.consumed || now > pendingPairCode.expiresAt) {
        throw new DeviceServiceError("pair_code_expired_or_invalid", "Pair code expired or invalid.");
      }
      if (request.pairCode !== pendingPairCode.code) {
        throw new DeviceServiceError("pair_code_mismatch", "Pair code does not match.");
      }
      if (!request.name.trim()) {
        throw new DeviceServiceError("invalid_device_name", "Device name is required.");
      }
      const validPlatforms: DevicePlatform[] = ["ios", "android", "web", "desktop"];
      if (!validPlatforms.includes(request.platform)) {
        throw new DeviceServiceError("invalid_platform", "Platform must be ios, android, web, or desktop.");
      }

      pendingPairCode.consumed = true;
      const deviceId = generateDeviceId();
      const deviceToken = generateDeviceToken();
      const device: PairedDevice = {
        deviceId,
        name: request.name.trim(),
        platform: request.platform,
        pairedAt: now,
        lastSeenAt: now,
        active: true,
        remoteControlActive: false,
      };
      store.insertDevice(device);
      return { deviceId, deviceToken, pairedAt: now };
    },

    listDevices(): PairedDevice[] {
      return store.listDevices();
    },

    getDevice(deviceId: string): PairedDevice | null {
      return store.getDevice(deviceId);
    },

    revokeDevice(deviceId: string): boolean {
      return store.revokeDevice(deviceId);
    },

    heartbeat(deviceId: string, now: number, remoteControlActive?: boolean): boolean {
      return store.heartbeat(deviceId, now, remoteControlActive);
    },

    enqueueControl(deviceId: string, request: DeviceControlRequest, now: number): DeviceControlRecord {
      const validCommands: DeviceControlRequest["command"][] = ["continue", "stop", "lock", "unlock"];
      if (!validCommands.includes(request.command)) {
        throw new DeviceServiceError("invalid_command", "Command must be continue, stop, lock, or unlock.");
      }
      const device = store.getDevice(deviceId);
      if (!device || !device.active) {
        throw new DeviceServiceError("device_not_found", "Device not found or revoked.");
      }
      const record: DeviceControlRecord = {
        commandId: `cmd_${now}_${Math.random().toString(36).slice(2, 10)}`,
        deviceId,
        command: request.command,
        threadId: request.threadId ?? null,
        note: request.note ?? null,
        status: "pending",
        createdAt: now,
        executedAt: null,
      };
      store.enqueueControl(record);
      return record;
    },

    pendingControl(deviceId: string): DeviceControlRecord | null {
      return store.pendingControl(deviceId);
    },

    pendingControlAll(): DeviceControlRecord[] {
      return store.pendingControlAll();
    },

    ackControl(ack: DeviceControlAck): boolean {
      return store.ackControl(ack);
    },
  };
}

export class DeviceServiceError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "DeviceServiceError";
  }
}