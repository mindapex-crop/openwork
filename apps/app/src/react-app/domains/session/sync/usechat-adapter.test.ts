declare const describe: (name: string, fn: () => void) => void;
declare const test: (name: string, fn: () => void) => void;
declare const expect: (value: unknown) => {
  toBe: (expected: unknown) => void;
  toHaveLength: (length: number) => void;
  toBeUndefined: () => void;
};

import { snapshotToUIMessages } from "./usechat-adapter";
import type { OpenworkSessionSnapshot } from "@/app/lib/openwork-server";

function makeSnapshot(messages: OpenworkSessionSnapshot["messages"]): OpenworkSessionSnapshot {
  return {
    session: {
      id: "s1",
      title: "t",
      directory: "/tmp",
      slug: "",
      projectID: "",
      version: "",
      time: { created: 1, updated: 1 },
    },
    messages,
    todos: [],
    status: { type: "idle" },
  } as unknown as OpenworkSessionSnapshot;
}

describe("snapshotToUIMessages — CLI agent 归属透传", () => {
  test("assistant 消息携带 agent 时写入 metadata.opencode.agent", () => {
    const uiMessages = snapshotToUIMessages(
      makeSnapshot([
        {
          info: { id: "m1", sessionID: "s1", role: "assistant", agent: "kimi", time: { created: 100 } } as never,
          parts: [{ id: "p1", messageID: "m1", sessionID: "s1", type: "text", text: "hello" }] as never,
        },
      ]),
    );
    expect(uiMessages).toHaveLength(1);
    const metadata = uiMessages[0].metadata as { opencode?: { agent?: string; created?: number } };
    expect(metadata.opencode?.agent).toBe("kimi");
    expect(metadata.opencode?.created).toBe(100);
  });

  test("user 消息携带 agent 时同样透传", () => {
    const uiMessages = snapshotToUIMessages(
      makeSnapshot([
        {
          info: { id: "m2", sessionID: "s1", role: "user", agent: "claude-code", time: { created: 200 } } as never,
          parts: [{ id: "p2", messageID: "m2", sessionID: "s1", type: "text", text: "do it" }] as never,
        },
      ]),
    );
    const metadata = uiMessages[0].metadata as { opencode?: { agent?: string } };
    expect(metadata.opencode?.agent).toBe("claude-code");
  });

  test("无 agent 的消息不写入 agent 键", () => {
    const uiMessages = snapshotToUIMessages(
      makeSnapshot([
        {
          info: { id: "m3", sessionID: "s1", role: "assistant", time: { created: 300 } } as never,
          parts: [{ id: "p3", messageID: "m3", sessionID: "s1", type: "text", text: "ok" }] as never,
        },
      ]),
    );
    const metadata = uiMessages[0].metadata as { opencode?: { agent?: string; created?: number } };
    expect(metadata.opencode?.created).toBe(300);
    expect(metadata.opencode?.agent).toBeUndefined();
  });
});
