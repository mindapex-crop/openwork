/**
 * Synthesizer 综合者测试
 *
 * 验证：
 * - buildSynthesisPrompt 汇总各子任务 finalText
 * - synthesizeResults 通过 LLM executor 产出综合报告
 * - fanOutWithSynthesis 事件流：fan-out 完成 → synthesis-completed
 * - 综合失败 → synthesis-failed（不使 fan-out 结果丢失）
 */
import { describe, expect, test } from "bun:test";
import { PtySidecarAdapter } from "../agent-sidecar/adapters/pty.js";
import type { AgentSidecarConfig } from "../agent-sidecar/types.js";
import { createAgentTeam } from "./team.js";
import { fanOutWithSynthesis } from "./relay.js";
import { buildSynthesisPrompt, synthesizeResults } from "./synthesizer.js";
import type { AgentTeamConfig, AgentTeamMember, FanOutEvent } from "./types.js";

type LlmExecutorParams = {
  providerID: string;
  modelID: string;
  prompt: string;
  systemPrompt: string;
  timeoutMs: number;
};

function makeEchoAdapter(agentId: string): PtySidecarAdapter {
  const script = `read line; printf '{"type":"agent-message-chunk","text":"${agentId}: %s"}\\n' "$line"; printf '{"type":"stop","stopReason":"end"}\\n'; sleep 0.1`;
  const config: AgentSidecarConfig = {
    agentId,
    protocol: "pty",
    binary: "bash",
    args: ["-c", script],
    outputParser: "jsonl",
  };
  return new PtySidecarAdapter(config);
}

const sampleResults = [
  { subtaskId: "s1", agentId: "a", finalText: "完成了登录模块" },
  { subtaskId: "s2", agentId: "b", finalText: "完成了支付模块" },
];

describe("buildSynthesisPrompt", () => {
  test("汇总各子任务 finalText 与任务描述", () => {
    const prompt = buildSynthesisPrompt({
      synthesisId: "syn-1",
      taskPrompt: "实现电商网站",
      results: sampleResults,
      providerID: "anthropic",
      modelID: "claude-opus-4",
    });
    expect(prompt).toContain("实现电商网站");
    expect(prompt).toContain("s1");
    expect(prompt).toContain("完成了登录模块");
    expect(prompt).toContain("s2");
    expect(prompt).toContain("完成了支付模块");
  });

  test("失败的子任务以 error 呈现而非 finalText", () => {
    const prompt = buildSynthesisPrompt({
      synthesisId: "syn-2",
      taskPrompt: "t",
      results: [
        { subtaskId: "s1", agentId: "a", finalText: "ok", error: undefined },
        { subtaskId: "s2", agentId: "b", finalText: null, error: "agent crashed" },
      ],
      providerID: "p",
      modelID: "m",
    });
    expect(prompt).toContain("ok");
    expect(prompt).toContain("agent crashed");
  });
});

describe("synthesizeResults", () => {
  test("调用 llmExecutor 并返回综合报告", async () => {
    let captured: LlmExecutorParams | null = null;
    const executor = async (params: LlmExecutorParams) => {
      captured = params;
      return "【综合报告】登录与支付模块均已完成，整体可交付。";
    };

    const outcome = await synthesizeResults(
      {
        synthesisId: "syn-3",
        taskPrompt: "实现电商网站",
        results: sampleResults,
        providerID: "anthropic",
        modelID: "claude-opus-4",
      },
      executor,
    );

    expect(captured).not.toBeNull();
    expect(captured!.providerID).toBe("anthropic");
    expect(captured!.modelID).toBe("claude-opus-4");
    expect(captured!.prompt).toContain("实现电商网站");
    expect(captured!.systemPrompt).toContain("synthesis");
    expect(outcome.report).toContain("综合报告");
    expect(outcome.providerID).toBe("anthropic");
    expect(outcome.modelID).toBe("claude-opus-4");
    expect(outcome.subtaskCount).toBe(2);
  });

  test("llmExecutor 失败时抛出错误", async () => {
    const executor = async () => {
      throw new Error("llm down");
    };
    await expect(
      synthesizeResults(
        { synthesisId: "syn-4", taskPrompt: "t", results: sampleResults, providerID: "p", modelID: "m" },
        executor,
      ),
    ).rejects.toThrow("llm down");
  });
});

function makeMember(agentId: string): AgentTeamMember {
  return { agentId, adapter: makeEchoAdapter(agentId) };
}

describe("fanOutWithSynthesis", () => {
  async function run(options: {
    assignments: Array<{ subtaskId: string; agentId: string; prompt: string; dependencies?: string[] }>;
    synthesize?: (input: { taskPrompt: string; results: Array<{ subtaskId: string; agentId: string; finalText: string | null; error?: string }> }) => Promise<{ report: string }>;
  }): Promise<{ events: FanOutEvent[]; calls: number }> {
    const config: AgentTeamConfig = {
      teamId: "syn-team",
      members: [makeMember("a"), makeMember("b")],
      dispatchPolicy: { kind: "round-robin" },
      eagerStart: false,
      worktreeIsolation: false,
      useProcessPool: false,
    };
    const team = await createAgentTeam(config, { cwd: "/tmp" });
    try {
      const events: FanOutEvent[] = [];
      let calls = 0;
      const fallbackSynthesize = async (input: { taskPrompt: string; results: Array<{ subtaskId: string; agentId: string; finalText: string | null; error?: string }> }) => {
        calls++;
        return { report: `SYNTHESIZED(${input.results.length})` };
      };
      const synthesize = options.synthesize ?? fallbackSynthesize;
      for await (const ev of fanOutWithSynthesis(team, {
        fanOutId: "syn-f1",
        cwd: "/tmp",
        defaultTimeoutMs: 30_000,
        assignments: options.assignments,
      }, {
        providerID: "anthropic",
        modelID: "claude-opus-4",
        taskPrompt: "整体任务",
        synthesize,
      })) {
        events.push(ev);
      }
      return { events, calls };
    } finally {
      await team.stop().catch(() => {});
    }
  }

  test("fan-out 完成后追加 synthesis-completed 事件", async () => {
    const { events, calls } = await run({
      assignments: [
        { subtaskId: "s1", agentId: "a", prompt: "task1" },
        { subtaskId: "s2", agentId: "b", prompt: "task2" },
      ],
    });
    expect(calls).toBe(1);
    const synced = events.find((e) => e.kind === "synthesis-completed");
    expect(synced).toBeDefined();
    if (synced && synced.kind === "synthesis-completed") {
      expect(synced.report).toBe("SYNTHESIZED(2)");
      expect(synced.providerID).toBe("anthropic");
      expect(synced.modelID).toBe("claude-opus-4");
    }
    // fanout-completed 事件保留
    expect(events.some((e) => e.kind === "fanout-completed")).toBe(true);
    // synthesis-completed 在 fanout-completed 之后
    const fanOutIdx = events.findIndex((e) => e.kind === "fanout-completed");
    const synIdx = events.findIndex((e) => e.kind === "synthesis-completed");
    expect(synIdx).toBeGreaterThan(fanOutIdx);
  });

  test("依赖执行后综合：上游失败不影响综合事件（失败项带 error）", async () => {
    const seen: Array<{ subtaskId: string; finalText: string | null; error?: string }> = [];
    const { events } = await run({
      assignments: [
        { subtaskId: "a1", agentId: "a", prompt: "phase1" },
        { subtaskId: "b1", agentId: "b", prompt: "phase2", dependencies: ["a1"] },
      ],
      synthesize: async (input) => {
        seen.push(...input.results);
        return { report: "REPORT" };
      },
    });
    expect(seen.map((r) => r.subtaskId).sort()).toEqual(["a1", "b1"]);
    expect(events.some((e) => e.kind === "synthesis-completed")).toBe(true);
  });

  test("synthesize 抛错 → synthesis-failed 且 fanout 结果仍保留", async () => {
    const { events } = await run({
      assignments: [{ subtaskId: "s1", agentId: "a", prompt: "task" }],
      synthesize: async () => {
        throw new Error("synthesis boom");
      },
    });
    const failed = events.find((e) => e.kind === "synthesis-failed");
    expect(failed).toBeDefined();
    if (failed && failed.kind === "synthesis-failed") {
      expect(failed.error).toContain("synthesis boom");
    }
    expect(events.some((e) => e.kind === "fanout-completed")).toBe(true);
  });
});
