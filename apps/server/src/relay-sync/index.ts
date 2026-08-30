/**
 * Relay Sync（接力同步）模块出口。
 *
 * 产品概念"接力同步"= Relay Sync，与 apps/server/src/chat/chat-relay.ts 的
 * agent @mention 接力是不同概念。
 */

export { mergeTranscriptMessages } from "./merge.js";
export type {
  RelayMergeConflict,
  RelayMergeConflictReason,
  RelayMergeInput,
  RelayMergeResult,
} from "./merge.js";
export { RelayResumeQueue } from "./resume.js";
export type { RelayPushTransport } from "./resume.js";
export { RelaySyncService } from "./service.js";
export type { RelaySyncServiceOptions } from "./service.js";
export { SqliteRelaySyncStore } from "./store.js";
export type { RelaySyncStore } from "./store.js";
export type {
  RelayApplyResult,
  RelayEntryDirection,
  RelayEntryKind,
  RelayEntryRecord,
  RelayEntryState,
  RelayFlushResult,
  RelayRelayResult,
  RelaySnapshotInput,
  RelaySyncDirection,
  RelaySyncStatus,
  RelayThreadRecord,
  RelayTranscriptSnapshot,
  RelayTranscriptSnapshotInput,
} from "./types.js";
