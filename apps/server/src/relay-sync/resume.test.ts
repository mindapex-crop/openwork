import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { HeadlessThreadTranscript, HeadlessTranscriptMessage } from "@openwork/headless-threads";
import { openRuntimeSqliteDatabase, type RuntimeSqliteDatabase } from "../runtime-db.js";
import { RelayResumeQueue } from "./resume.js";
import { RelaySyncService } from "./service.js";
import { SqliteRelaySyncStore } from "./store.js";
import type { RelayTranscriptSnapshot } from "./types.js";

const ROOTS: string[] = [];
const DBS: RuntimeSqliteDatabase[] = [];

afterEach(async () => {
  while (DBS.length) DBS.pop()?.close();
  while (ROOTS.length) {
    const root = ROOTS.pop();
    if (root) await rm(root, { recursive: true, force: true });
  }
});

async function openDb(): Promise<RuntimeSqliteDatabase> {
  const root = await mkdtemp(join(tmpdir(), "openwork-relay-resume-"));
  ROOTS.push(root);
  const db = await openRuntimeSqliteDatabase(join(root, "relay.sqlite"));
  DBS.push(db);
  return db;
}

function turn(id: string, createdAt: number, text: string, role = "user"): HeadlessTranscriptMessage {
  return { id, role, createdAt, text, reasoning: "", toolCalls: [] };
}

function makeService(
  db: RuntimeSqliteDatabase,
  source: string,
  messages: HeadlessTranscriptMessage[],
): RelaySyncService {
  const readTranscript = async (threadId: string): Promise<HeadlessThreadTranscript> => ({
    threadId,
    title: "Refund policy",
    status: { type: "idle" },
    messages,
    finalAssistantText: [...messages].reverse().find((message) => message.role === "assistant")?.text ?? "",
    usage: { inputTokens: 0, outputTokens: 0, reasoningTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, cost: 0 },
    terminalError: null,
  });
  return new RelaySyncService({ store: new SqliteRelaySyncStore(db), readTranscript, source });
}

describe("RelayResumeQueue", () => {
  test("flushes pending entries in order after reconnection (offline -> recovery)", async () => {
    // 发送端（local）与接收端（cloud）各自独立的 sqlite 存储。
    const senderDb = await openDb();
    const receiverDb = await openDb();
    const senderMessages: HeadlessTranscriptMessage[] = [
      turn("u1", 100, "hello"),
      turn("a1", 200, "hi"),
    ];
    const receiverMessages: HeadlessTranscriptMessage[] = [];
    const sender = makeService(senderDb, "local", senderMessages);
    const receiver = makeService(receiverDb, "cloud", receiverMessages);

    // 发送端生成快照：两个新 turns 进入 outgoing pending 队列。
    await sender.threadSnapshot("ses_1");
    expect(sender.syncStatus("ses_1").pendingCount).toBe(2);

    // 断网：推送失败，队列保持 pending，不丢数据。
    const queue = new RelayResumeQueue(sender);
    const offlinePush = async () => {
      throw new Error("network down");
    };
    const offline = await queue.flush("ses_1", offlinePush);
    expect(offline.pushed).toBe(0);
    expect(offline.failed).toBe(2);
    expect(offline.failedAtVersion).toBe(1);
    expect(sender.syncStatus("ses_1").pendingCount).toBe(2);

    // 恢复：按版本顺序回放（增量快照逐条推送），接收端合并。
    const pushedVersions: number[] = [];
    const onlinePush = async (snapshot: RelayTranscriptSnapshot) => {
      pushedVersions.push(snapshot.version);
      receiverMessages.push(...snapshot.messages);
      receiver.applySnapshot("ses_1", snapshot);
    };
    const online = await queue.flush("ses_1", onlinePush);
    expect(online.pushed).toBe(2);
    expect(online.failed).toBe(0);
    expect(pushedVersions).toEqual([1, 2]);

    // 发送端队列清空，已发送计数更新。
    const senderStatus = sender.syncStatus("ses_1");
    expect(senderStatus.pendingCount).toBe(0);
    expect(senderStatus.sentCount).toBe(2);

    // 接收端通过增量快照重建完整 transcript。
    const receiverStatus = receiver.syncStatus("ses_1");
    expect(receiverStatus.localVersion).toBe(2);
    expect(receiverStatus.remoteVersion).toBe(2);
    const receiverSnapshot = await receiver.threadSnapshot("ses_1");
    expect(receiverSnapshot.messages.map((message) => message.id)).toEqual(["u1", "a1"]);
  });

  test("stops replay at the first failed entry and resumes from there later", async () => {
    const senderDb = await openDb();
    const receiverDb = await openDb();
    const senderMessages: HeadlessTranscriptMessage[] = [
      turn("u1", 100, "hello"),
      turn("a1", 200, "hi"),
      turn("u2", 300, "follow up"),
    ];
    const receiverMessages: HeadlessTranscriptMessage[] = [];
    const sender = makeService(senderDb, "local", senderMessages);
    const receiver = makeService(receiverDb, "cloud", receiverMessages);
    await sender.threadSnapshot("ses_1");
    expect(sender.syncStatus("ses_1").pendingCount).toBe(3);

    const queue = new RelayResumeQueue(sender);
    // 只在 version 2 注入一次失败：第一条成功、第二条失败、第三条不推。
    const flakyPush = async (snapshot: RelayTranscriptSnapshot) => {
      if (snapshot.version === 2) throw new Error("flaky network");
      receiverMessages.push(...snapshot.messages);
      receiver.applySnapshot("ses_1", snapshot);
    };

    // 第一条成功，第二条失败 -> 回放停止，第三条不推。
    const first = await queue.flush("ses_1", flakyPush);
    expect(first.pushed).toBe(1);
    expect(first.failed).toBe(2);
    expect(first.failedAtVersion).toBe(2);
    expect(sender.syncStatus("ses_1").pendingCount).toBe(2);

    // 网络恢复 -> 从失败处继续，顺序不重不漏。
    const versions: number[] = [];
    const recoveryPush = async (snapshot: RelayTranscriptSnapshot) => {
      versions.push(snapshot.version);
      receiverMessages.push(...snapshot.messages);
      receiver.applySnapshot("ses_1", snapshot);
    };
    const second = await queue.flush("ses_1", recoveryPush);
    expect(second.pushed).toBe(2);
    expect(versions).toEqual([2, 3]);
    expect(sender.syncStatus("ses_1").pendingCount).toBe(0);
    expect(receiver.syncStatus("ses_1").localVersion).toBe(3);
  });

  test("flush with an empty queue is a no-op", async () => {
    const db = await openDb();
    const sender = makeService(db, "local", []);
    const queue = new RelayResumeQueue(sender);
    const result = await queue.flush("ses_1", async () => {});
    expect(result).toEqual({ threadId: "ses_1", pushed: 0, failed: 0, failedAtVersion: null });
  });
});
