/**
 * relay fanOut 依赖拓扑执行测试
 *
 * 验证：
 * - 无 dependencies → 所有子任务同一层并发（行为与 v2 一致）
 * - 有 dependencies → 依赖先执行，下游在其完成后启动
 * - 环 → 环上节点跳过并标记 subtask-failed
 */
import { describe, expect, test } from "bun:test";
import { PtySidecarAdapter } from "../agent-sidecar/adapters/pty.js";
import type { AgentSidecarConfig } from "../agent-sidecar/types.js";
import { createAgentTeam, fanOutTask } from "./team.js";
import type { AgentTeamConfig, AgentTeamMember, FanOutEvent } from "./types.js";

function makeEchoAdapter(agentId: string): PtySidecarAdapter {
  // Bash: echo JSONL agent-message-chunk then stop
  const script = `read line; printf '{"type":"agent-message-chunk","text":"${agentId}: %s"}\\n' "$line"; printf '{"type":"stop","stopReason":"end"}\\n'; sleep 0.2`;
  const config: AgentSidecarConfig = {
    agentId,
    protocol: "pty",
    binary: "bash",
    args: ["-c", script],
    outputParser: "jsonl",
  };
  return new PtySidecarAdapter(config);
}

function makeMember(agentId: string): AgentTeamMember {
  return { agentId, adapter: makeEchoAdapter(agentId) };
}

async function runFanOut(assignments: Parameters<typeof fanOutTask>[1]["assignments"]): Promise<FanOutEvent[]> {
  const config: AgentTeamConfig = {
    teamId: "relay-deps",
    members: [makeMember("a"), makeMember("b"), makeMember("c")],
    dispatchPolicy: { kind: "round-robin" },
    eagerStart: false,
    worktreeIsolation: false,
    useProcessPool: false,
  };
  const team = await createAgentTeam(config, { cwd: "/tmp" });
  try {
    const events: FanOutEvent[] = [];
    for await (const ev of fanOutTask(team, {
      fanOutId: "f1",
      cwd: "/tmp",
      defaultTimeoutMs: 30_000,
      assignments,
    })) {
      events.push(ev);
    }
    return events;
  } finally {
    await team.stop().catch(() => {});
  }
}

describe("fanOut 依赖拓扑执行", () => {
  test("无 dependencies：所有子任务执行并完成（fanout-completed 含全部结果）", async () => {
    const events = await runFanOut([
      { subtaskId: "x", agentId: "a", prompt: "do x" },
      { subtaskId: "y", agentId: "b", prompt: "do y" },
    ]);
    const completed = events.filter((e) => e.kind === "subtask-completed");
    expect(completed.length).toBe(2);
    const done = events.find((e) => e.kind === "fanout-completed");
    expect(done).toBeDefined();
    if (done && done.kind === "fanout-completed") {
      expect(done.results.map((r) => r.subtaskId).sort()).toEqual(["x", "y"]);
      expect(done.results.every((r) => r.finalText !== null)).toBe(true);
    }
  });

  test("依赖顺序：B 依赖 A，B 的 subtask-assigned 出现在 A 的 subtask-completed 之后", async () => {
    const events = await runFanOut([
      { subtaskId: "a1", agentId: "a", prompt: "phase1" },
      { subtaskId: "b1", agentId: "b", prompt: "phase2", dependencies: ["a1"] },
    ]);
    const aCompletedIdx = events.findIndex((e) => e.kind === "subtask-completed" && e.subtaskId === "a1");
    const bAssignedIdx = events.findIndex((e) => e.kind === "subtask-assigned" && e.subtaskId === "b1");
    expect(aCompletedIdx).toBeGreaterThanOrEqual(0);
    expect(bAssignedIdx).toBeGreaterThanOrEqual(0);
    expect(bAssignedIdx).toBeGreaterThan(aCompletedIdx);
  });

  test("三层链：A → B → C 严格串行", async () => {
    const events = await runFanOut([
      { subtaskId: "c1", agentId: "c", prompt: "c", dependencies: ["b1"] },
      { subtaskId: "a1", agentId: "a", prompt: "a" },
      { subtaskId: "b1", agentId: "b", prompt: "b", dependencies: ["a1"] },
    ]);
    const idx = (subtaskId: string, kind: FanOutEvent["kind"]) =>
      events.findIndex((e) => e.kind === kind && "subtaskId" in e && e.subtaskId === subtaskId);
    expect(idx("a1", "subtask-completed")).toBeGreaterThanOrEqual(0);
    expect(idx("b1", "subtask-assigned")).toBeGreaterThan(idx("a1", "subtask-completed"));
    expect(idx("c1", "subtask-assigned")).toBeGreaterThan(idx("b1", "subtask-completed"));
    expect(idx("c1", "subtask-completed")).toBeGreaterThanOrEqual(0);
  });

  test("环检测：A↔B 环上节点标记 subtask-failed，不执行", async () => {
    const events = await runFanOut([
      { subtaskId: "a1", agentId: "a", prompt: "a", dependencies: ["b1"] },
      { subtaskId: "b1", agentId: "b", prompt: "b", dependencies: ["a1"] },
    ]);
    const failed = events.filter((e) => e.kind === "subtask-failed");
    expect(failed.length).toBe(2);
    const done = events.find((e) => e.kind === "fanout-completed");
    expect(done).toBeDefined();
    if (done && done.kind === "fanout-completed") {
      expect(done.results.every((r) => r.error && r.error.includes("cycle"))).toBe(true);
    }
  });

  test("环 + 正常节点：正常节点仍执行完成", async () => {
    const events = await runFanOut([
      { subtaskId: "ok1", agentId: "a", prompt: "ok" },
      { subtaskId: "a1", agentId: "b", prompt: "a", dependencies: ["b1"] },
      { subtaskId: "b1", agentId: "c", prompt: "b", dependencies: ["a1"] },
    ]);
    expect(events.some((e) => e.kind === "subtask-completed" && e.subtaskId === "ok1")).toBe(true);
    expect(events.filter((e) => e.kind === "subtask-failed").length).toBe(2);
  });

  test("dangling 依赖（引用不存在子任务）宽容执行", async () => {
    const events = await runFanOut([
      { subtaskId: "a1", agentId: "a", prompt: "a", dependencies: ["ghost"] },
      { subtaskId: "b1", agentId: "b", prompt: "b", dependencies: ["a1"] },
    ]);
    const done = events.find((e) => e.kind === "fanout-completed");
    expect(done).toBeDefined();
    if (done && done.kind === "fanout-completed") {
      const okIds = done.results.filter((r) => !r.error).map((r) => r.subtaskId).sort();
      expect(okIds).toEqual(["a1", "b1"]);
    }
  });
});
