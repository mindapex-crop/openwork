/**
 * 多设备配对设备 SQLite 存储层。
 *
 * 表 paired_devices：已配对设备（deviceId / name / platform / pairedAt /
 * lastSeenAt / active / remoteControlActive）。
 * 表 device_control_queue：远程控制指令队列（commandId / deviceId / command /
 * threadId / status / createdAt / executedAt）。
 */

import type { RuntimeSqliteDatabase } from "../runtime-db.js";
import type {
  DeviceControlAck,
  DeviceControlCommand,
  DeviceControlRecord,
  DeviceControlRequest,
  DevicePlatform,
  PairedDevice,
} from "./types.js";

const CREATE_DEVICES_TABLE_SQL =
  "CREATE TABLE IF NOT EXISTS paired_devices (" +
  "device_id TEXT PRIMARY KEY NOT NULL, " +
  "name TEXT NOT NULL, " +
  "platform TEXT NOT NULL, " +
  "paired_at INTEGER NOT NULL, " +
  "last_seen_at INTEGER, " +
  "active INTEGER NOT NULL DEFAULT 1, " +
  "remote_control_active INTEGER NOT NULL DEFAULT 0)";

const CREATE_CONTROL_TABLE_SQL =
  "CREATE TABLE IF NOT EXISTS device_control_queue (" +
  "command_id TEXT PRIMARY KEY NOT NULL, " +
  "device_id TEXT NOT NULL, " +
  "command TEXT NOT NULL, " +
  "thread_id TEXT, " +
  "note TEXT, " +
  "status TEXT NOT NULL DEFAULT 'pending', " +
  "created_at INTEGER NOT NULL, " +
  "executed_at INTEGER)";

const CREATE_CONTROL_INDEX_SQL =
  "CREATE INDEX IF NOT EXISTS idx_device_control_pending " +
  "ON device_control_queue(device_id, status)";

interface DeviceRow {
  device_id: string;
  name: string;
  platform: string;
  paired_at: number;
  last_seen_at: number | null;
  active: number;
  remote_control_active: number;
}

interface ControlRow {
  command_id: string;
  device_id: string;
  command: string;
  thread_id: string | null;
  note: string | null;
  status: string;
  created_at: number;
  executed_at: number | null;
}

function toDevice(row: DeviceRow): PairedDevice {
  return {
    deviceId: row.device_id,
    name: row.name,
    platform: row.platform as DevicePlatform,
    pairedAt: row.paired_at,
    lastSeenAt: row.last_seen_at,
    active: row.active === 1,
    remoteControlActive: row.remote_control_active === 1,
  };
}

function toControl(row: ControlRow): DeviceControlRecord {
  return {
    commandId: row.command_id,
    deviceId: row.device_id,
    command: row.command as DeviceControlCommand,
    threadId: row.thread_id,
    note: row.note,
    status: row.status as DeviceControlRecord["status"],
    createdAt: row.created_at,
    executedAt: row.executed_at,
  };
}

export interface DeviceStore {
  insertDevice(device: PairedDevice): void;
  getDevice(deviceId: string): PairedDevice | null;
  listDevices(): PairedDevice[];
  revokeDevice(deviceId: string): boolean;
  heartbeat(deviceId: string, now: number, remoteControlActive?: boolean): boolean;
  enqueueControl(record: DeviceControlRecord): void;
  pendingControl(deviceId: string): DeviceControlRecord | null;
  pendingControlAll(): DeviceControlRecord[];
  ackControl(ack: DeviceControlAck): boolean;
}

export class SqliteDeviceStore implements DeviceStore {
  private readonly runtime: RuntimeSqliteDatabase;

  constructor(runtime: RuntimeSqliteDatabase) {
    this.runtime = runtime;
    if (runtime.kind === "bun") {
      runtime.sqlite.run(CREATE_DEVICES_TABLE_SQL);
      runtime.sqlite.run(CREATE_CONTROL_TABLE_SQL);
      runtime.sqlite.run(CREATE_CONTROL_INDEX_SQL);
    } else {
      runtime.sqlite.exec(CREATE_DEVICES_TABLE_SQL);
      runtime.sqlite.exec(CREATE_CONTROL_TABLE_SQL);
      runtime.sqlite.exec(CREATE_CONTROL_INDEX_SQL);
    }
  }

  insertDevice(device: PairedDevice): void {
    this.runtime.sqlite.prepare(
      "INSERT INTO paired_devices (device_id, name, platform, paired_at, last_seen_at, active, remote_control_active) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).run(
      device.deviceId,
      device.name,
      device.platform,
      device.pairedAt,
      device.lastSeenAt,
      device.active ? 1 : 0,
      device.remoteControlActive ? 1 : 0,
    );
  }

  getDevice(deviceId: string): PairedDevice | null {
    const row = this.runtime.sqlite.prepare(
      "SELECT device_id, name, platform, paired_at, last_seen_at, active, remote_control_active " +
        "FROM paired_devices WHERE device_id = ?",
    ).get(deviceId) as DeviceRow | undefined;
    return row ? toDevice(row) : null;
  }

  listDevices(): PairedDevice[] {
    const rows = this.runtime.sqlite.prepare(
      "SELECT device_id, name, platform, paired_at, last_seen_at, active, remote_control_active " +
        "FROM paired_devices WHERE active = 1 ORDER BY paired_at DESC",
    ).all() as DeviceRow[];
    return rows.map(toDevice);
  }

  revokeDevice(deviceId: string): boolean {
    const result = this.runtime.sqlite.prepare(
      "UPDATE paired_devices SET active = 0 WHERE device_id = ? AND active = 1",
    ).run(deviceId);
    return typeof result === "object" && result !== null && "changes" in result
      ? Number((result as { changes: unknown }).changes) > 0
      : true;
  }

  heartbeat(deviceId: string, now: number, remoteControlActive?: boolean): boolean {
    if (remoteControlActive === undefined) {
      const result = this.runtime.sqlite.prepare(
        "UPDATE paired_devices SET last_seen_at = ? WHERE device_id = ? AND active = 1",
      ).run(now, deviceId);
      return changesGreaterThanZero(result);
    }
    const result = this.runtime.sqlite.prepare(
      "UPDATE paired_devices SET last_seen_at = ?, remote_control_active = ? WHERE device_id = ? AND active = 1",
    ).run(now, remoteControlActive ? 1 : 0, deviceId);
    return changesGreaterThanZero(result);
  }

  enqueueControl(record: DeviceControlRecord): void {
    this.runtime.sqlite.prepare(
      "INSERT INTO device_control_queue (command_id, device_id, command, thread_id, note, status, created_at, executed_at) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ).run(
      record.commandId,
      record.deviceId,
      record.command,
      record.threadId,
      record.note,
      record.status,
      record.createdAt,
      record.executedAt,
    );
  }

  pendingControl(deviceId: string): DeviceControlRecord | null {
    const row = this.runtime.sqlite.prepare(
      "SELECT command_id, device_id, command, thread_id, note, status, created_at, executed_at " +
        "FROM device_control_queue WHERE device_id = ? AND status = 'pending' ORDER BY created_at ASC LIMIT 1",
    ).get(deviceId) as ControlRow | undefined;
    return row ? toControl(row) : null;
  }

  pendingControlAll(): DeviceControlRecord[] {
    const rows = this.runtime.sqlite.prepare(
      "SELECT command_id, device_id, command, thread_id, note, status, created_at, executed_at " +
        "FROM device_control_queue WHERE status = 'pending' ORDER BY created_at ASC",
    ).all() as ControlRow[];
    return rows.map(toControl);
  }

  ackControl(ack: DeviceControlAck): boolean {
    const result = this.runtime.sqlite.prepare(
      "UPDATE device_control_queue SET status = ?, executed_at = ? WHERE command_id = ? AND status = 'pending'",
    ).run(ack.status, ack.executedAt, ack.commandId);
    return changesGreaterThanZero(result);
  }
}

function changesGreaterThanZero(result: unknown): boolean {
  return typeof result === "object" && result !== null && "changes" in result
    ? Number((result as { changes: unknown }).changes) > 0
    : true;
}

export function makeControlRecord(
  deviceId: string,
  request: DeviceControlRequest,
  now: number,
): DeviceControlRecord {
  return {
    commandId: `cmd_${now}_${Math.random().toString(36).slice(2, 10)}`,
    deviceId,
    command: request.command,
    threadId: request.threadId ?? null,
    note: request.note ?? null,
    status: "pending",
    createdAt: now,
    executedAt: null,
  };
}