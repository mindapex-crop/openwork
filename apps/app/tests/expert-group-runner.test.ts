import { afterEach, describe, expect, mock, test } from "bun:test";

import { runExpertGroup } from "../src/react-app/domains/experts/expert-group-runner";
import type { ExpertGroup } from "../src/react-app/domains/experts/expert-group-types";

const group: ExpertGroup = {
  id: "g1",
  name: "媒体协作团队",
  description: "",
  leaderId: "lead",
  memberIds: ["m1", "m2"],
  strategy: "balanced",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

type FetchLike = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
};

function mockFetch(body: unknown, ok = true, status = 200): void {
  globalThis.fetch = (async () =>
    ({ ok, status, json: async () => body }) as FetchLike) as unknown as typeof fetch;
}

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("runExpertGroup — 真实 /teams/run-simple 编排（无本地模拟）", () => {
  test("调用后端并调用真实 endpoint 路径", async () => {
    let calledPath = "";
    mockFetch(
      { status: "completed", message: "OK", subtaskResults: [] },
      true,
      200,
    );
    const original = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      calledPath = String(input);
      return { ok: true, status: 200, json: async () => ({ status: "completed" }) } as FetchLike;
    }) as unknown as typeof fetch;

    await runExpertGroup(group, "写一份周报");

    globalThis.fetch = original;
    expect(calledPath).toBe("/teams/run-simple");
  });

  test("后端成功：子任务结果映射到组长 + 成员，状态 completed", async () => {
    mockFetch({
      status: "completed",
      message: "周报已生成。",
      subtaskResults: [
        { subtaskId: "s0", agentId: "opencode", prompt: "p", status: "completed", outputTail: "leader output" },
        { subtaskId: "s1", agentId: "opencode", prompt: "p", status: "completed", outputTail: "m1 output" },
        { subtaskId: "s2", agentId: "opencode", prompt: "p", status: "failed", outputTail: "m2 error" },
      ],
    });

    const result = await runExpertGroup(group, "写一份周报");

    expect(result.status).toBe("failed"); // 存在失败子任务 → 整体不再伪造 completed
    expect(result.synthesis).toBe("周报已生成。");
    expect(result.members).toHaveLength(3);
    expect(result.members[0]).toMatchObject({ expertId: "lead", status: "completed" });
    expect(result.members[2]).toMatchObject({ expertId: "m2", status: "failed" });
  });

  test("后端全部成功 → 整体 completed", async () => {
    mockFetch({
      status: "completed",
      message: "done",
      subtaskResults: [
        { subtaskId: "s0", agentId: "opencode", prompt: "p", status: "completed", outputTail: "a" },
        { subtaskId: "s1", agentId: "opencode", prompt: "p", status: "completed", outputTail: "b" },
        { subtaskId: "s2", agentId: "opencode", prompt: "p", status: "completed", outputTail: "c" },
      ],
    });

    const result = await runExpertGroup(group, "写一份周报");

    expect(result.status).toBe("completed");
    expect(result.completedAt).toBeDefined();
  });

  test("后端失败：返回 failed，绝不伪造'已完成任务子步骤'", async () => {
    mockFetch({ error: "no_agent_available" }, false, 400);

    const result = await runExpertGroup(group, "写一份周报");

    expect(result.status).toBe("failed");
    expect(JSON.stringify(result.members)).not.toContain("已完成任务子步骤");
    expect(result.members.every((m) => m.status === "failed")).toBe(true);
  });

  // 放最后：mock.module 是文件级的，上面的用例依赖真实 resolver 返回「无连接」。
  test("run-simple 已要求 client token：请求带 server origin 与 Authorization", async () => {
    mock.module("../src/react-app/shell/openwork-connection", () => ({
      resolveOpenworkConnection: async () => ({
        normalizedBaseUrl: "http://127.0.0.1:8778",
        resolvedToken: "client-token",
        resolvedHostToken: "",
        hostInfo: null,
        source: "stored-settings" as const,
      }),
      resolveServerApiBaseUrl: async () => "http://127.0.0.1:8778",
    }));

    let url = "";
    let authorization: string | null = null;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      url = String(input);
      authorization = new Headers(init?.headers).get("Authorization");
      return {
        ok: true,
        status: 200,
        json: async () => ({ status: "completed", message: "done", subtaskResults: [] }),
      } as FetchLike;
    }) as unknown as typeof fetch;

    await runExpertGroup(group, "写一份周报");

    expect(url).toBe("http://127.0.0.1:8778/teams/run-simple");
    expect(authorization).toBe("Bearer client-token");
  });
});