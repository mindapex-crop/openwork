import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
  INITIAL_STATES,
  applyTransition,
  completeConnect,
  completeConnectFromConfig,
  connectedCount,
  formatStatusLabel,
  formatStatusTone,
  platformWorkspaceLabel,
  requestConnect,
  requestDisconnect,
  statesFromServerConfigs,
  type ImConnectorState,
} from "../src/react-app/domains/settings/im-connector-state";
import { setLocale } from "../src/i18n";

type Platform = (typeof INITIAL_STATES)[number]["id"];

function cloneStates(): typeof INITIAL_STATES {
  return INITIAL_STATES.map((s) => ({ ...s }));
}

describe("IM connector initial state", () => {
  test("all five platforms present and disconnected", () => {
    expect(INITIAL_STATES.map((s) => s.id)).toEqual([
      "feishu",
      "wecom",
      "dingtalk",
      "slack",
      "discord",
    ]);
    expect(INITIAL_STATES.every((s) => s.status === "disconnected")).toBe(true);
  });
});

describe("requestConnect", () => {
  test("transitions target from disconnected to connecting", () => {
    const state = { id: "feishu" as Platform, status: "disconnected" as const };
    expect(requestConnect(state, "feishu").status).toBe("connecting");
  });

  test("does not mutate the original state object", () => {
    const state = { id: "feishu" as Platform, status: "disconnected" as const };
    requestConnect(state, "feishu");
    expect(state.status).toBe("disconnected");
  });

  test("leaves other platforms unchanged", () => {
    const state = { id: "wecom" as Platform, status: "disconnected" as const };
    expect(requestConnect(state, "feishu").status).toBe("disconnected");
  });

  test("is idempotent while already connecting (does not regress)", () => {
    const state = { id: "feishu" as Platform, status: "connecting" as const };
    expect(requestConnect(state, "feishu").status).toBe("connecting");
  });
});

describe("completeConnect", () => {
  test("transitions connecting → connected with metadata", () => {
    const state = { id: "feishu" as Platform, status: "connecting" as const };
    const result = completeConnect(state, "feishu");
    expect(result.status).toBe("connected");
    expect(result.workspace).toBe("OpenWork 工作区");
    expect(result.botName).toBe("OpenWork Bot");
    expect(typeof result.lastSyncAt).toBe("string");
    expect(result.lastSyncAt!.length).toBeGreaterThan(0);
  });

  test("non-feishu gets 'Demo Team' workspace", () => {
    const state = { id: "slack" as Platform, status: "connecting" as const };
    const result = completeConnect(state, "slack");
    expect(result.workspace).toBe("Demo Team");
  });

  test("ignores requests for other platforms", () => {
    const state = { id: "wecom" as Platform, status: "connecting" as const };
    expect(completeConnect(state, "feishu").status).toBe("connecting");
  });

  test("rejects completion when not currently connecting (no regression)", () => {
    const state = { id: "feishu" as Platform, status: "disconnected" as const };
    expect(completeConnect(state, "feishu").status).toBe("disconnected");

    const connected = { id: "feishu" as Platform, status: "connected" as const };
    expect(completeConnect(connected, "feishu").status).toBe("connected");
  });
});

describe("requestDisconnect", () => {
  test("resets connected → disconnected, stripping metadata", () => {
    const state = {
      id: "feishu" as Platform,
      status: "connected" as const,
      workspace: "Test WS",
      botName: "Bot",
      lastSyncAt: "2024-01-01",
    };
    const result = requestDisconnect(state, "feishu");
    expect(result).toEqual({ id: "feishu", status: "disconnected" });
  });

  test("resets connecting → disconnected", () => {
    const state = { id: "wecom" as Platform, status: "connecting" as const };
    expect(requestDisconnect(state, "wecom").status).toBe("disconnected");
  });

  test("ignores requests for other platforms", () => {
    const state = { id: "wecom" as Platform, status: "connected" as const };
    expect(requestDisconnect(state, "feishu").status).toBe("connected");
  });
});

describe("applyTransition on full state list", () => {
  test("connect: only target becomes connecting, others unchanged", () => {
    const states = cloneStates();
    const result = applyTransition(states, "feishu", "connect");
    expect(result.find((s) => s.id === "feishu")!.status).toBe("connecting");
    expect(result.find((s) => s.id === "wecom")!.status).toBe("disconnected");
    expect(result.find((s) => s.id === "slack")!.status).toBe("disconnected");
  });

  test("complete: only in-flight target transitions to connected", () => {
    const states = [
      { id: "feishu" as Platform, status: "connecting" as const },
      { id: "wecom" as Platform, status: "disconnected" as const },
      { id: "slack" as Platform, status: "connecting" as const },
    ];
    const result = applyTransition(states, "feishu", "complete");
    expect(result.find((s) => s.id === "feishu")!.status).toBe("connected");
    expect(result.find((s) => s.id === "wecom")!.status).toBe("disconnected");
    expect(result.find((s) => s.id === "slack")!.status).toBe("connecting");
  });

  test("disconnect: resets target, preserves others", () => {
    const states = [
      { id: "feishu" as Platform, status: "connected" as const, workspace: "WS" },
      { id: "wecom" as Platform, status: "connected" as const, workspace: "WS" },
    ];
    const result = applyTransition(states, "feishu", "disconnect");
    expect(result.find((s) => s.id === "feishu")).toEqual({
      id: "feishu",
      status: "disconnected",
    });
    expect(result.find((s) => s.id === "wecom")!.status).toBe("connected");
  });

  test("array length preserved", () => {
    const states = cloneStates();
    expect(applyTransition(states, "feishu", "connect").length).toBe(5);
    expect(applyTransition(states, "feishu", "complete").length).toBe(5);
    expect(applyTransition(states, "feishu", "disconnect").length).toBe(5);
  });
});

describe("connectedCount", () => {
  test("returns 0 for all disconnected", () => {
    expect(connectedCount(INITIAL_STATES)).toBe(0);
  });

  test("returns correct count", () => {
    const states = [
      { id: "feishu" as Platform, status: "connected" as const },
      { id: "wecom" as Platform, status: "connected" as const },
      { id: "slack" as Platform, status: "connecting" as const },
      { id: "discord" as Platform, status: "disconnected" as const },
    ];
    expect(connectedCount(states)).toBe(2);
  });
});

describe("formatStatusLabel", () => {
  beforeAll(() => {
    // 状态文案跟随当前 locale；该面板按中文环境断言。
    setLocale("zh");
  });
  afterAll(() => {
    // 复位全局 locale，避免污染同进程内其他测试（默认应为 en）。
    setLocale("en");
  });

  test.each([
    ["connected", "已连接"],
    ["connecting", "连接中"],
    ["disconnected", "未连接"],
  ] as const)("%s → %s", (status, expected) => {
    expect(formatStatusLabel(status)).toBe(expected);
  });
});

describe("formatStatusTone", () => {
  test.each([
    ["connected", "default"],
    ["connecting", "outline"],
    ["disconnected", "secondary"],
  ] as const)("%s → %s", (status, expected) => {
    expect(formatStatusTone(status)).toBe(expected);
  });
});

describe("full connect→complete→disconnect lifecycle", () => {
  test("feishu full round trip", () => {
    let states = cloneStates();

    states = applyTransition(states, "feishu", "connect");
    expect(states.find((s) => s.id === "feishu")!.status).toBe("connecting");

    states = applyTransition(states, "feishu", "complete");
    expect(states.find((s) => s.id === "feishu")!.status).toBe("connected");
    expect(connectedCount(states)).toBe(1);

    states = applyTransition(states, "feishu", "disconnect");
    expect(states.find((s) => s.id === "feishu")!.status).toBe("disconnected");
    expect(connectedCount(states)).toBe(0);
  });

  test("multiple platforms connect simultaneously", () => {
    let states = cloneStates();

    states = applyTransition(states, "feishu", "connect");
    states = applyTransition(states, "slack", "connect");
    states = applyTransition(states, "dingtalk", "connect");

    expect(states.filter((s) => s.status === "connecting").length).toBe(3);

    states = applyTransition(states, "feishu", "complete");
    states = applyTransition(states, "slack", "complete");
    expect(connectedCount(states)).toBe(2);

    states = applyTransition(states, "dingtalk", "complete");
    expect(connectedCount(states)).toBe(3);
  });

  test("disconnect then reconnect works", () => {
    let states = cloneStates();
    states = applyTransition(states, "feishu", "connect");
    states = applyTransition(states, "feishu", "complete");
    states = applyTransition(states, "feishu", "disconnect");
    states = applyTransition(states, "feishu", "connect");
    states = applyTransition(states, "feishu", "complete");

    expect(states.find((s) => s.id === "feishu")!.status).toBe("connected");
  });
});

describe("edge cases", () => {
  test("unknown platform string handled gracefully via exhaustive types (compile-time only)", () => {
    expect(() => applyTransition(INITIAL_STATES, "feishu", "connect")).not.toThrow();
  });

  test("empty state list", () => {
    expect(applyTransition([], "feishu", "connect")).toEqual([]);
    expect(connectedCount([])).toBe(0);
  });
});

describe("statesFromServerConfigs (后端配置 → UI 状态)", () => {
  test("enabled server configs map to connected states, preserving 5-platform order", () => {
    const states = statesFromServerConfigs([
      { channelId: "slack", webhookUrl: "https://hooks.slack.com/T123", enabled: true, updatedAt: 1_700_000_000_000 },
      { channelId: "feishu", webhookUrl: "https://open.feishu.cn/hook", enabled: true, updatedAt: 1_700_000_000_000 },
    ]);
    expect(states.length).toBe(5);
    expect(states.map((s) => s.id)).toEqual(["feishu", "wecom", "dingtalk", "slack", "discord"]);
    expect(states.find((s) => s.id === "feishu")!.status).toBe("connected");
    expect(states.find((s) => s.id === "feishu")!.workspace).toBe("OpenWork 工作区");
    expect(states.find((s) => s.id === "slack")!.status).toBe("connected");
    expect(states.find((s) => s.id === "slack")!.workspace).toBe("Demo Team");
    expect(states.find((s) => s.id === "wecom")!.status).toBe("disconnected");
    expect(connectedCount(states)).toBe(2);
  });

  test("disabled or missing configs stay disconnected", () => {
    const states = statesFromServerConfigs([
      { channelId: "wecom", webhookUrl: "https://qyapi.weixin.qq.com/hook", enabled: false, updatedAt: 0 },
    ]);
    expect(states.every((s) => s.status === "disconnected")).toBe(true);
    expect(statesFromServerConfigs([]).every((s) => s.status === "disconnected")).toBe(true);
  });

  test("empty configs produce fully disconnected initial state", () => {
    expect(statesFromServerConfigs([])).toEqual(INITIAL_STATES);
  });
});

describe("completeConnectFromConfig (连接成功后更新)", () => {
  test("connecting → connected with server-provided metadata", () => {
    const states = [{ id: "slack", status: "connecting" }] as ImConnectorState[];
    const result = completeConnectFromConfig(states, "slack", {
      channelId: "slack",
      webhookUrl: "https://hooks.slack.com/T123",
      token: "tok",
      enabled: true,
      updatedAt: 1_700_000_000_000,
    });
    expect(result[0]!.status).toBe("connected");
    expect(result[0]!.workspace).toBe("Demo Team");
    expect(result[0]!.botName).toBe("OpenWork Bot");
    expect(typeof result[0]!.lastSyncAt).toBe("string");
    expect(result[0]!.lastSyncAt!.length).toBeGreaterThan(0);
  });

  test("does not change non-connecting or other platforms", () => {
    const states = [
      { id: "feishu", status: "disconnected" },
      { id: "wecom", status: "connected", workspace: "WS" },
    ] as ImConnectorState[];
    const result = completeConnectFromConfig(states, "feishu", {
      channelId: "feishu",
      webhookUrl: "https://open.feishu.cn/hook",
      enabled: true,
      updatedAt: 0,
    });
    expect(result[0]!.status).toBe("disconnected");
    expect(result[1]!.status).toBe("connected");
    expect(result[1]!.workspace).toBe("WS");
  });
});

describe("platformWorkspaceLabel", () => {
  test("feishu gets the workspace label, others get Demo Team", () => {
    expect(platformWorkspaceLabel("feishu")).toBe("OpenWork 工作区");
    expect(platformWorkspaceLabel("wecom")).toBe("Demo Team");
    expect(platformWorkspaceLabel("dingtalk")).toBe("Demo Team");
    expect(platformWorkspaceLabel("slack")).toBe("Demo Team");
    expect(platformWorkspaceLabel("discord")).toBe("Demo Team");
  });
});