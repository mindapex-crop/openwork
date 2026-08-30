import { and, desc, eq, gt, gte, inArray, ne, sql } from "@openwork-ee/den-db/drizzle"
import { DeviceTable, RelaySyncChangeLogTable, SessionPresenceTable } from "@openwork-ee/den-db/schema"
import { createDenTypeId, normalizeDenTypeId } from "@openwork-ee/utils/typeid"
import type { DenTypeId } from "@openwork-ee/utils/typeid"
import { db } from "../db.js"

export type VectorClock = Record<string, number>

export type RelaySyncChange = {
  id: string
  sessionId: string
  deviceId: string
  changeType: string
  payload: Record<string, unknown>
  version: number
  vectorClock: VectorClock
  createdAt: Date
}

export type SessionPresenceEntry = {
  sessionId: string
  deviceId: string
  deviceType: string
  cursorPosition: { messageId: string } | null
  lastSeenAt: Date
}

function normalizeDeviceId(deviceId: string): DenTypeId<"device"> {
  return normalizeDenTypeId("device", deviceId)
}

function normalizeSessionId(sessionId: string): DenTypeId<"session"> {
  return normalizeDenTypeId("session", sessionId)
}

export async function appendChange(input: {
  sessionId: string
  deviceId: string
  changeType: string
  payload: Record<string, unknown>
  vectorClock: VectorClock
}): Promise<RelaySyncChange> {
  const sessionId = normalizeSessionId(input.sessionId)
  const deviceId = normalizeDeviceId(input.deviceId)

  const result = await db.transaction(async (tx) => {
    const [maxRow] = await tx
      .select({ maxVersion: sql<number>`COALESCE(MAX(${RelaySyncChangeLogTable.version}), 0)` })
      .from(RelaySyncChangeLogTable)
      .where(eq(RelaySyncChangeLogTable.sessionId, sessionId))
      .limit(1)

    const nextVersion = (maxRow?.maxVersion ?? 0) + 1

    const id = createDenTypeId("relaySyncChange")
    const createdAt = new Date()
    await tx.insert(RelaySyncChangeLogTable).values({
      id,
      sessionId,
      deviceId,
      changeType: input.changeType,
      payload: input.payload,
      version: nextVersion,
      vectorClock: input.vectorClock,
      createdAt,
    })

    return { id, version: nextVersion, createdAt }
  })

  return {
    id: result.id,
    sessionId,
    deviceId,
    changeType: input.changeType,
    payload: input.payload,
    version: result.version,
    vectorClock: input.vectorClock,
    createdAt: result.createdAt,
  }
}

export async function getChangesSince(input: {
  sessionId: string
  sinceVersion: number
  excludeDeviceId?: string
}): Promise<RelaySyncChange[]> {
  const sessionId = normalizeSessionId(input.sessionId)

  const conditions = [
    eq(RelaySyncChangeLogTable.sessionId, sessionId),
    gt(RelaySyncChangeLogTable.version, input.sinceVersion),
  ]
  if (input.excludeDeviceId) {
    conditions.push(ne(RelaySyncChangeLogTable.deviceId, normalizeDeviceId(input.excludeDeviceId)))
  }

  const rows = await db
    .select({
      id: RelaySyncChangeLogTable.id,
      sessionId: RelaySyncChangeLogTable.sessionId,
      deviceId: RelaySyncChangeLogTable.deviceId,
      changeType: RelaySyncChangeLogTable.changeType,
      payload: RelaySyncChangeLogTable.payload,
      version: RelaySyncChangeLogTable.version,
      vectorClock: RelaySyncChangeLogTable.vectorClock,
      createdAt: RelaySyncChangeLogTable.createdAt,
    })
    .from(RelaySyncChangeLogTable)
    .where(and(...conditions))
    .orderBy(RelaySyncChangeLogTable.version)
    .limit(500)

  return rows.map((row) => ({
    id: row.id,
    sessionId: row.sessionId,
    deviceId: row.deviceId,
    changeType: row.changeType,
    payload: row.payload,
    version: row.version,
    vectorClock: row.vectorClock,
    createdAt: row.createdAt,
  }))
}

export async function getLatestVersion(sessionId: string): Promise<number> {
  const normalizedSessionId = normalizeSessionId(sessionId)
  const [row] = await db
    .select({ maxVersion: sql<number>`COALESCE(MAX(${RelaySyncChangeLogTable.version}), 0)` })
    .from(RelaySyncChangeLogTable)
    .where(eq(RelaySyncChangeLogTable.sessionId, normalizedSessionId))
    .limit(1)
  return row?.maxVersion ?? 0
}

export async function getChangesForSessions(input: {
  sessionIds: string[]
  sinceVersion: number
  excludeDeviceId?: string
}): Promise<RelaySyncChange[]> {
  if (input.sessionIds.length === 0) {
    return []
  }

  const normalizedSessionIds = input.sessionIds.map((id) => normalizeSessionId(id))
  const conditions = [
    inArray(RelaySyncChangeLogTable.sessionId, normalizedSessionIds),
    gte(RelaySyncChangeLogTable.version, input.sinceVersion),
  ]
  if (input.excludeDeviceId) {
    conditions.push(ne(RelaySyncChangeLogTable.deviceId, normalizeDeviceId(input.excludeDeviceId)))
  }

  const rows = await db
    .select({
      id: RelaySyncChangeLogTable.id,
      sessionId: RelaySyncChangeLogTable.sessionId,
      deviceId: RelaySyncChangeLogTable.deviceId,
      changeType: RelaySyncChangeLogTable.changeType,
      payload: RelaySyncChangeLogTable.payload,
      version: RelaySyncChangeLogTable.version,
      vectorClock: RelaySyncChangeLogTable.vectorClock,
      createdAt: RelaySyncChangeLogTable.createdAt,
    })
    .from(RelaySyncChangeLogTable)
    .where(and(...conditions))
    .orderBy(RelaySyncChangeLogTable.version)
    .limit(1000)

  return rows.map((row) => ({
    id: row.id,
    sessionId: row.sessionId,
    deviceId: row.deviceId,
    changeType: row.changeType,
    payload: row.payload,
    version: row.version,
    vectorClock: row.vectorClock,
    createdAt: row.createdAt,
  }))
}

export async function upsertPresence(input: {
  sessionId: string
  deviceId: string
  deviceType: string
  cursorPosition?: { messageId: string } | null
}): Promise<void> {
  const sessionId = normalizeSessionId(input.sessionId)
  const deviceId = normalizeDeviceId(input.deviceId)
  const now = new Date()

  const existing = await db
    .select({ id: SessionPresenceTable.id })
    .from(SessionPresenceTable)
    .where(
      and(
        eq(SessionPresenceTable.sessionId, sessionId),
        eq(SessionPresenceTable.deviceId, deviceId),
      ),
    )
    .limit(1)

  if (existing[0]) {
    await db
      .update(SessionPresenceTable)
      .set({
        deviceType: input.deviceType,
        cursorPosition: input.cursorPosition ?? null,
        lastSeenAt: now,
      })
      .where(eq(SessionPresenceTable.id, existing[0].id))
  } else {
    await db.insert(SessionPresenceTable).values({
      id: createDenTypeId("sessionPresence"),
      sessionId,
      deviceId,
      deviceType: input.deviceType,
      cursorPosition: input.cursorPosition ?? null,
      lastSeenAt: now,
    })
  }
}

export async function removePresence(sessionId: string, deviceId: string): Promise<void> {
  await db
    .delete(SessionPresenceTable)
    .where(
      and(
        eq(SessionPresenceTable.sessionId, normalizeSessionId(sessionId)),
        eq(SessionPresenceTable.deviceId, normalizeDeviceId(deviceId)),
      ),
    )
}

export async function getSessionPresence(sessionId: string): Promise<SessionPresenceEntry[]> {
  const normalizedSessionId = normalizeSessionId(sessionId)
  const staleThreshold = new Date(Date.now() - 5 * 60 * 1000)

  const rows = await db
    .select({
      sessionId: SessionPresenceTable.sessionId,
      deviceId: SessionPresenceTable.deviceId,
      deviceType: SessionPresenceTable.deviceType,
      cursorPosition: SessionPresenceTable.cursorPosition,
      lastSeenAt: SessionPresenceTable.lastSeenAt,
    })
    .from(SessionPresenceTable)
    .where(
      and(
        eq(SessionPresenceTable.sessionId, normalizedSessionId),
        gt(SessionPresenceTable.lastSeenAt, staleThreshold),
      ),
    )
    .orderBy(desc(SessionPresenceTable.lastSeenAt))

  return rows.map((row) => ({
    sessionId: row.sessionId,
    deviceId: row.deviceId,
    deviceType: row.deviceType,
    cursorPosition: row.cursorPosition,
    lastSeenAt: row.lastSeenAt,
  }))
}

export async function pruneStalePresence(): Promise<number> {
  const staleThreshold = new Date(Date.now() - 10 * 60 * 1000)
  const result = await db
    .delete(SessionPresenceTable)
    .where(sql`${SessionPresenceTable.lastSeenAt} < ${staleThreshold.getTime()}`)
  return (result as unknown as { rowsAffected: number })?.rowsAffected ?? 0
}

export async function registerDevice(input: {
  deviceId: string
  userId: string
  deviceType: string
  deviceName: string
}): Promise<{ id: string; userId: string; deviceType: string; deviceName: string; lastSeenAt: Date }> {
  const deviceId = normalizeDeviceId(input.deviceId)
  const userId = normalizeDenTypeId("user", input.userId)
  const now = new Date()

  const existing = await db
    .select({
      id: DeviceTable.id,
      userId: DeviceTable.userId,
      deviceType: DeviceTable.deviceType,
      deviceName: DeviceTable.deviceName,
      lastSeenAt: DeviceTable.lastSeenAt,
    })
    .from(DeviceTable)
    .where(eq(DeviceTable.id, deviceId))
    .limit(1)

  if (existing[0]) {
    await db
      .update(DeviceTable)
      .set({ deviceName: input.deviceName, lastSeenAt: now })
      .where(eq(DeviceTable.id, deviceId))
    return { ...existing[0], deviceName: input.deviceName, lastSeenAt: now }
  }

  await db.insert(DeviceTable).values({
    id: deviceId,
    userId,
    deviceType: input.deviceType,
    deviceName: input.deviceName,
    lastSeenAt: now,
  })

  return { id: deviceId, userId, deviceType: input.deviceType, deviceName: input.deviceName, lastSeenAt: now }
}

export async function getDevice(deviceId: string): Promise<{
  id: string
  userId: string
  deviceType: string
  deviceName: string
  lastSeenAt: Date
} | null> {
  const [row] = await db
    .select({
      id: DeviceTable.id,
      userId: DeviceTable.userId,
      deviceType: DeviceTable.deviceType,
      deviceName: DeviceTable.deviceName,
      lastSeenAt: DeviceTable.lastSeenAt,
    })
    .from(DeviceTable)
    .where(eq(DeviceTable.id, normalizeDeviceId(deviceId)))
    .limit(1)
  return row ?? null
}

export async function listUserDevices(userId: string): Promise<
  Array<{ id: string; deviceType: string; deviceName: string; lastSeenAt: Date }>
> {
  const normalizedUserId = normalizeDenTypeId("user", userId)
  const rows = await db
    .select({
      id: DeviceTable.id,
      deviceType: DeviceTable.deviceType,
      deviceName: DeviceTable.deviceName,
      lastSeenAt: DeviceTable.lastSeenAt,
    })
    .from(DeviceTable)
    .where(eq(DeviceTable.userId, normalizedUserId))
    .orderBy(desc(DeviceTable.lastSeenAt))
  return rows
}

export async function removeDevice(deviceId: string, userId: string): Promise<boolean> {
  const result = await db
    .delete(DeviceTable)
    .where(
      and(
        eq(DeviceTable.id, normalizeDeviceId(deviceId)),
        eq(DeviceTable.userId, normalizeDenTypeId("user", userId)),
      ),
    )
  return (result as unknown as { rowsAffected: number })?.rowsAffected > 0
}
