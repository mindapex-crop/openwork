import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { HeadlessThreadTranscript, HeadlessTranscriptMessage } from "@openwork/headless-threads";
import { openRuntimeSqliteDatabase, type RuntimeSqliteDatabase } from "../runtime-db.js";
import { RelaySyncService } from "./service.js";
import { SqliteRelaySyncStore } from "./store.js";
import type { RelayTranscriptSnapshotInput } from "./types.js";

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
  const root = await mkdtemp(join(tmpdir(), "openwork-relay-sync-"));
  ROOTS.push(root);
  const db = await openRuntimeSqliteDatabase(join(root, "relay.sqlite"));
  DBS.push(db);
  return db;
}

function turn(id: string, createdAt: number, text: string, role = "user"): HeadlessTranscriptMessage {
  return { id, role, createdAt, text, reasoning: "", toolCalls: [] };
}

function transcript(threadId: string, messages: HeadlessTranscriptMessage[]): RelayTranscriptSnapshotInput {
  const lastAssistant = [...messages].reverse().find((message) => message.role === "assistant");
  return {
    threadId,
    title: "Refund policy",
    status: { type: "idle" },
    messages,
    finalAssistantText: lastAssistant?.text ?? "",
    usage: { inputTokens: 0, outputTokens: 0, reasoningTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, cost: 0 },
    terminalError: null,
  };
}

function makeService(db: RuntimeSqliteDatabase, source: string, read: (id: string) => Promise<HeadlessThreadTranscript>) {
  return new RelaySyncService({ store: new SqliteRelaySyncStore(db), readTranscript: read, source });
}

function makeRead(messages: HeadlessTranscriptMessage[]) {
  return async (threadId: string): Promise<HeadlessThreadTranscript> =>
    transcript(threadId, messages) as HeadlessThreadTranscript;
}

describe("RelaySyncService.threadSnapshot", () => {
  test("generates a versioned snapshot and queues new turns as outgoing pending", async () => {
    const db = await openDb();
    const service = makeService(db, "local", makeRead([turn("u1", 100, "hello"), turn("a1", 200, "hi")]));

    const snapshot = await service.threadSnapshot("ses_1");
    expect(snapshot.version).toBe(2);
    expect(snapshot.source).toBe("local");
    expect(snapshot.messages.map((m) => m.id)).toEqual(["u1", "a1"]);

    const status = service.syncStatus("ses_1");
    expect(status.localVersion).toBe(2);
    expect(status.pendingCount).toBe(2);

    const changes = service.changeLog("ses_1", 0);
    expect(changes.map((entry) => entry.direction)).toEqual(["outgoing", "outgoing"]);
    expect(changes.map((entry) => entry.state)).toEqual(["pending", "pending"]);
    expect(changes.map((entry) => entry.kind)).toEqual(["turn", "turn"]);
  });

  test("repeated snapshot calls are idempotent and do not re-queue known turns", async () => {
    const db = await openDb();
    const service = makeService(db, "local", makeRead([turn("u1", 100, "hello"), turn("a1", 200, "hi")]));

    await service.threadSnapshot("ses_1");
    const second = await service.threadSnapshot("ses_1");
    expect(second.version).toBe(2);
    expect(service.syncStatus("ses_1").pendingCount).toBe(2);
  });

  test("a later transcript with new turns bumps the version and queues only the delta", async () => {
    const db = await openDb();
    let messages: HeadlessTranscriptMessage[] = [turn("u1", 100, "hello"), turn("a1", 200, "hi")];
    const service = makeService(db, "local", async (threadId) => transcript(threadId, messages) as HeadlessThreadTranscript);

    const first = await service.threadSnapshot("ses_1");
    expect(first.version).toBe(2);

    messages = [...messages, turn("u2", 300, "follow up"), turn("a2", 400, "reply")];
    const second = await service.threadSnapshot("ses_1");
    expect(second.version).toBe(4);

    const status = service.syncStatus("ses_1");
    expect(status.localVersion).toBe(4);
    expect(status.pendingCount).toBe(4);
  });
});

describe("RelaySyncService.applySnapshot", () => {
  test("merges remote-only turns and records incoming entries", async () => {
    const db = await openDb();
    const service = makeService(db, "local", makeRead([turn("u1", 100, "hello"), turn("a1", 200, "hi")]));
    await service.threadSnapshot("ses_1");

    const result = service.applySnapshot("ses_1", {
      threadId: "ses_1",
      version: 3,
      messages: [
        turn("u1", 100, "hello"),
        turn("a1", 200, "hi"),
        turn("u2", 300, "remote follow up"),
      ],
      source: "cloud",
    });

    expect(result.accepted).toBe(true);
    expect(result.merged).toBe(true);
    expect(result.addedCount).toBe(1);
    expect(result.conflicts).toEqual([]);
    expect(result.version).toBe(3);

    const status = service.syncStatus("ses_1");
    expect(status.remoteVersion).toBe(3);
    expect(status.lastSyncDirection).toBe("pull");

    const incoming = service.changeLog("ses_1", 0).filter((entry) => entry.direction === "incoming");
    expect(incoming.map((entry) => entry.message?.id)).toEqual(["u2"]);
    expect(incoming[0]?.state).toBe("applied");
  });

  test("applying the same snapshot again is idempotent", async () => {
    const db = await openDb();
    const service = makeService(db, "local", makeRead([turn("u1", 100, "hello")]));
    await service.threadSnapshot("ses_1");

    const snapshot = {
      threadId: "ses_1",
      version: 1,
      messages: [turn("u1", 100, "hello"), turn("a1", 200, "hi")],
      source: "cloud",
    };
    const first = service.applySnapshot("ses_1", snapshot);
    expect(first.addedCount).toBe(1);

    const second = service.applySnapshot("ses_1", snapshot);
    expect(second.accepted).toBe(true);
    expect(second.merged).toBe(false);
    expect(second.addedCount).toBe(0);
    expect(service.syncStatus("ses_1").remoteVersion).toBe(1);
  });

  test("rejects a stale snapshot whose version is older than the known remote version", async () => {
    const db = await openDb();
    const service = makeService(db, "local", makeRead([turn("u1", 100, "hello")]));
    await service.threadSnapshot("ses_1");

    service.applySnapshot("ses_1", {
      threadId: "ses_1",
      version: 5,
      messages: [turn("u1", 100, "hello"), turn("u2", 300, "new")],
    });

    const stale = service.applySnapshot("ses_1", {
      threadId: "ses_1",
      version: 3,
      messages: [turn("u1", 100, "hello"), turn("u2", 300, "new"), turn("u3", 400, "even newer")],
    });

    expect(stale.accepted).toBe(false);
    expect(stale.staleConflict).toBe(true);
  });

  test("concurrent writes from both sides keep every turn", async () => {
    const db = await openDb();
    const localMessages: HeadlessTranscriptMessage[] = [turn("u1", 100, "hello")];
    const service = makeService(db, "local", async (threadId) => transcript(threadId, localMessages) as HeadlessThreadTranscript);

    // 本地并发新增 u2，远端并发新增 a1/u3。
    const localSnapshot = await service.threadSnapshot("ses_1");
    expect(localSnapshot.version).toBe(1);

    const remoteResult = service.applySnapshot("ses_1", {
      threadId: "ses_1",
      version: 2,
      messages: [turn("u1", 100, "hello"), turn("a1", 200, "hi"), turn("u3", 300, "remote turn")],
    });
    expect(remoteResult.accepted).toBe(true);
    expect(remoteResult.addedCount).toBe(2);
    expect(remoteResult.conflicts).toEqual([]);

    // 合并后的基线包含双方全部 turns（本地 u1 + 远端 a1/u3）。
    const status = service.syncStatus("ses_1");
    expect(status.localVersion).toBe(3);
    expect(status.remoteVersion).toBe(2);

    // 远端 turns 落入 incoming entries；引擎侧 transcript 随后也包含它们。
    const incoming = service.changeLog("ses_1", 0).filter((entry) => entry.direction === "incoming");
    expect(incoming.map((entry) => entry.message?.id)).toEqual(["a1", "u3"]);
    localMessages.push(turn("a1", 200, "hi"), turn("u3", 300, "remote turn"));

    const snapshot = await service.threadSnapshot("ses_1");
    expect(snapshot.messages.map((m) => m.id)).toEqual(["u1", "a1", "u3"]);
    expect(snapshot.version).toBe(3);
  });

  test("resolves same-id conflicts by last-writer-wins", async () => {
    const db = await openDb();
    const localMessages: HeadlessTranscriptMessage[] = [turn("u1", 100, "hello"), turn("a1", 200, "local answer")];
    const service = makeService(db, "local", async (threadId) => transcript(threadId, localMessages) as HeadlessThreadTranscript);
    await service.threadSnapshot("ses_1");

    const result = service.applySnapshot("ses_1", {
      threadId: "ses_1",
      version: 9,
      messages: [turn("u1", 100, "hello"), turn("a1", 200, "remote revised answer")],
    });

    expect(result.conflict).toBe(true);
    expect(result.conflicts).toEqual([{ id: "a1", winner: "remote", reason: "newer_version" }]);
    expect(result.addedCount).toBe(0);

    // LWW：基线中的 a1 已被远端版本覆盖；引擎侧 transcript 随后也更新。
    localMessages[1] = turn("a1", 200, "remote revised answer");
    const snapshot = await service.threadSnapshot("ses_1");
    expect(snapshot.messages.find((m) => m.id === "a1")?.text).toBe("remote revised answer");
  });

  test("rejects a snapshot for a different thread id", async () => {
    const db = await openDb();
    const service = makeService(db, "local", makeRead([]));
    expect(() =>
      service.applySnapshot("ses_1", { threadId: "ses_other", version: 1, messages: [] }),
    ).toThrow(/threadId/);
  });
});

describe("RelaySyncService.changeLog / relay", () => {
  test("changeLog returns only entries newer than fromVersion", async () => {
    const db = await openDb();
    const service = makeService(db, "local", makeRead([turn("u1", 100, "hello"), turn("a1", 200, "hi")]));
    await service.threadSnapshot("ses_1");
    service.applySnapshot("ses_1", {
      threadId: "ses_1",
      version: 2,
      messages: [turn("u1", 100, "hello"), turn("a1", 200, "hi"), turn("u2", 300, "more")],
    });

    const since1 = service.changeLog("ses_1", 1);
    expect(since1.map((entry) => entry.version)).toEqual([2, 3]);
    const since3 = service.changeLog("ses_1", 3);
    expect(since3).toEqual([]);
  });

  test("relay marks a relay event and bumps the local version", async () => {
    const db = await openDb();
    const service = makeService(db, "local", makeRead([]));
    await service.threadSnapshot("ses_1");

    const result = service.relay("ses_1", { note: "cloud handoff" });
    expect(result.version).toBe(1);
    expect(result.note).toBe("cloud handoff");

    const status = service.syncStatus("ses_1");
    expect(status.relayEventCount).toBe(1);

    const events = service.changeLog("ses_1", 0).filter((entry) => entry.kind === "relay");
    expect(events).toHaveLength(1);
    expect(events[0]?.note).toBe("cloud handoff");
    expect(events[0]?.direction).toBe("outgoing");
  });

  test("syncStatus for an unknown thread reports zeros without creating a record", async () => {
    const db = await openDb();
    const service = makeService(db, "local", makeRead([]));
    expect(service.syncStatus("ses_missing")).toEqual({
      threadId: "ses_missing",
      localVersion: 0,
      remoteVersion: 0,
      pendingCount: 0,
      sentCount: 0,
      lastSyncedAt: null,
      lastSyncDirection: null,
      relayEventCount: 0,
      updatedAt: 0,
    });
  });
});
