/**
 * 多设备远程控制：类型定义。
 *
 * 设备配对（pairing）→ 设备列表（list）→ 远程控制（control）→
 * 心跳上报（heartbeat）→ 解绑（revoke）。配对码由桌面端生成，移动端
 * 输入配对码完成绑定，绑定后移动端可发起远程控制指令（continue/stop/lock）。
 */

export type DevicePlatform = "ios" | "android" | "web" | "desktop";

export type DeviceControlCommand = "continue" | "stop" | "lock" | "unlock";

export type DeviceControlStatus = "pending" | "delivered" | "executed" | "failed";

export interface PairedDevice {
  deviceId: string;
  name: string;
  platform: DevicePlatform;
  pairedAt: number;
  lastSeenAt: number | null;
  active: boolean;
  remoteControlActive: boolean;
}

export interface PairRequest {
  pairCode: string;
  name: string;
  platform: DevicePlatform;
}

export interface PairResult {
  deviceId: string;
  deviceToken: string;
  pairedAt: number;
}

export interface HeartbeatRequest {
  remoteControlActive?: boolean;
}

export interface DeviceControlRequest {
  command: DeviceControlCommand;
  threadId?: string;
  note?: string;
}

export interface DeviceControlRecord {
  commandId: string;
  deviceId: string;
  command: DeviceControlCommand;
  threadId: string | null;
  note: string | null;
  status: DeviceControlStatus;
  createdAt: number;
  executedAt: number | null;
}

export interface DeviceControlAck {
  commandId: string;
  status: DeviceControlStatus;
  executedAt: number;
}