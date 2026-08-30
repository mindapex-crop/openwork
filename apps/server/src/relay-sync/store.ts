/**
 * Relay Sync sqlite 存储层。
 *
 * 新表 relay_sync_threads（线程级版本/基线/最近同步时间）与
 * relay_sync_entries（变更日志 + 待续传 pending 队列），参考
 * runtime-db.ts 的连接模式与 opencode-db.ts 的原生 SQL 风格。
 */

import type { RuntimeSqliteDatabase } from "../runtime-db.js";
import type { HeadlessTranscriptMessage } from "@openwork/headless-threads";
import type {
  RelayEntryRecord,
  RelaySyncDirection,
  RelayThreadRecord,
} from "./types.js";

const CREATE_THREADS_TABLE_SQL =
  "CREATE TABLE IF NOT EXISTS relay_sync_threads (" +
  "thread_id TEXT PRIMARY KEY NOT NULL, " +
  "local_version INTEGER NOT NULL DEFAULT 0, " +
  "remote_version INTEGER NOT NULL DEFAULT 0, " +
  "baseline_json TEXT NOT NULL DEFAULT '[]', " +
  "last_synced_at INTEGER, " +
  "last_sync_direction TEXT, " +
  "updated_at INTEGER NOT NULL)";

const CREATE_ENTRIES_TABLE_SQL =
  "CREATE TABLE IF NOT EXISTS relay_sync_entries (" +
  "id INTEGER PRIMARY KEY AUTOINCREMENT, " +
  "entry_id TEXT NOT NULL UNIQUE, " +
  "thread_id TEXT NOT NULL, " +
  "version INTEGER NOT NULL, " +
  "kind TEXT NOT NULL, " +
  "message_json TEXT, " +
  "note TEXT, " +
  "direction TEXT NOT NULL, " +
  "state TEXT NOT NULL, " +
  "created_at INTEGER NOT NULL)";

const CREATE_ENTRIES_INDEX_SQL =
  "CREATE INDEX IF NOT EXISTS idx_relay_sync_entries_thread_version " +
  "ON relay_sync_entries(thread_id, version)";
const CREATE_ENTRIES_PENDING_INDEX_SQL =
  "CREATE INDEX IF NOT EXISTS idx_relay_sync_entries_pending " +
  "ON relay_sync_entries(thread_id, direction, state)";

export interface RelaySyncStore {
  getThread(threadId: string): RelayThreadRecord | null;
  saveThread(record: RelayThreadRecord): void;
  appendEntries(threadId: string, entries: RelayEntryRecord[]): void;
  /** 返回 version > fromVersion 的条目，按 version 升序。 */
  listEntries(threadId: string, fromVersion: number): RelayEntryRecord[];
  /** 返回 direction=outgoing 且 state=pending 的条目，按 version 升序。 */
  listPendingOutgoing(threadId: string): RelayEntryRecord[];
  markEntriesSent(threadId: string, entryIds: string[]): number;
  countPending(threadId: string): number;
  countSent(threadId: string): number;
  countRelayEvents(threadId: string): number;
}

interface ThreadRow {
  thread_id: string;
  local_version: number;
  remote_version: number;
  baseline_json: string;
  last_synced_at: number | null;
  last_sync_direction: string | null;
  updated_at: number;
}

interface EntryRow {
  entry_id: string;
  thread_id: string;
  version: number;
  kind: string;
  message_json: string | null;
  note: string | null;
  direction: string;
  state: string;
  created_at: number;
}

export class SqliteRelaySyncStore implements RelaySyncStore {
  private readonly runtime: RuntimeSqliteDatabase;

  constructor(runtime: RuntimeSqliteDatabase) {
    this.runtime = runtime;
    if (runtime.kind === "bun") {
      runtime.sqlite.run(CREATE_THREADS_TABLE_SQL);
      runtime.sqlite.run(CREATE_ENTRIES_TABLE_SQL);
      runtime.sqlite.run(CREATE_ENTRIES_INDEX_SQL);
      runtime.sqlite.run(CREATE_ENTRIES_PENDING_INDEX_SQL);
    } else {
      runtime.sqlite.exec(CREATE_THREADS_TABLE_SQL);
      runtime.sqlite.exec(CREATE_ENTRIES_TABLE_SQL);
      runtime.sqlite.exec(CREATE_ENTRIES_INDEX_SQL);
      runtime.sqlite.exec(CREATE_ENTRIES_PENDING_INDEX_SQL);
    }
  }

  getThread(threadId: string): RelayThreadRecord | null {
    const row = this.runtime.sqlite.prepare(
      "SELECT thread_id, local_version, remote_version, baseline_json, last_synced_at, last_sync_direction, updated_at FROM relay_sync_threads WHERE thread_id = ?",
    ).get(threadId) as ThreadRow | undefined;
    if (!row) return null;
    return {
      threadId: row.thread_id,
      localVersion: row.local_version,
      remoteVersion: row.remote_version,
      baselineMessages: JSON.parse(row.baseline_json) as HeadlessTranscriptMessage[],
      lastSyncedAt: row.last_synced_at,
      lastSyncDirection: (row.last_sync_direction ?? null) as RelaySyncDirection,
      updatedAt: row.updated_at,
    };
  }

  saveThread(record: RelayThreadRecord): void {
    this.runtime.sqlite.prepare(
      "INSERT INTO relay_sync_threads (thread_id, local_version, remote_version, baseline_json, last_synced_at, last_sync_direction, updated_at) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?) " +
        "ON CONFLICT(thread_id) DO UPDATE SET " +
        "local_version = excluded.local_version, " +
        "remote_version = excluded.remote_version, " +
        "baseline_json = excluded.baseline_json, " +
        "last_synced_at = excluded.last_synced_at, " +
        "last_sync_direction = excluded.last_sync_direction, " +
        "updated_at = excluded.updated_at",
    ).run(
      record.threadId,
      record.localVersion,
      record.remoteVersion,
      JSON.stringify(record.baselineMessages),
      record.lastSyncedAt,
      record.lastSyncDirection,
      record.updatedAt,
    );
  }

  appendEntries(threadId: string, entries: RelayEntryRecord[]): void {
    if (entries.length === 0) return;
    const insert = this.runtime.sqlite.prepare(
      "INSERT INTO relay_sync_entries (entry_id, thread_id, version, kind, message_json, note, direction, state, created_at) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    );
    for (const entry of entries) {
      insert.run(
        entry.entryId,
        threadId,
        entry.version,
        entry.kind,
        entry.message === null ? null : JSON.stringify(entry.message),
        entry.note,
        entry.direction,
        entry.state,
        entry.createdAt,
      );
    }
  }

  listEntries(threadId: string, fromVersion: number): RelayEntryRecord[] {
    const rows = this.runtime.sqlite.prepare(
      "SELECT entry_id, thread_id, version, kind, message_json, note, direction, state, created_at " +
        "FROM relay_sync_entries WHERE thread_id = ? AND version > ? ORDER BY version ASC",
    ).all(threadId, fromVersion) as EntryRow[];
    return rows.map(toEntryRecord);
  }

  listPendingOutgoing(threadId: string): RelayEntryRecord[] {
    const rows = this.runtime.sqlite.prepare(
      "SELECT entry_id, thread_id, version, kind, message_json, note, direction, state, created_at " +
        "FROM relay_sync_entries WHERE thread_id = ? AND direction = 'outgoing' AND state = 'pending' " +
        "ORDER BY version ASC",
    ).all(threadId) as EntryRow[];
    return rows.map(toEntryRecord);
  }

  markEntriesSent(threadId: string, entryIds: string[]): number {
    if (entryIds.length === 0) return 0;
    const placeholders = entryIds.map(() => "?").join(", ");
    const result = this.runtime.sqlite.prepare(
      `UPDATE relay_sync_entries SET state = 'sent' WHERE thread_id = ? AND entry_id IN (${placeholders})`,
    ).run(threadId, ...entryIds);
    return typeof result === "object" && result !== null && "changes" in result
      ? Number((result as { changes: unknown }).changes)
      : entryIds.length;
  }

  countPending(threadId: string): number {
    return countRow(
      this.runtime.sqlite.prepare(
        "SELECT COUNT(*) AS count FROM relay_sync_entries WHERE thread_id = ? AND direction = 'outgoing' AND state = 'pending'",
      ).get(threadId),
    );
  }

  countSent(threadId: string): number {
    return countRow(
      this.runtime.sqlite.prepare(
        "SELECT COUNT(*) AS count FROM relay_sync_entries WHERE thread_id = ? AND direction = 'outgoing' AND state = 'sent'",
      ).get(threadId),
    );
  }

  countRelayEvents(threadId: string): number {
    return countRow(
      this.runtime.sqlite.prepare(
        "SELECT COUNT(*) AS count FROM relay_sync_entries WHERE thread_id = ? AND kind = 'relay'",
      ).get(threadId),
    );
  }
}

function countRow(row: unknown): number {
  if (typeof row !== "object" || row === null) return 0;
  const count = (row as { count?: unknown }).count;
  return typeof count === "number" ? count : Number(count ?? 0);
}

function toEntryRecord(row: EntryRow): RelayEntryRecord {
  return {
    entryId: row.entry_id,
    threadId: row.thread_id,
    version: row.version,
    kind: row.kind === "relay" ? "relay" : "turn",
    message: row.message_json === null ? null : (JSON.parse(row.message_json) as HeadlessTranscriptMessage),
    note: row.note,
    direction: row.direction === "incoming" ? "incoming" : "outgoing",
    state: row.state === "sent" ? "sent" : row.state === "pending" ? "pending" : "applied",
    createdAt: row.created_at,
  };
}
