/**
 * Relay Sync（接力同步）类型定义。
 *
 * 快照复用 packages/headless-threads 的 transcript 结构
 * （HeadlessTranscriptMessage 来自 exportTranscript），在 relay-sync 层
 * 包装版本号/来源等字段，不改 headless-threads 包本身。
 */

import type {
  HeadlessThreadMessageError,
  HeadlessThreadStatus,
  HeadlessThreadUsage,
  HeadlessTranscriptMessage,
} from "@openwork/headless-threads";
import type { RelayMergeConflict } from "./merge.js";

/** 最近一次同步的方向（push=发送/本地→远端，pull=接收/远端→本地）。 */
export type RelaySyncDirection = "push" | "pull" | null;

export type RelayEntryKind = "turn" | "relay";

/** outgoing=本端产生待发送/已发送；incoming=从对端应用进来。 */
export type RelayEntryDirection = "outgoing" | "incoming";

/** pending=待续传（发送端离线）；sent=已推送给对端；applied=已应用到本地。 */
export type RelayEntryState = "pending" | "sent" | "applied";

/**
 * 一个 transcript 快照：transcript 结构（threadId/title/status/messages/
 * finalAssistantText/usage/terminalError）+ relay 层字段（version/source/createdAt）。
 */
export interface RelayTranscriptSnapshot {
  threadId: string;
  /** 单调递增版本号；同 id 冲突时按此判定 last-writer-wins。 */
  version: number;
  title: string | null;
  status: HeadlessThreadStatus;
  messages: HeadlessTranscriptMessage[];
  finalAssistantText: string;
  usage: HeadlessThreadUsage;
  terminalError: HeadlessThreadMessageError | null;
  /** 来源标识（如 "cloud" / "local"），用于 relay 事件的上下文。 */
  source: string;
  createdAt: number;
}

/** relay_sync_threads 的读写模型。 */
export interface RelayThreadRecord {
  threadId: string;
  localVersion: number;
  remoteVersion: number;
  /** 最近一次生成/应用后的消息集（合并基线）。 */
  baselineMessages: HeadlessTranscriptMessage[];
  lastSyncedAt: number | null;
  lastSyncDirection: RelaySyncDirection;
  updatedAt: number;
}

/** relay_sync_entries 的读写模型（变更日志 + 待续传队列）。 */
export interface RelayEntryRecord {
  entryId: string;
  threadId: string;
  version: number;
  kind: RelayEntryKind;
  message: HeadlessTranscriptMessage | null;
  note: string | null;
  direction: RelayEntryDirection;
  state: RelayEntryState;
  createdAt: number;
}

export interface RelayApplyResult {
  /** false 表示快照因版本过旧被拒绝（staleConflict）。 */
  accepted: boolean;
  /** 应用过程中发生了同 id 内容冲突（已按 LWW 解决）。 */
  conflict: boolean;
  /** 快照版本早于已应用的对方版本，且消息集不一致，被拒绝。 */
  staleConflict: boolean;
  /** 本次应用是否合并进了新 turns。 */
  merged: boolean;
  fromVersion: number;
  /** 应用后的本地版本号。 */
  version: number;
  remoteVersion: number;
  addedCount: number;
  conflicts: RelayMergeConflict[];
}

export interface RelaySyncStatus {
  threadId: string;
  localVersion: number;
  remoteVersion: number;
  /** 待续传的 outgoing pending 条目数。 */
  pendingCount: number;
  /** 已推送成功的 outgoing 条目数。 */
  sentCount: number;
  lastSyncedAt: number | null;
  lastSyncDirection: RelaySyncDirection;
  /** 该线程上 relay 事件（接力发起）条数。 */
  relayEventCount: number;
  updatedAt: number;
}

export interface RelayRelayResult {
  threadId: string;
  version: number;
  note: string | null;
  relayedAt: number;
}

/** resume 续传一次 flush 的结果。 */
export interface RelayFlushResult {
  threadId: string;
  pushed: number;
  failed: number;
  /** 全部成功时为 0；否则为第一个失败条目的版本。 */
  failedAtVersion: number | null;
}

/**
 * readTranscript 依赖返回的 transcript 结构：复用 headless-threads 的
 * exportTranscript 形状（HeadlessThreadTranscript），relay 层只读不改。
 */
export interface RelayTranscriptSnapshotInput {
  threadId: string;
  title: string | null;
  status: HeadlessThreadStatus;
  messages: HeadlessTranscriptMessage[];
  finalAssistantText: string;
  usage: HeadlessThreadUsage;
  terminalError: HeadlessThreadMessageError | null;
}

/**
 * 应用快照的输入（POST /snapshot 的 body）：messages 为必需字段，
 * 其余字段可缺省（resume 增量快照只携带单条 turn）。
 */
export interface RelaySnapshotInput {
  threadId: string;
  version: number;
  title?: string | null;
  status?: HeadlessThreadStatus;
  messages: HeadlessTranscriptMessage[];
  finalAssistantText?: string;
  usage?: HeadlessThreadUsage;
  terminalError?: HeadlessThreadMessageError | null;
  source?: string;
  createdAt?: number;
}
