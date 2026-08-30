import { sql } from "drizzle-orm"
import { bigint, boolean, index, json, mysqlTable, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core"
import { denTypeIdColumn } from "../columns"

export const DeviceTable = mysqlTable(
  "device",
  {
    id: denTypeIdColumn("device", "id").notNull().primaryKey(),
    userId: denTypeIdColumn("user", "user_id").notNull(),
    deviceType: varchar("device_type", { length: 16 }).notNull(),
    deviceName: varchar("device_name", { length: 255 }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { fsp: 3 }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)`),
  },
  (table) => [
    index("device_user_id").on(table.userId),
    uniqueIndex("device_user_type_name").on(table.userId, table.deviceType, table.deviceName),
  ],
)

export const DevicePairingCodeTable = mysqlTable(
  "device_pairing_code",
  {
    id: denTypeIdColumn("devicePairingCode", "id").notNull().primaryKey(),
    code: varchar("code", { length: 16 }).notNull(),
    initiatedByDeviceId: denTypeIdColumn("device", "initiated_by_device_id").notNull(),
    initiatedByUserId: denTypeIdColumn("user", "initiated_by_user_id").notNull(),
    completedByDeviceId: denTypeIdColumn("device", "completed_by_device_id"),
    completedByUserId: denTypeIdColumn("user", "completed_by_user_id"),
    expiresAt: timestamp("expires_at", { fsp: 3 }).notNull(),
    consumedAt: timestamp("consumed_at", { fsp: 3 }),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("device_pairing_code_code").on(table.code),
    index("device_pairing_code_expires_at").on(table.expiresAt),
    index("device_pairing_code_initiated_by").on(table.initiatedByUserId),
  ],
)

export const RelaySyncChangeLogTable = mysqlTable(
  "relay_sync_change_log",
  {
    id: denTypeIdColumn("relaySyncChange", "id").notNull().primaryKey(),
    sessionId: denTypeIdColumn("session", "session_id").notNull(),
    deviceId: denTypeIdColumn("device", "device_id").notNull(),
    changeType: varchar("change_type", { length: 32 }).notNull(),
    payload: json("payload").$type<Record<string, unknown>>().notNull(),
    version: bigint("version", { mode: "number" }).notNull(),
    vectorClock: json("vector_clock").$type<Record<string, number>>().notNull(),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
  },
  (table) => [
    index("relay_sync_change_log_session_id").on(table.sessionId),
    index("relay_sync_change_log_session_version").on(table.sessionId, table.version),
    index("relay_sync_change_log_device_id").on(table.deviceId),
  ],
)

export const SessionPresenceTable = mysqlTable(
  "session_presence",
  {
    id: denTypeIdColumn("sessionPresence", "id").notNull().primaryKey(),
    sessionId: denTypeIdColumn("session", "session_id").notNull(),
    deviceId: denTypeIdColumn("device", "device_id").notNull(),
    deviceType: varchar("device_type", { length: 16 }).notNull(),
    cursorPosition: json("cursor_position").$type<{ messageId: string } | null>(),
    lastSeenAt: timestamp("last_seen_at", { fsp: 3 }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)`),
  },
  (table) => [
    uniqueIndex("session_presence_session_device").on(table.sessionId, table.deviceId),
    index("session_presence_session_id").on(table.sessionId),
    index("session_presence_last_seen").on(table.lastSeenAt),
  ],
)

export const device = DeviceTable
export const devicePairingCode = DevicePairingCodeTable
export const relaySyncChangeLog = RelaySyncChangeLogTable
export const sessionPresence = SessionPresenceTable
