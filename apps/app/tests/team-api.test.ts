/**
 * Team API 传输层测试
 *
 * 覆盖 /teams* 现在是 client 鉴权路由后应用侧必须成立的两件事：
 * - 请求打到解析后的 server origin 并带上 Bearer client token
 *   （相对路径在 headless-web 下会命中应用自己的 SPA 兜底页）
 * - 服务端错误里的 error + hint 一起呈现给用户（no_agent_available 场景）
 * 以及轮询接口 /teams/:id/tasks 的子任务快照契约（实时状态 + outputTail）。
 */
import { afterEach, describe, expect, mock, test } from "bun:test";

import {
  teamApiRequest,
  type TaskSnapshot,
} from "../src/react-app/domains/session/team/team-api";

const originalFetch = globalThis.fetch;

type SeenRequest = { url: string; authorization: string | null };

function mockConnection(input: { normalizedBaseUrl: string; resolvedToken: string }): void {
  mock.module("../src/react-app/shell/openwork-connection", () => ({
    resolveOpenworkConnection: async () => ({
      normalizedBaseUrl: input.normalizedBaseUrl,
      resolvedToken: input.resolvedToken,
      resolvedHostToken: "",
      hostInfo: null,
      source: "stored-settings" as const,
    }),
    resolveServerApiBaseUrl: async () => input.normalizedBaseUrl,
  }));
}

function stubFetch(payload: unknown, status = 200): SeenRequest[] {
  const seen: SeenRequest[] = [];
  globalThis.fetch = mock(async (requestUrl: RequestInfo | URL, init?: RequestInit) => {
    seen.push({
      url: String(requestUrl),
      authorization: new Headers(init?.headers).get("Authorization"),
    });
    return new Response(JSON.stringify(payload), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }) as unknown as typeof fetch;
  return seen;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("teamApiRequest — /teams* 鉴权与寻址", () => {
  test("GET 带解析后的 server origin 与 Bearer client token", async () => {
    mockConnection({ normalizedBaseUrl: "http://127.0.0.1:8778", resolvedToken: "client-token" });
    const seen = stubFetch({ teams: [] });

    await teamApiRequest<{ teams: [] }>("/teams");

    expect(seen[0]?.url).toBe("http://127.0.0.1:8778/teams");
    expect(seen[0]?.authorization).toBe("Bearer client-token");
  });

  test("POST 同样带 token（run / create 都是写操作）", async () => {
    mockConnection({ normalizedBaseUrl: "http://127.0.0.1:8778", resolvedToken: "client-token" });
    const seen = stubFetch({ teamId: "team_1", taskId: "task_1", subtaskResults: [] });

    await teamApiRequest("/teams/team_1/run", {
      method: "POST",
      body: JSON.stringify({ taskPrompt: "做一份调研" }),
    });

    expect(seen[0]?.url).toBe("http://127.0.0.1:8778/teams/team_1/run");
    expect(seen[0]?.authorization).toBe("Bearer client-token");
  });

  test("解析不到 token 时不发 Authorization 头（由服务端 401 决定，不静默伪造成功）", async () => {
    mockConnection({ normalizedBaseUrl: "", resolvedToken: "" });
    const seen = stubFetch({ teams: [] });

    await teamApiRequest<{ teams: [] }>("/teams");

    expect(seen[0]?.url).toBe("/teams");
    expect(seen[0]?.authorization).toBeNull();
  });

  test("no_agent_available：把服务端 hint 一并抛给用户", async () => {
    mockConnection({ normalizedBaseUrl: "", resolvedToken: "t" });
    stubFetch(
      { error: "no_agent_available", hint: "未检测到可用的 agent。请先安装任意支持的 CLI agent。" },
      400,
    );

    await expect(
      teamApiRequest("/teams/team_1/run", { method: "POST", body: "{}" }),
    ).rejects.toThrow(/no_agent_available: 未检测到可用的 agent/);
  });
});

describe("GET /teams/:id/tasks — 轮询快照契约", () => {
  test("running 状态与 outputTail 原样透传给面板渲染", async () => {
    mockConnection({ normalizedBaseUrl: "", resolvedToken: "t" });
    stubFetch({
      tasks: [
        {
          taskId: "task_1",
          completedAt: 1_700_000_000_000,
          subtasks: [
            { subtaskId: "s1", agentId: "opencode", prompt: "p1", status: "running" },
            { subtaskId: "s2", agentId: "kimi", prompt: "p2", status: "completed", outputTail: "结论：……" },
          ],
        },
      ],
    });

    const data = await teamApiRequest<{ tasks: TaskSnapshot[] }>("/teams/team_1/tasks");

    expect(data.tasks).toHaveLength(1);
    expect(data.tasks[0]?.subtasks[0]).toMatchObject({ status: "running" });
    expect(data.tasks[0]?.subtasks[1]?.outputTail).toContain("结论");
  });

  test("团队尚未跑过任务时 tasks 为空数组", async () => {
    mockConnection({ normalizedBaseUrl: "", resolvedToken: "t" });
    stubFetch({ tasks: [] });

    const data = await teamApiRequest<{ tasks: TaskSnapshot[] }>("/teams/team_1/tasks");

    expect(data.tasks).toEqual([]);
  });
});
