import { describe, expect, test } from "bun:test";

import {
  buildCliSessionInfo,
  buildCliSessionMessages,
  buildCliSessionSnapshot,
  resolveParentId,
  upsertAssistantChunk,
  type CliSessionRecord,
  type CliStoredMessage,
} from "./cli-agent-session.js";

function makeMessage(id: string, agent: string, role = "assistant"): CliStoredMessage {
  return {
    info: {
      id,
      sessionID: "s1",
      role,
      parentID: null,
      agent,
      time: { created: 1 },
    },
    parts: [],
  };
}

function makeRecord(messages: CliStoredMessage[], runningAgents: string[] = []): CliSessionRecord {
  return {
    workspaceId: "w1",
    sessionId: "s1",
    agentId: "kimi",
    title: "多 agent 会话",
    createdAt: 1,
    updatedAt: 2,
    runningAgents: new Set(runningAgents),
    agentErrors: {},
    messages,
  };
}

describe("resolveParentId — 多 agent 同窗口线程串联", () => {
  test("空会话返回 null", () => {
    expect(resolveParentId(makeRecord([]), "kimi")).toBeNull();
  });

  test("同一 agent 的消息串联到该 agent 自己的最后一条", () => {
    const record = makeRecord([
      makeMessage("kimi-u1", "kimi", "user"),
      makeMessage("kimi-a1", "kimi"),
      makeMessage("claude-u1", "claude-code", "user"),
      makeMessage("claude-a1", "claude-code"),
    ]);
    // kimi 的新回合应接到 kimi-a1（而不是全局最后一条 claude-a1）
    expect(resolveParentId(record, "kimi")).toBe("kimi-a1");
    expect(resolveParentId(record, "claude-code")).toBe("claude-a1");
  });

  test("并行交错时各 agent 线程互不干扰", () => {
    const record = makeRecord([
      makeMessage("kimi-u1", "kimi", "user"),
      makeMessage("kimi-a1", "kimi"),
      makeMessage("claude-u1", "claude-code", "user"),
      makeMessage("claude-a1", "claude-code"),
      makeMessage("kimi-u2", "kimi", "user"),
      makeMessage("kimi-a2", "kimi"),
    ]);
    // 全局最后是 kimi-a2，claude 应仍接自己的 claude-a1
    expect(resolveParentId(record, "claude-code")).toBe("claude-a1");
    expect(resolveParentId(record, "kimi")).toBe("kimi-a2");
  });

  test("尚无消息的 agent 回落到全局最后一条", () => {
    const record = makeRecord([
      makeMessage("kimi-u1", "kimi", "user"),
      makeMessage("kimi-a1", "kimi"),
    ]);
    expect(resolveParentId(record, "codex")).toBe("kimi-a1");
  });
});

describe("buildCliSessionInfo — 多 agent 元数据", () => {
  test("暴露 cli 标记、参与 agent 列表与正在运行的 agent", () => {
    const record = makeRecord(
      [
        makeMessage("kimi-u1", "kimi", "user"),
        makeMessage("kimi-a1", "kimi"),
        makeMessage("claude-u1", "claude-code", "user"),
        makeMessage("claude-a1", "claude-code"),
      ],
      ["claude-code"],
    );
    const info = buildCliSessionInfo(record);
    expect(info.id).toBe("s1");
    expect(info.agent).toBe("kimi");
    expect(info.metadata).toEqual({
      cli: true,
      agents: ["kimi", "claude-code"],
      runningAgents: ["claude-code"],
    });
  });

  test("参与 agent 去重且保持出现顺序", () => {
    const record = makeRecord([
      makeMessage("a-u1", "kimi", "user"),
      makeMessage("a1", "kimi"),
      makeMessage("b-u1", "codex", "user"),
      makeMessage("b1", "codex"),
      makeMessage("a-u2", "kimi", "user"),
      makeMessage("a2", "kimi"),
    ]);
    const info = buildCliSessionInfo(record);
    expect(info.metadata?.agents).toEqual(["kimi", "codex"]);
  });
});

describe("buildCliSessionMessages — 消息保留 agent 归属", () => {
  test("info.agent 原样透传", () => {
    const record = makeRecord([
      makeMessage("kimi-u1", "kimi", "user"),
      makeMessage("claude-a1", "claude-code"),
    ]);
    const messages = buildCliSessionMessages(record);
    expect(messages).toHaveLength(2);
    expect(messages[0].info.agent).toBe("kimi");
    expect(messages[1].info.agent).toBe("claude-code");
  });
});

describe("buildCliSessionSnapshot — 任一 agent 运行即 busy", () => {
  test("无 agent 运行时 idle", () => {
    const snapshot = buildCliSessionSnapshot(makeRecord([makeMessage("a1", "kimi")]));
    expect(snapshot.status).toEqual({ type: "idle" });
  });

  test("任一 agent 运行时 busy（并行场景）", () => {
    const snapshot = buildCliSessionSnapshot(
      makeRecord([makeMessage("a1", "kimi")], ["kimi", "claude-code"]),
    );
    expect(snapshot.status).toEqual({ type: "busy" });
  });
});

describe("upsertAssistantChunk — 流式增量累积", () => {
  function makeAssistant(): CliStoredMessage {
    return {
      info: {
        id: "assistant-1",
        sessionID: "s1",
        role: "assistant",
        parentID: "user-1",
        agent: "kimi",
        time: { created: 1 },
      },
      parts: [],
    };
  }

  test("thinking 块累积进 reasoning part，且同类型只保留一份 part", () => {
    const message = makeAssistant();
    upsertAssistantChunk(message, "thinking", "我正在");
    upsertAssistantChunk(message, "thinking", "分析问题");
    expect(message.parts).toHaveLength(1);
    expect(message.parts[0]).toMatchObject({ type: "reasoning", text: "我正在分析问题" });
  });

  test("text 块累积进 text part，且同类型只保留一份 part", () => {
    const message = makeAssistant();
    upsertAssistantChunk(message, "text", "你好");
    upsertAssistantChunk(message, "text", "，世界");
    expect(message.parts).toHaveLength(1);
    expect(message.parts[0]).toMatchObject({ type: "text", text: "你好，世界" });
  });

  test("thinking 与 text 交错时分别进入两个 part（reasoning 在前）", () => {
    const message = makeAssistant();
    upsertAssistantChunk(message, "thinking", "思考a");
    upsertAssistantChunk(message, "text", "回答a");
    upsertAssistantChunk(message, "thinking", "思考b");
    upsertAssistantChunk(message, "text", "回答b");
    expect(message.parts.map((part) => part.type)).toEqual(["reasoning", "text"]);
    expect(message.parts[0].text).toBe("思考a思考b");
    expect(message.parts[1].text).toBe("回答a回答b");
  });

  test("part 携带 messageID/sessionID 归属，便于快照路由", () => {
    const message = makeAssistant();
    upsertAssistantChunk(message, "text", "hi");
    expect(message.parts[0]).toMatchObject({
      messageID: "assistant-1",
      sessionID: "s1",
      type: "text",
      text: "hi",
    });
  });
});
