/**
 * chat-relay.e2e.test.ts — Chat 桥接层真实环境验证（openspec-chat-bridge §5）
 *
 * 真实案例：
 * 1. 真实 bash 进程作为 headless agent，@mention 路由 → 真 spawn 系统命令 → 回复发到通道
 * 2. InMemoryChatChannel 真实消息消费
 * 3. 未知 agent fail-fast（真实服务逻辑，不静默）
 * 4. 未 @ 不响应
 * 5. 多 agent 接力（真实 ChatRelayService 对象 + 可控 adapter，验证集成链路）
 * 6. 接力深度限制（maxHandoffs=1）
 *
 * 运行: bun test src/chat/chat-relay.e2e.test.ts
 */

import { describe, expect, test } from "bun:test";
import { ChatRelayService } from "./chat-relay.js";
import { InMemoryChatChannel } from "./channels/in-memory.js";
import { GenericCliSidecarAdapter } from "../agent-sidecar/cli-adapter/generic-cli.js";
import type { AgentSidecarAdapter, AgentEvent, AgentSidecarConfig } from "../agent-sidecar/types.js";

/**
 * 真实 bash agent（pty 模式）：prompt 经 stdin 写入，bash 执行后 exit 结束。
 * 不声明 headless——bash 不是 LLM CLI，`bash -c hi` 冒烟会失败（见案例7 fail-fast）。
 */
function bashAdapter(agentId: string): GenericCliSidecarAdapter {
  return new GenericCliSidecarAdapter({
    agentId,
    protocol: "generic",
    binary: "/bin/bash",
    args: [],
    outputParser: "ansi",
    cwd: "/tmp",
    cliProfile: { headless: false },
  } as AgentSidecarConfig);
}

/** 可控回复的 adapter（接力链路用：接力 prompt 由服务拼接，无法用 shell 表达） */
class ControlledAdapter implements AgentSidecarAdapter {
  readonly protocol = "pty" as const;
  readonly agentId: string;
  readonly displayName: string;
  replyText: string;

  constructor(agentId: string, replyText: string) {
    this.agentId = agentId;
    this.displayName = agentId;
    this.replyText = replyText;
  }

  async *stream(): AsyncIterable<AgentEvent> {
    yield { kind: "agent-message-chunk", text: this.replyText };
    yield { kind: "stop", stopReason: "end_turn" };
  }
  async start(): Promise<never> {
    throw new Error("not used in chat e2e");
  }
  async detect(): Promise<never> {
    throw new Error("not used in chat e2e");
  }
  async doctor(): Promise<never> {
    throw new Error("not used in chat e2e");
  }
}

async function collectChannel(
  channel: InMemoryChatChannel,
  conversationId: string,
  maxMessages: number,
): Promise<string[]> {
  // receive 是无限实时流：收到期望条数即 break（游标每消息只消费一次）
  const texts: string[] = [];
  for await (const msg of channel.receive(conversationId)) {
    texts.push(msg.text);
    if (texts.length >= maxMessages) break;
  }
  return texts;
}

describe("ChatRelayService 真实环境", () => {
  test("案例1: 真实 bash agent 被 @mention 驱动（真 spawn 系统命令）", async () => {
    const channel = new InMemoryChatChannel();
    const relay = new ChatRelayService({
      allowedAgents: new Set(["basha"]),
      cwd: "/tmp",
      timeoutMs: 15_000,
      adapterFactory: (id) => (id === "basha" ? bashAdapter("basha") : null),
    });

    const marker = `E2E_BASH_${Date.now()}`;
    const result = await relay.route(channel, {
      id: "e2e-1",
      conversationId: "conv-e2e-1",
      sender: "user",
      role: "user",
      text: `echo ${marker}\nexit # @basha`,
      mentions: ["basha"],
      timestamp: Date.now(),
    });

    // 真实 bash 输出被 agent 回复捕获
    expect(result?.agentId).toBe("basha");
    expect(result?.reply).toContain(marker);
    expect(result?.handedOff).toBe(false);
    expect(result!.eventCount).toBeGreaterThan(0);

    // 通道真实收到 agent 回复（InMemoryChatChannel 回放消费）
    const sent = await collectChannel(channel, "conv-e2e-1", 1);
    expect(sent.some((t) => t.includes(marker))).toBe(true);
  }, 30_000);

  test("案例7: 声明 headless 但实测不支持 → fail-fast（I3 真实验证，绝不假成功）", async () => {
    const channel = new InMemoryChatChannel();
    // 故意声明 headless：bash 的 `-c hi` 冒烟失败（hi 是命令名非 prompt）→ 实测 pty
    const misdeclared = new GenericCliSidecarAdapter({
      agentId: "basha",
      protocol: "generic",
      binary: "/bin/bash",
      args: [],
      outputParser: "ansi",
      cwd: "/tmp",
      cliProfile: { headless: true, headlessArgs: ["-c"] },
    } as AgentSidecarConfig);
    const relay = new ChatRelayService({
      allowedAgents: new Set(["basha"]),
      adapterFactory: () => misdeclared,
    });

    const result = await relay.route(channel, {
      id: "e2e-7",
      conversationId: "conv-e2e-7",
      sender: "user",
      role: "user",
      text: "@basha 干活",
      mentions: ["basha"],
      timestamp: Date.now(),
    });

    // fail-fast：显式错误消息，而非静默/假成功
    expect(result?.agentId).toBe("basha");
    expect(result?.reply).toContain("does not support required capabilities: headless");
  });

  test("案例2: I2 未知 agent → fail-fast 错误消息（不静默）", async () => {
    const channel = new InMemoryChatChannel();
    const relay = new ChatRelayService({
      allowedAgents: new Set(["basha"]),
      adapterFactory: (id) => (id === "basha" ? bashAdapter("basha") : null),
    });

    const result = await relay.route(channel, {
      id: "e2e-2",
      conversationId: "conv-e2e-2",
      sender: "user",
      role: "user",
      text: "@ghost-agent 干活",
      mentions: ["ghost-agent"],
      timestamp: Date.now(),
    });

    expect(result?.agentId).toBe("ghost-agent");
    expect(result?.reply).toContain("is not available");
    expect(result?.handedOff).toBe(false);
  });

  test("案例3: I1 未 @ 任何 agent → 不响应（返回 null）", async () => {
    const channel = new InMemoryChatChannel();
    const relay = new ChatRelayService({ allowedAgents: new Set(["basha"]) });
    const result = await relay.route(channel, {
      id: "e2e-3",
      conversationId: "conv-e2e-3",
      sender: "user",
      role: "user",
      text: "大家好，今天天气不错",
      mentions: [],
      timestamp: Date.now(),
    });
    expect(result).toBeNull();
  });

  test("案例4: 多 agent 接力 — A 回复 @B 自动接力（A 实现 → B 审查）", async () => {
    const channel = new InMemoryChatChannel();
    const a = new ControlledAdapter("alice", "实现完成，改动在 src/a.ts @bob");
    const b = new ControlledAdapter("bob", "审查通过，无问题");
    const relay = new ChatRelayService({
      allowedAgents: new Set(["alice", "bob"]),
      maxHandoffs: 3,
      adapterFactory: (id) => (id === "alice" ? a : id === "bob" ? b : null),
    });

    const result = await relay.route(channel, {
      id: "e2e-4",
      conversationId: "conv-e2e-4",
      sender: "user",
      role: "user",
      text: "@alice 实现功能",
      mentions: ["alice"],
      timestamp: Date.now(),
    });

    expect(result?.agentId).toBe("bob"); // 最终由 bob 收尾
    expect(result?.handedOff).toBe(true);
    expect(result?.handoffTarget).toBe("bob");
    expect(result?.reply).toContain("审查通过");

    // 通道收到两条 agent 消息（alice 实现 + bob 审查）
    const sent = await collectChannel(channel, "conv-e2e-4", 2);
    expect(sent.some((t) => t.includes("实现完成"))).toBe(true);
    expect(sent.some((t) => t.includes("审查通过"))).toBe(true);
  });

  test("案例5: 接力深度受限 — maxHandoffs=1 时 A→B→C 最多两跳后停止", async () => {
    const channel = new InMemoryChatChannel();
    const a = new ControlledAdapter("alpha", "第一步 @beta");
    const b = new ControlledAdapter("beta", "第二步 @gamma");
    const c = new ControlledAdapter("gamma", "第三步完成");
    const relay = new ChatRelayService({
      allowedAgents: new Set(["alpha", "beta", "gamma"]),
      maxHandoffs: 1, // 只允许 1 跳：alpha → beta 后即止，gamma 不会被接力
      adapterFactory: (id) =>
        id === "alpha" ? a : id === "beta" ? b : id === "gamma" ? c : null,
    });

    const result = await relay.route(channel, {
      id: "e2e-5",
      conversationId: "conv-e2e-5",
      sender: "user",
      role: "user",
      text: "@alpha 开始",
      mentions: ["alpha"],
      timestamp: Date.now(),
    });

    // 深度耗尽：停在 beta，不再接力 gamma
    expect(result?.agentId).toBe("beta");
    expect(result?.reply).toContain("第二步");
    expect(result?.reply).not.toContain("第三步");
  });

  test("案例6: 接力目标给自己 → 停止（防自循环）", async () => {
    const channel = new InMemoryChatChannel();
    const self = new ControlledAdapter("echo-self", "@echo-self 继续");
    const relay = new ChatRelayService({
      allowedAgents: new Set(["echo-self"]),
      maxHandoffs: 3,
      adapterFactory: (id) => (id === "echo-self" ? self : null),
    });

    const result = await relay.route(channel, {
      id: "e2e-6",
      conversationId: "conv-e2e-6",
      sender: "user",
      role: "user",
      text: "@echo-self 开始",
      mentions: ["echo-self"],
      timestamp: Date.now(),
    });

    expect(result?.agentId).toBe("echo-self");
    expect(result?.handedOff).toBe(false); // 不接力给自己
    expect(result!.eventCount).toBeGreaterThan(0);
  });
});
