import { describe, expect, test } from "bun:test";
import type { HeadlessTranscriptMessage } from "@openwork/headless-threads";
import { mergeTranscriptMessages } from "./merge.js";

function turn(id: string, createdAt: number | null, text: string, role = "user"): HeadlessTranscriptMessage {
  return { id, role, createdAt, text, reasoning: "", toolCalls: [] };
}

describe("mergeTranscriptMessages", () => {
  test("appends remote-only turns in chronological order", () => {
    const result = mergeTranscriptMessages({
      localVersion: 2,
      localMessages: [turn("u1", 100, "hello"), turn("a1", 200, "hi")],
      remoteVersion: 4,
      remoteMessages: [
        turn("u1", 100, "hello"),
        turn("a1", 200, "hi"),
        turn("u2", 300, "follow up"),
        turn("a2", 400, "reply"),
      ],
    });

    expect(result.messages.map((m) => m.id)).toEqual(["u1", "a1", "u2", "a2"]);
    expect(result.added.map((m) => m.id)).toEqual(["u2", "a2"]);
    expect(result.conflicts).toEqual([]);
  });

  test("identical message sets merge to a no-op", () => {
    const messages = [turn("u1", 100, "hello"), turn("a1", 200, "hi")];
    const result = mergeTranscriptMessages({
      localVersion: 2,
      localMessages: messages,
      remoteVersion: 2,
      remoteMessages: messages,
    });

    expect(result.messages).toEqual(messages);
    expect(result.added).toEqual([]);
    expect(result.conflicts).toEqual([]);
  });

  test("concurrent additions from both sides are both kept", () => {
    const result = mergeTranscriptMessages({
      localVersion: 3,
      localMessages: [turn("u1", 100, "hello"), turn("a1", 200, "hi"), turn("u2", 250, "local new turn")],
      remoteVersion: 3,
      remoteMessages: [turn("u1", 100, "hello"), turn("a1", 200, "hi"), turn("u3", 260, "remote new turn")],
    });

    expect(result.messages.map((m) => m.id)).toEqual(["u1", "a1", "u2", "u3"]);
    expect(result.added.map((m) => m.id)).toEqual(["u3"]);
    expect(result.conflicts).toEqual([]);
  });

  test("same-id conflict resolves to the newer remote version", () => {
    const result = mergeTranscriptMessages({
      localVersion: 2,
      localMessages: [turn("u1", 100, "hello"), turn("a1", 200, "old answer")],
      remoteVersion: 5,
      remoteMessages: [turn("u1", 100, "hello"), turn("a1", 200, "revised answer")],
    });

    expect(result.messages.find((m) => m.id === "a1")?.text).toBe("revised answer");
    expect(result.conflicts).toEqual([{ id: "a1", winner: "remote", reason: "newer_version" }]);
    expect(result.added).toEqual([]);
  });

  test("same-id conflict keeps the local turn when the local version is newer", () => {
    const result = mergeTranscriptMessages({
      localVersion: 6,
      localMessages: [turn("u1", 100, "hello"), turn("a1", 200, "local answer")],
      remoteVersion: 3,
      remoteMessages: [turn("u1", 100, "hello"), turn("a1", 200, "stale answer")],
    });

    expect(result.messages.find((m) => m.id === "a1")?.text).toBe("local answer");
    expect(result.conflicts).toEqual([{ id: "a1", winner: "local", reason: "newer_version" }]);
  });

  test("same-id conflict with equal versions keeps the local turn and reports same_version_conflict", () => {
    const result = mergeTranscriptMessages({
      localVersion: 4,
      localMessages: [turn("u1", 100, "hello"), turn("a1", 200, "local answer")],
      remoteVersion: 4,
      remoteMessages: [turn("u1", 100, "hello"), turn("a1", 200, "different answer")],
    });

    expect(result.messages.find((m) => m.id === "a1")?.text).toBe("local answer");
    expect(result.conflicts).toEqual([{ id: "a1", winner: "local", reason: "same_version_conflict" }]);
  });

  test("sorts stable by createdAt and falls back to message id", () => {
    const result = mergeTranscriptMessages({
      localVersion: 1,
      localMessages: [turn("b", 100, "second-by-id")],
      remoteVersion: 2,
      remoteMessages: [
        turn("a", 100, "first-by-id"),
        turn("b", 100, "second-by-id"),
        turn("c", null, "no-timestamp"),
      ],
    });

    // null createdAt 按 0 处理，排在最前；同时间戳按 id 排序。
    expect(result.messages.map((m) => m.id)).toEqual(["c", "a", "b"]);
  });

  test("handles duplicate ids inside the remote message set by keeping the last occurrence", () => {
    const result = mergeTranscriptMessages({
      localVersion: 1,
      localMessages: [],
      remoteVersion: 3,
      remoteMessages: [turn("u1", 100, "first"), turn("u1", 100, "second")],
    });

    expect(result.messages.map((m) => m.id)).toEqual(["u1"]);
    expect(result.messages[0]?.text).toBe("second");
    expect(result.added.map((m) => m.id)).toEqual(["u1"]);
  });
});
