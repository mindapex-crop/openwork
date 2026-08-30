/**
 * Relay Sync（接力同步）核心服务。
 *
 * - threadSnapshot(threadId)：读取 transcript，把相对基线的增量 turns
 *   写入 outgoing pending 队列（发送端离线续传的载体），返回含版本号的快照。
 * - applySnapshot(threadId, snapshot)：版本冲突检测 + 逐 turn 追加合并
 *   （merge.ts），新增 turns 落 incoming entries。
 * - changeLog(threadId, fromVersion)：增量变更拉取。
 * - syncStatus(threadId)：双方版本 / 待同步队列。
 * - relay(threadId)：发起接力，标注 relay 事件。
 */

import { randomBytes } from "node:crypto";
import { ApiError } from "../errors.js";
import { mergeTranscriptMessages } from "./merge.js";
import type { RelaySyncStore } from "./store.js";
import type {
  RelayApplyResult,
  RelayEntryDirection,
  RelayEntryRecord,
  RelayRelayResult,
  RelaySnapshotInput,
  RelaySyncStatus,
  RelayThreadRecord,
  RelayTranscriptSnapshot,
  RelayTranscriptSnapshotInput,
} from "./types.js";

export interface RelaySyncServiceOptions {
  store: RelaySyncStore;
  /** 读取当前 thread 的 transcript（生产接 headless-threads exportTranscript）。 */
  readTranscript: (threadId: string) => Promise<RelayTranscriptSnapshotInput>;
  /** 本端标识（如 "cloud" / "local"），写入快照 source 字段。 */
  source: string;
  now?: () => number;
}

function randomId(): string {
  return `rle_${Date.now().toString(36)}${randomBytes(6).toString("hex")}`;
}

export class RelaySyncService {
  private readonly now: () => number;

  constructor(private readonly options: RelaySyncServiceOptions) {
    this.now = options.now ?? Date.now;
  }

  private ensureThread(threadId: string): RelayThreadRecord {
    const existing = this.options.store.getThread(threadId);
    if (existing) return existing;
    return {
      threadId,
      localVersion: 0,
      remoteVersion: 0,
      baselineMessages: [],
      lastSyncedAt: null,
      lastSyncDirection: null,
      updatedAt: this.now(),
    };
  }

  /** 生成当前 transcript 快照（含版本号），并把增量 turns 写入 outgoing pending 队列。 */
  async threadSnapshot(threadId: string): Promise<RelayTranscriptSnapshot> {
    const transcript = await this.options.readTranscript(threadId);
    const record = this.ensureThread(threadId);
    const knownIds = new Set(record.baselineMessages.map((message) => message.id));
    const newTurns = transcript.messages.filter((message) => !knownIds.has(message.id));

    let version = record.localVersion;
    const now = this.now();
    if (newTurns.length > 0) {
      const entries: RelayEntryRecord[] = newTurns.map((turn) => {
        version += 1;
        return {
          entryId: randomId(),
          threadId,
          version,
          kind: "turn",
          message: turn,
          note: null,
          direction: "outgoing",
          state: "pending",
          createdAt: now,
        };
      });
      this.options.store.saveThread({
        ...record,
        localVersion: version,
        baselineMessages: transcript.messages,
        updatedAt: now,
      });
      this.options.store.appendEntries(threadId, entries);
    }

    return {
      threadId,
      version,
      title: transcript.title,
      status: transcript.status,
      messages: transcript.messages,
      finalAssistantText: transcript.finalAssistantText,
      usage: transcript.usage,
      terminalError: transcript.terminalError,
      source: this.options.source,
      createdAt: now,
    };
  }

  /** 应用对端快照：版本冲突检测 + 合并，新增 turns 落 incoming entries。 */
  applySnapshot(threadId: string, snapshot: RelaySnapshotInput): RelayApplyResult {
    if (snapshot.threadId !== threadId) {
      throw new ApiError(400, "relay_sync_thread_mismatch", "Snapshot threadId does not match the relay target");
    }
    if (!Array.isArray(snapshot.messages)) {
      throw new ApiError(400, "invalid_payload", "snapshot.messages must be an array");
    }
    if (!Number.isInteger(snapshot.version) || snapshot.version < 0) {
      throw new ApiError(400, "invalid_payload", "snapshot.version must be a non-negative integer");
    }

    const record = this.ensureThread(threadId);
    const now = this.now();

    // 版本冲突检测：快照版本早于已应用的对方版本，且消息集不一致 => stale。
    if (snapshot.version < record.remoteVersion) {
      const baselineIds = new Set(record.baselineMessages.map((message) => message.id));
      const allKnown = snapshot.messages.every((message) => baselineIds.has(message.id));
      if (allKnown) {
        return {
          accepted: true,
          conflict: false,
          staleConflict: false,
          merged: false,
          fromVersion: snapshot.version,
          version: record.localVersion,
          remoteVersion: record.remoteVersion,
          addedCount: 0,
          conflicts: [],
        };
      }
      return {
        accepted: false,
        conflict: false,
        staleConflict: true,
        merged: false,
        fromVersion: snapshot.version,
        version: record.localVersion,
        remoteVersion: record.remoteVersion,
        addedCount: 0,
        conflicts: [],
      };
    }

    const merged = mergeTranscriptMessages({
      localVersion: record.localVersion,
      localMessages: record.baselineMessages,
      remoteVersion: snapshot.version,
      remoteMessages: snapshot.messages,
    });

    let version = record.localVersion;
    const entries: RelayEntryRecord[] = merged.added.map((turn) => {
      version += 1;
      return {
        entryId: randomId(),
        threadId,
        version,
        kind: "turn",
        message: turn,
        note: null,
        direction: "incoming",
        state: "applied",
        createdAt: now,
      };
    });

    this.options.store.saveThread({
      ...record,
      localVersion: version,
      remoteVersion: Math.max(record.remoteVersion, snapshot.version),
      baselineMessages: merged.messages,
      lastSyncedAt: now,
      lastSyncDirection: "pull",
      updatedAt: now,
    });
    if (entries.length > 0) this.options.store.appendEntries(threadId, entries);

    return {
      accepted: true,
      conflict: merged.conflicts.length > 0,
      staleConflict: false,
      merged: merged.added.length > 0,
      fromVersion: snapshot.version,
      version,
      remoteVersion: snapshot.version,
      addedCount: merged.added.length,
      conflicts: merged.conflicts,
    };
  }

  /** 增量变更拉取：返回 version > fromVersion 的条目（含 relay 事件）。 */
  changeLog(threadId: string, fromVersion: number): RelayEntryRecord[] {
    return this.options.store.listEntries(threadId, fromVersion);
  }

  /** 双方版本 / 待同步队列 / relay 事件统计。 */
  syncStatus(threadId: string): RelaySyncStatus {
    const record = this.options.store.getThread(threadId);
    if (!record) {
      return {
        threadId,
        localVersion: 0,
        remoteVersion: 0,
        pendingCount: 0,
        sentCount: 0,
        lastSyncedAt: null,
        lastSyncDirection: null,
        relayEventCount: 0,
        updatedAt: 0,
      };
    }
    return {
      threadId,
      localVersion: record.localVersion,
      remoteVersion: record.remoteVersion,
      pendingCount: this.options.store.countPending(threadId),
      sentCount: this.options.store.countSent(threadId),
      lastSyncedAt: record.lastSyncedAt,
      lastSyncDirection: record.lastSyncDirection,
      relayEventCount: this.options.store.countRelayEvents(threadId),
      updatedAt: record.updatedAt,
    };
  }

  /** 发起接力（云下→云上），标注 relay 事件（占一个版本号）。 */
  relay(threadId: string, input?: { note?: string; direction?: RelayEntryDirection }): RelayRelayResult {
    const record = this.ensureThread(threadId);
    const now = this.now();
    const version = record.localVersion + 1;
    this.options.store.saveThread({ ...record, localVersion: version, updatedAt: now });
    this.options.store.appendEntries(threadId, [
      {
        entryId: randomId(),
        threadId,
        version,
        kind: "relay",
        message: null,
        note: input?.note ?? null,
        direction: input?.direction ?? "outgoing",
        state: "applied",
        createdAt: now,
      },
    ]);
    return { threadId, version, note: input?.note ?? null, relayedAt: now };
  }

  /** 待续传的 outgoing pending 条目（按 version 升序）。 */
  pendingOutgoing(threadId: string): RelayEntryRecord[] {
    return this.options.store.listPendingOutgoing(threadId);
  }

  /** 把某条 entry 组装成可用于推送的增量快照。 */
  snapshotForEntry(threadId: string, entry: RelayEntryRecord): RelayTranscriptSnapshot {
    const record = this.ensureThread(threadId);
    const message = entry.message;
    const now = this.now();
    return {
      threadId,
      version: entry.version,
      title: null,
      status: { type: "idle" },
      messages: message === null ? [] : [message],
      finalAssistantText: message?.role === "assistant" ? message.text : "",
      usage: { inputTokens: 0, outputTokens: 0, reasoningTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, cost: 0 },
      terminalError: null,
      source: this.options.source,
      createdAt: now,
    };
  }

  /** 标记 outgoing 条目已成功推送（续传成功后调用）。 */
  markOutgoingSent(threadId: string, entryIds: string[]): number {
    return this.options.store.markEntriesSent(threadId, entryIds);
  }
}
