/**
 * Relay Sync 离线快照与续传。
 *
 * 发送端离线时的 pending 队列由 threadSnapshot 写入（outgoing/pending 条目），
 * 本模块负责"恢复后自动续传"：按 version 升序顺序回放 pending 条目，
 * 逐条组装增量快照推送给对端，成功后标记 sent；失败即停（等待下次 flush），
 * 保证顺序回放不丢不乱。
 */

import type { RelaySyncService } from "./service.js";
import type { RelayFlushResult, RelayTranscriptSnapshot } from "./types.js";

export type RelayPushTransport = (snapshot: RelayTranscriptSnapshot) => Promise<void>;

export class RelayResumeQueue {
  constructor(private readonly service: RelaySyncService) {}

  /**
   * 顺序回放待续传队列。push 抛错即停止回放，返回失败位置；
   * 调用方可在网络恢复后再次调用 flush 完成剩余条目。
   */
  async flush(threadId: string, push: RelayPushTransport): Promise<RelayFlushResult> {
    const pending = this.service.pendingOutgoing(threadId);
    let pushed = 0;
    for (const entry of pending) {
      const snapshot = this.service.snapshotForEntry(threadId, entry);
      try {
        await push(snapshot);
      } catch {
        return {
          threadId,
          pushed,
          failed: pending.length - pushed,
          failedAtVersion: entry.version,
        };
      }
      this.service.markOutgoingSent(threadId, [entry.entryId]);
      pushed += 1;
    }
    return { threadId, pushed, failed: 0, failedAtVersion: null };
  }
}
