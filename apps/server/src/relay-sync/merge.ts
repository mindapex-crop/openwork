/**
 * Relay Sync 冲突合并策略（纯函数，无 IO）。
 *
 * 规则（产品概念"接力同步"= Relay Sync，与 chat/chat-relay.ts 的 agent
 * @mention 接力是不同概念）：
 *
 * - 逐 turn 追加合并：按 turn id 去重，双方并发新增的 turn 都保留。
 * - 排序：按 createdAt 升序；时间相同（含 null）按 id 排序保证稳定。
 * - 同 id 冲突（两方都有同一 turn 但内容不同）：last-writer-wins，
 *   取版本新者（快照版本号更大的一方）；版本相同保留本地，标记
 *   same_version_conflict 供上层记录/展示。
 */

import type { HeadlessTranscriptMessage } from "@openwork/headless-threads";

export type RelayMergeConflictReason = "newer_version" | "same_version_conflict";

export interface RelayMergeConflict {
  id: string;
  winner: "local" | "remote";
  reason: RelayMergeConflictReason;
}

export interface RelayMergeResult {
  /** 合并后的完整消息集（按 createdAt 排序）。 */
  messages: HeadlessTranscriptMessage[];
  /** 来自 remote、本地原先没有的新 turn（按 remote 顺序）。 */
  added: HeadlessTranscriptMessage[];
  /** 同 id 冲突清单（内容不一致且双方都持有）。 */
  conflicts: RelayMergeConflict[];
}

export interface RelayMergeInput {
  localVersion: number;
  localMessages: HeadlessTranscriptMessage[];
  remoteVersion: number;
  remoteMessages: HeadlessTranscriptMessage[];
}

function messagesEqual(a: HeadlessTranscriptMessage, b: HeadlessTranscriptMessage): boolean {
  return (
    a.role === b.role &&
    a.createdAt === b.createdAt &&
    a.text === b.text &&
    a.reasoning === b.reasoning &&
    a.toolCalls.length === b.toolCalls.length &&
    a.toolCalls.every(
      (call, index) =>
        call.partId === b.toolCalls[index]?.partId &&
        call.name === b.toolCalls[index]?.name &&
        call.callId === b.toolCalls[index]?.callId &&
        call.status === b.toolCalls[index]?.status,
    )
  );
}

function compareByCreatedAt(a: HeadlessTranscriptMessage, b: HeadlessTranscriptMessage): number {
  const at = (a.createdAt ?? 0) - (b.createdAt ?? 0);
  if (at !== 0) return at;
  return a.id.localeCompare(b.id);
}

export function mergeTranscriptMessages(input: RelayMergeInput): RelayMergeResult {
  const merged = new Map<string, HeadlessTranscriptMessage>();
  for (const message of input.localMessages) merged.set(message.id, message);

  const added: HeadlessTranscriptMessage[] = [];
  const conflicts: RelayMergeConflict[] = [];

  for (const remote of input.remoteMessages) {
    const local = merged.get(remote.id);
    if (!local) {
      merged.set(remote.id, remote);
      added.push(remote);
      continue;
    }
    if (messagesEqual(local, remote)) continue;

    // 同 id 冲突：取版本新者（last-writer-wins）。版本号是快照级单调计数，
    // 数值更大的一方视为后写入者。版本相同时保留本地（应用方当前权威）。
    if (input.remoteVersion > input.localVersion) {
      merged.set(remote.id, remote);
      conflicts.push({ id: remote.id, winner: "remote", reason: "newer_version" });
    } else {
      conflicts.push({
        id: remote.id,
        winner: "local",
        reason: input.remoteVersion === input.localVersion ? "same_version_conflict" : "newer_version",
      });
    }
  }

  const messages = [...merged.values()].sort(compareByCreatedAt);
  return { messages, added, conflicts };
}
