/**
 * teams 路由完整测试 - 覆盖所有端点（happy path + 异常流程 + 边界条件）
 */
import { describe, expect, test, beforeEach, beforeAll } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ApprovalService } from "../approvals.js";
import type { ReloadEventStore } from "../events.js";
import type { TokenService } from "../tokens.js";
import type { ServerConfig } from "../types.js";
import type { AgentDetectResult } from "../agent-sidecar/types.js";
import { matchRoute, type RequestContext, type Route } from "./registry.js";
import {
  registerTeamRoutes,
  type RunSimpleExecutor,
} from "./teams.js";

let teamStorePath: string;

beforeAll(async () => {
  // 团队持久化 sqlite 路径（隔离测试数据，避免写入真实配置目录）
  teamStorePath = join(await mkdtemp(join(tmpdir(), "teams-full-test-")), "teams.sqlite");
});

// ─── Helpers ────────────────────────────────────────────────────────

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function readJsonBody(request: Request): Promise<unknown> {
  return request.json();
}

function buildRoutes(opts?: {
  detectAgents?: () => Promise<AgentDetectResult[]>;
  executePlan?: RunSimpleExecutor;
}): Route[] {
  const routes: Route[] = [];
  registerTeamRoutes({
    routes,
    jsonResponse,
    readJsonBody,
    teamStorePath,
    detectAgents: opts?.detectAgents,
    executePlan: opts?.executePlan,
  });
  return routes;
}

function makeCtx(request: Request, params: Record<string, string> = {}): RequestContext {
  return {
    request,
    url: new URL(request.url, "http://localhost"),
    params,
    config: {} as ServerConfig,
    approvals: {} as ApprovalService,
    reloadEvents: {} as ReloadEventStore,
    tokens: {} as TokenService,
  };
}

function makePost(path: string, body: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

function makeGet(path: string): Request {
  return new Request(`http://localhost${path}`, { method: "GET" });
}

function makePut(path: string, body: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method: "PUT",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

function makeDelete(path: string): Request {
  return new Request(`http://localhost${path}`, { method: "DELETE" });
}

async function callRoute(routes: Route[], method: string, path: string, body?: unknown): Promise<{ status: number; body: unknown }> {
  const route = matchRoute(routes, method, path);
  if (!route) throw new Error(`${method} ${path} not matched`);
  let request: Request;
  if (body !== undefined) {
    request = new Request(`http://localhost${path}`, {
      method,
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
    });
  } else {
    request = new Request(`http://localhost${path}`, { method });
  }
  const response = await route.handler(makeCtx(request, route.params));
  return { status: response.status, body: await response.json() };
}

/** Create a team via POST /teams and return the team object */
async function createTeam(routes: Route[], name = "Test Team"): Promise<{ id: string; [k: string]: unknown }> {
  const { body } = await callRoute(routes, "POST", "/teams", {
    name,
    members: [{ agentId: "opencode", role: "primary" }],
  });
  const result = body as { team: { id: string; [k: string]: unknown } };
  return result.team;
}

const availableAgents = async (): Promise<AgentDetectResult[]> => [
  { agentId: "opencode", available: true, binaryPath: "/usr/bin/opencode", version: "1.0", confidence: 0.95 },
  { agentId: "kimi", available: true, binaryPath: "/usr/bin/kimi", version: "2.0", confidence: 0.9 },
];

const fakeAllCompleted: RunSimpleExecutor = async ({ subtasks }) => ({
  status: "completed",
  subtaskResults: subtasks.map((s) => ({
    subtaskId: s.subtaskId,
    agentId: s.agentId,
    prompt: s.prompt,
    status: "completed",
    outputTail: "done",
  })),
  message: "Task completed.",
});

// ─── Tests ──────────────────────────────────────────────────────────

describe("POST /teams — 创建团队", () => {
  let routes: Route[];
  beforeEach(() => {
    routes = buildRoutes();
  });

  test("happy path: 创建团队返回 201 + 完整字段", async () => {
    const { status, body } = await callRoute(routes, "POST", "/teams", {
      name: "My Team",
      strategy: "balanced",
      members: [
        { agentId: "opencode", role: "primary" },
        { agentId: "kimi", role: "reviewer" },
      ],
      harnessId: "local-default",
    });
    expect(status).toBe(201);
    const result = body as { team: Record<string, unknown> };
    expect(result.team.id).toMatch(/^team_/);
    expect(result.team.name).toBe("My Team");
    expect(result.team.strategy).toBe("balanced");
    expect(result.team.status).toBe("idle");
    expect((result.team.memberSpecs as unknown[]).length).toBe(2);
    expect(result.team.harnessId).toBe("local-default");
    expect(typeof result.team.createdAt).toBe("number");
    expect(typeof result.team.updatedAt).toBe("number");
  });

  test("创建团队不指定 strategy 默认为 balanced", async () => {
    const { body } = await callRoute(routes, "POST", "/teams", {
      name: "Default Strategy Team",
      members: [{ agentId: "opencode" }],
    });
    const result = body as { team: { strategy: string } };
    expect(result.team.strategy).toBe("balanced");
  });

  test("创建团队不指定 harnessId 默认为 local-default", async () => {
    const { body } = await callRoute(routes, "POST", "/teams", {
      name: "Default Harness Team",
      members: [{ agentId: "opencode" }],
    });
    const result = body as { team: { harnessId: string } };
    expect(result.team.harnessId).toBe("local-default");
  });

  test("成员没有 role 时默认为 specialist", async () => {
    const { body } = await callRoute(routes, "POST", "/teams", {
      name: "No Role Team",
      members: [{ agentId: "opencode" }],
    });
    const result = body as { team: { memberSpecs: Array<{ agentId: string; role: string }> } };
    expect(result.team.memberSpecs[0].role).toBe("specialist");
  });

  // ── Error cases ──

  test("name 为空返回 400", async () => {
    const { status, body } = await callRoute(routes, "POST", "/teams", {
      name: "",
      members: [{ agentId: "opencode" }],
    });
    expect(status).toBe(400);
    expect((body as { error: string }).error).toBe("team name is required");
  });

  test("name 全空格返回 400", async () => {
    const { status, body } = await callRoute(routes, "POST", "/teams", {
      name: "   ",
      members: [{ agentId: "opencode" }],
    });
    expect(status).toBe(400);
    expect((body as { error: string }).error).toBe("team name is required");
  });

  test("name 缺失返回 400", async () => {
    const { status } = await callRoute(routes, "POST", "/teams", {
      members: [{ agentId: "opencode" }],
    });
    expect(status).toBe(400);
  });

  test("members 为空数组返回 400", async () => {
    const { status, body } = await callRoute(routes, "POST", "/teams", {
      name: "Empty Members",
      members: [],
    });
    expect(status).toBe(400);
    expect((body as { error: string }).error).toBe("at least one team member is required");
  });

  test("members 缺失返回 400", async () => {
    const { status } = await callRoute(routes, "POST", "/teams", {
      name: "No Members",
    });
    expect(status).toBe(400);
  });

  test("body 不是对象返回 400", async () => {
    const { status, body } = await callRoute(routes, "POST", "/teams", "invalid");
    expect(status).toBe(400);
    expect((body as { error: string }).error).toBe("invalid body");
  });

  test("body 为 null 返回 400", async () => {
    const { status } = await callRoute(routes, "POST", "/teams", null);
    expect(status).toBe(400);
  });

  test("不存在的 harnessId 返回 400", async () => {
    const { status, body } = await callRoute(routes, "POST", "/teams", {
      name: "Bad Harness",
      members: [{ agentId: "opencode" }],
      harnessId: "nonexistent-harness-xyz",
    });
    expect(status).toBe(400);
    expect((body as { error: string }).error).toContain("harness");
    expect((body as { error: string }).error).toContain("not found");
  });
});

describe("GET /teams — 列出所有团队", () => {
  let routes: Route[];
  beforeEach(() => {
    routes = buildRoutes();
  });

  test("无团队时返回空数组（或仅含之前测试创建的团队）", async () => {
    const { status, body } = await callRoute(routes, "GET", "/teams");
    expect(status).toBe(200);
    const teams = (body as { teams: unknown[] }).teams;
    expect(Array.isArray(teams)).toBe(true);
  });

  test("创建后可列表查到", async () => {
    await createTeam(routes, "Listed Team");
    const { body } = await callRoute(routes, "GET", "/teams");
    const teams = (body as { teams: Array<{ name: string }> }).teams;
    expect(teams.some((t) => t.name === "Listed Team")).toBe(true);
  });
});

describe("GET /teams/:id — 获取团队详情", () => {
  let routes: Route[];
  beforeEach(() => {
    routes = buildRoutes();
  });

  test("存在的 team 返回详情", async () => {
    const team = await createTeam(routes, "Detail Team");
    const { status, body } = await callRoute(routes, "GET", `/teams/${team.id}`);
    expect(status).toBe(200);
    const result = body as { team: { id: string; name: string } };
    expect(result.team.id).toBe(team.id);
    expect(result.team.name).toBe("Detail Team");
  });

  test("不存在的 team 返回 404", async () => {
    const { status, body } = await callRoute(routes, "GET", "/teams/nonexistent_id");
    expect(status).toBe(404);
    expect((body as { error: string }).error).toBe("team not found");
  });
});

describe("PUT /teams/:id — 更新团队", () => {
  let routes: Route[];
  beforeEach(() => {
    routes = buildRoutes();
  });

  test("happy path: 更新 name 和 strategy", async () => {
    const team = await createTeam(routes, "Old Name");
    const { status, body } = await callRoute(routes, "PUT", `/teams/${team.id}`, {
      name: "New Name",
      strategy: "aggressive",
    });
    expect(status).toBe(200);
    const result = body as { team: { name: string; strategy: string } };
    expect(result.team.name).toBe("New Name");
    expect(result.team.strategy).toBe("aggressive");
  });

  test("部分更新：只改 name，strategy 不变", async () => {
    const team = await createTeam(routes, "Original");
    const { body } = await callRoute(routes, "PUT", `/teams/${team.id}`, {
      name: "Renamed",
    });
    const result = body as { team: { name: string; strategy: string } };
    expect(result.team.name).toBe("Renamed");
    expect(result.team.strategy).toBe("balanced"); // default from create
  });

  test("更新 members 替换整个列表", async () => {
    const team = await createTeam(routes, "Member Team");
    const { body } = await callRoute(routes, "PUT", `/teams/${team.id}`, {
      members: [
        { agentId: "claude", role: "primary" },
        { agentId: "codex", role: "specialist" },
      ],
    });
    const result = body as { team: { memberSpecs: Array<{ agentId: string }> } };
    expect(result.team.memberSpecs.length).toBe(2);
    expect(result.team.memberSpecs.map((m) => m.agentId).sort()).toEqual(["claude", "codex"]);
  });

  test("更新不存在的 team 返回 404", async () => {
    const { status } = await callRoute(routes, "PUT", "/teams/fake_id", { name: "x" });
    expect(status).toBe(404);
  });

  test("body 无效返回 400", async () => {
    const team = await createTeam(routes);
    const { status } = await callRoute(routes, "PUT", `/teams/${team.id}`, "invalid");
    expect(status).toBe(400);
  });

  test("updatedAt 在更新后增大", async () => {
    const team = await createTeam(routes);
    const before = (await callRoute(routes, "GET", `/teams/${team.id}`)).body as {
      team: { updatedAt: number };
    };
    // 小延迟确保时间戳不同
    await new Promise((r) => setTimeout(r, 5));
    await callRoute(routes, "PUT", `/teams/${team.id}`, { name: "Updated" });
    const after = (await callRoute(routes, "GET", `/teams/${team.id}`)).body as {
      team: { updatedAt: number };
    };
    expect(after.team.updatedAt).toBeGreaterThanOrEqual(before.team.updatedAt);
  });
});

describe("DELETE /teams/:id — 删除团队", () => {
  let routes: Route[];
  beforeEach(() => {
    routes = buildRoutes();
  });

  test("happy path: 删除存在的 team 返回 ok", async () => {
    const team = await createTeam(routes, "To Delete");
    const { status, body } = await callRoute(routes, "DELETE", `/teams/${team.id}`);
    expect(status).toBe(200);
    expect((body as { ok: boolean }).ok).toBe(true);
    // 确认删除后查不到
    const { status: getStatus } = await callRoute(routes, "GET", `/teams/${team.id}`);
    expect(getStatus).toBe(404);
  });

  test("删除不存在的 team 返回 404", async () => {
    const { status, body } = await callRoute(routes, "DELETE", "/teams/nonexistent");
    expect(status).toBe(404);
    expect((body as { error: string }).error).toBe("team not found");
  });

  test("重复删除同一个 team 第二次返回 404", async () => {
    const team = await createTeam(routes);
    await callRoute(routes, "DELETE", `/teams/${team.id}`);
    const { status } = await callRoute(routes, "DELETE", `/teams/${team.id}`);
    expect(status).toBe(404);
  });
});

// ─── Member Management ─────────────────────────────────────────────

describe("POST /teams/:id/members — 添加成员", () => {
  let routes: Route[];
  beforeEach(() => {
    routes = buildRoutes();
  });

  test("happy path: 添加新成员", async () => {
    const team = await createTeam(routes);
    const { status, body } = await callRoute(routes, "POST", `/teams/${team.id}/members`, {
      agentId: "new-agent",
      role: "reviewer",
    });
    expect(status).toBe(201);
    const result = body as { team: { memberSpecs: Array<{ agentId: string; role: string }> } };
    expect(result.team.memberSpecs.some((m) => m.agentId === "new-agent")).toBe(true);
    expect(result.team.memberSpecs.find((m) => m.agentId === "new-agent")?.role).toBe("reviewer");
  });

  test("不指定 role 默认 specialist", async () => {
    const team = await createTeam(routes);
    const { body } = await callRoute(routes, "POST", `/teams/${team.id}/members`, {
      agentId: "default-role-agent",
    });
    const result = body as { team: { memberSpecs: Array<{ agentId: string; role: string }> } };
    expect(result.team.memberSpecs.find((m) => m.agentId === "default-role-agent")?.role).toBe("specialist");
  });

  test("重复添加同一个 agentId 返回 409", async () => {
    const team = await createTeam(routes);
    const { status, body } = await callRoute(routes, "POST", `/teams/${team.id}/members`, {
      agentId: "opencode", // already in team from createTeam
    });
    expect(status).toBe(409);
    expect((body as { error: string }).error).toContain("already a member");
  });

  test("添加成员到不存在的 team 返回 404", async () => {
    const { status } = await callRoute(routes, "POST", "/teams/fake_id/members", {
      agentId: "agent-x",
    });
    expect(status).toBe(404);
  });

  test("缺少 agentId 返回 400", async () => {
    const team = await createTeam(routes);
    const { status, body } = await callRoute(routes, "POST", `/teams/${team.id}/members`, {
      role: "reviewer",
    });
    expect(status).toBe(400);
    expect((body as { error: string }).error).toBe("agentId is required");
  });

  test("body 无效返回 400", async () => {
    const team = await createTeam(routes);
    const { status } = await callRoute(routes, "POST", `/teams/${team.id}/members`, "bad");
    expect(status).toBe(400);
  });
});

describe("DELETE /teams/:id/members/:agentId — 移除成员", () => {
  let routes: Route[];
  beforeEach(() => {
    routes = buildRoutes();
  });

  test("happy path: 移除已有成员", async () => {
    const team = await createTeam(routes);
    // 先加一个可以移除的
    await callRoute(routes, "POST", `/teams/${team.id}/members`, { agentId: "removable" });
    const { status, body } = await callRoute(routes, "DELETE", `/teams/${team.id}/members/removable`);
    expect(status).toBe(200);
    const result = body as { team: { memberSpecs: Array<{ agentId: string }> } };
    expect(result.team.memberSpecs.some((m) => m.agentId === "removable")).toBe(false);
  });

  test("移除不存在的成员返回 404", async () => {
    const team = await createTeam(routes);
    const { status, body } = await callRoute(routes, "DELETE", `/teams/${team.id}/members/nonexistent`);
    expect(status).toBe(404);
    expect((body as { error: string }).error).toContain("not a member");
  });

  test("移除成员到不存在的 team 返回 404", async () => {
    const { status } = await callRoute(routes, "DELETE", "/teams/fake_id/members/any");
    expect(status).toBe(404);
  });

  test("重复移除同一个成员第二次返回 404", async () => {
    const team = await createTeam(routes);
    await callRoute(routes, "POST", `/teams/${team.id}/members`, { agentId: "dup" });
    await callRoute(routes, "DELETE", `/teams/${team.id}/members/dup`);
    const { status } = await callRoute(routes, "DELETE", `/teams/${team.id}/members/dup`);
    expect(status).toBe(404);
  });
});

// ─── Decompose ─────────────────────────────────────────────────────

describe("POST /teams/:id/decompose — 任务分解", () => {
  let routes: Route[];
  beforeEach(() => {
    routes = buildRoutes();
  });

  test("happy path: 返回分解计划", async () => {
    const team = await createTeam(routes);
    const { status, body } = await callRoute(routes, "POST", `/teams/${team.id}/decompose`, {
      taskPrompt: "实现登录功能",
    });
    expect(status).toBe(200);
    const result = body as { decomposition: Record<string, unknown> };
    expect(result.decomposition.taskId).toMatch(/^task_/);
    expect(result.decomposition.strategy).toBe("balanced");
    expect((result.decomposition.subtasks as unknown[]).length).toBeGreaterThan(0);
    expect(typeof result.decomposition.strategyMeta).toBe("object");
    expect(result.decomposition.estimatedCost).toBeUndefined();
  });

  test("forceStrategy 覆盖团队默认策略", async () => {
    const team = await createTeam(routes);
    const { body } = await callRoute(routes, "POST", `/teams/${team.id}/decompose`, {
      taskPrompt: "简单任务",
      forceStrategy: "conservative",
    });
    const result = body as { decomposition: { strategy: string; subtasks: unknown[] } };
    expect(result.decomposition.strategy).toBe("conservative");
    expect(result.decomposition.subtasks.length).toBe(1); // conservative 只有一个子任务
  });

  test("不存在的 team 返回 404", async () => {
    const { status } = await callRoute(routes, "POST", "/teams/fake_id/decompose", {
      taskPrompt: "x",
    });
    expect(status).toBe(404);
  });

  test("缺少 taskPrompt 返回 400", async () => {
    const team = await createTeam(routes);
    const { status, body } = await callRoute(routes, "POST", `/teams/${team.id}/decompose`, {});
    expect(status).toBe(400);
    expect((body as { error: string }).error).toBe("taskPrompt is required");
  });

  test("taskPrompt 为空格返回 400", async () => {
    const team = await createTeam(routes);
    const { status } = await callRoute(routes, "POST", `/teams/${team.id}/decompose`, {
      taskPrompt: "   ",
    });
    expect(status).toBe(400);
  });

  test("body 无效返回 400", async () => {
    const team = await createTeam(routes);
    const { status } = await callRoute(routes, "POST", `/teams/${team.id}/decompose`, "bad");
    expect(status).toBe(400);
  });

  test("不同复杂度的 prompt 返回不同 complexity", async () => {
    const team = await createTeam(routes);

    const low = (await callRoute(routes, "POST", `/teams/${team.id}/decompose`, {
      taskPrompt: "print hello",
    })).body as { decomposition: { complexity: string } };
    expect(low.decomposition.complexity).toBe("low");

    const high = (await callRoute(routes, "POST", `/teams/${team.id}/decompose`, {
      taskPrompt: "重构整个架构，实现分布式微服务系统",
    })).body as { decomposition: { complexity: string } };
    expect(high.decomposition.complexity).toBe("high");
  });
});

// ─── Run ────────────────────────────────────────────────────────────

/** 三个互不重复的可用 agent：让 balanced 分解出 implement + review 两只子任务 */
const threeAvailableAgents = async (): Promise<AgentDetectResult[]> => [
  { agentId: "opencode", available: true, binaryPath: "/usr/bin/opencode", version: "1.0", confidence: 0.95 },
  { agentId: "kimi", available: true, binaryPath: "/usr/bin/kimi", version: "2.0", confidence: 0.9 },
  { agentId: "claude-code", available: true, binaryPath: "/usr/bin/claude", version: "3.0", confidence: 0.9 },
];

describe("POST /teams/:id/run — 运行任务", () => {
  /** 只用于读回持久化状态；与 run 路由共用 teamStorePath（TeamStore 按路径复用连接） */
  let readerRoutes: Route[];
  beforeEach(() => {
    readerRoutes = buildRoutes();
  });

  async function createRunnableTeam(): Promise<{ id: string; [k: string]: unknown }> {
    const { body } = await callRoute(readerRoutes, "POST", "/teams", {
      name: "Runnable Team",
      members: [
        { agentId: "opencode", role: "primary" },
        { agentId: "kimi", role: "specialist" },
        { agentId: "claude-code", role: "reviewer" },
      ],
    });
    return (body as { team: { id: string; [k: string]: unknown } }).team;
  }

  test("dryRun=true 返回计划且不落盘执行结果", async () => {
    const routes = buildRoutes({
      detectAgents: threeAvailableAgents,
      executePlan: fakeAllCompleted,
    });
    const team = await createRunnableTeam();
    const { status, body } = await callRoute(routes, "POST", `/teams/${team.id}/run`, {
      taskPrompt: "实现功能",
      dryRun: true,
    });
    expect(status).toBe(200);
    // dryRun 响应体直接是顶层对象（不包裹在 { task: ... } 中）
    const result = body as { dryRun: boolean; strategy: string; subtasks: unknown[]; taskId: string };
    expect(result.dryRun).toBe(true);
    expect(result.strategy).toBe("balanced");
    expect(result.taskId).toMatch(/^task_/);
    expect((result.subtasks as unknown[]).length).toBe(2);
    const tasks = await callRoute(readerRoutes, "GET", `/teams/${team.id}/tasks`);
    expect((tasks.body as { tasks: unknown[] }).tasks).toEqual([]);
  });

  test("真实执行返回与 run-simple 同 shape，子任务落到终态", async () => {
    const routes = buildRoutes({
      detectAgents: threeAvailableAgents,
      executePlan: fakeAllCompleted,
    });
    const team = await createRunnableTeam();
    const { status, body } = await callRoute(routes, "POST", `/teams/${team.id}/run`, {
      taskPrompt: "实现功能",
    });
    expect(status).toBe(200);
    const result = body as {
      teamId: string;
      taskId: string;
      strategy: string;
      status: string;
      subtaskResults: Array<{ subtaskId: string; agentId: string; status: string; outputTail?: string }>;
      message: string;
    };
    expect(result.teamId).toBe(team.id);
    expect(result.taskId).toMatch(/^task_/);
    expect(result.status).toBe("completed");
    expect(result.subtaskResults.length).toBe(2);
    expect(result.message).toContain("completed");

    const tasks = (await callRoute(readerRoutes, "GET", `/teams/${team.id}/tasks`))
      .body as {
        tasks: Array<{ taskId: string; subtasks: Array<{ status: string }> }>;
      };
    expect(tasks.tasks.length).toBe(1);
    expect(tasks.tasks[0].taskId).toBe(result.taskId);
    for (const subtask of tasks.tasks[0].subtasks) {
      expect(subtask.status).toBe("completed");
    }
  });

  test("执行期间子任务状态实时落盘（running 与 pending 同时可见）", async () => {
    const team = await createRunnableTeam();
    let midRun: Array<{ subtaskId: string; status: string }> = [];

    const progressExecutor: RunSimpleExecutor = async (plan) => {
      plan.onProgress?.({ subtaskId: plan.subtasks[0].subtaskId, status: "running" });
      const snapshot = (await callRoute(readerRoutes, "GET", `/teams/${plan.teamId}/tasks`))
        .body as { tasks: Array<{ subtasks: Array<{ subtaskId: string; status: string }> }> };
      midRun = snapshot.tasks[0].subtasks;
      return fakeAllCompleted(plan);
    };

    const routes = buildRoutes({
      detectAgents: threeAvailableAgents,
      executePlan: progressExecutor,
    });
    const { status } = await callRoute(routes, "POST", `/teams/${team.id}/run`, {
      taskPrompt: "实现功能",
    });
    expect(status).toBe(200);
    expect(midRun.length).toBe(2);
    expect(midRun.filter((s) => s.status === "running").length).toBe(1);
    expect(midRun.filter((s) => s.status === "pending").length).toBe(1);
  });

  test("团队成员在本机均不可用时返回 400 且不留下 running 状态", async () => {
    const routes = buildRoutes({
      detectAgents: async () => [
        { agentId: "unrelated", available: true, binaryPath: "/usr/bin/unrelated", version: "1.0", confidence: 0.9 },
      ],
      executePlan: fakeAllCompleted,
    });
    const team = await createRunnableTeam();
    const { status, body } = await callRoute(routes, "POST", `/teams/${team.id}/run`, {
      taskPrompt: "实现功能",
    });
    expect(status).toBe(400);
    expect((body as { error: string }).error).toBe("no_agent_available");
    expect((body as { hint?: string }).hint).toContain("未检测到可用的 agent");

    const detail = (await callRoute(readerRoutes, "GET", `/teams/${team.id}`))
      .body as { team: { status: string; lastTaskResult?: unknown } };
    expect(detail.team.status).toBe("idle");
    expect(detail.team.lastTaskResult).toBeNull();
  });

  test("不存在的 team 返回 404", async () => {
    const routes = buildRoutes({
      detectAgents: threeAvailableAgents,
      executePlan: fakeAllCompleted,
    });
    const { status } = await callRoute(routes, "POST", "/teams/fake_id/run", {
      taskPrompt: "x",
    });
    expect(status).toBe(404);
  });

  test("缺少 taskPrompt 返回 400", async () => {
    const routes = buildRoutes({
      detectAgents: threeAvailableAgents,
      executePlan: fakeAllCompleted,
    });
    const team = await createRunnableTeam();
    const { status, body } = await callRoute(routes, "POST", `/teams/${team.id}/run`, {});
    expect(status).toBe(400);
    expect((body as { error: string }).error).toBe("taskPrompt is required");
  });

  test("taskPrompt 为空格返回 400", async () => {
    const routes = buildRoutes({
      detectAgents: threeAvailableAgents,
      executePlan: fakeAllCompleted,
    });
    const team = await createRunnableTeam();
    const { status } = await callRoute(routes, "POST", `/teams/${team.id}/run`, {
      taskPrompt: "  \t\n  ",
    });
    expect(status).toBe(400);
  });

  test("body 无效返回 400", async () => {
    const routes = buildRoutes({
      detectAgents: threeAvailableAgents,
      executePlan: fakeAllCompleted,
    });
    const team = await createRunnableTeam();
    const { status } = await callRoute(routes, "POST", `/teams/${team.id}/run`, null);
    expect(status).toBe(400);
  });
});

// ─── Tasks ──────────────────────────────────────────────────────────

describe("GET /teams/:id/tasks — 任务历史", () => {
  let routes: Route[];
  beforeEach(() => {
    routes = buildRoutes();
  });

  test("无任务时返回空数组", async () => {
    const team = await createTeam(routes);
    const { status, body } = await callRoute(routes, "GET", `/teams/${team.id}/tasks`);
    expect(status).toBe(200);
    expect((body as { tasks: unknown[] }).tasks).toEqual([]);
  });

  test("不存在的 team 返回 404", async () => {
    const { status } = await callRoute(routes, "GET", "/teams/fake_id/tasks");
    expect(status).toBe(404);
  });
});

// ─── Strategies ─────────────────────────────────────────────────────

describe("GET /team-strategies — 策略列表", () => {
  let routes: Route[];
  beforeEach(() => {
    routes = buildRoutes();
  });

  test("返回所有策略", async () => {
    const { status, body } = await callRoute(routes, "GET", "/team-strategies");
    expect(status).toBe(200);
    const result = body as { strategies: Array<{ id: string; name: string; description: string }> };
    expect(result.strategies.length).toBeGreaterThan(0);
    for (const s of result.strategies) {
      expect(typeof s.id).toBe("string");
      expect(typeof s.name).toBe("string");
      expect(typeof s.description).toBe("string");
    }
  });

  test("包含已知策略 id（conservative, balanced, aggressive）", async () => {
    const { body } = await callRoute(routes, "GET", "/team-strategies");
    const ids = (body as { strategies: Array<{ id: string }> }).strategies.map((s) => s.id);
    expect(ids).toContain("conservative");
    expect(ids).toContain("balanced");
    expect(ids).toContain("aggressive");
  });
});

describe("GET /team-strategies/:id — 单个策略详情", () => {
  let routes: Route[];
  beforeEach(() => {
    routes = buildRoutes();
  });

  test("存在的策略返回详情", async () => {
    const { status, body } = await callRoute(routes, "GET", "/team-strategies/balanced");
    expect(status).toBe(200);
    const result = body as { id: string; name: string; meta: Record<string, unknown>; dispatchPolicy: Record<string, unknown> };
    expect(result.id).toBe("balanced");
    expect(typeof result.name).toBe("string");
    expect(typeof result.meta).toBe("object");
    expect(typeof result.dispatchPolicy).toBe("object");
  });

  test("不存在的策略返回 404", async () => {
    const { status, body } = await callRoute(routes, "GET", "/team-strategies/nonexistent");
    expect(status).toBe(404);
    expect((body as { error: string }).error).toBe("strategy not found");
  });
});

// ─── Harnesses ──────────────────────────────────────────────────────

describe("GET /team-harnesses — Harness 列表", () => {
  let routes: Route[];
  beforeEach(() => {
    routes = buildRoutes();
  });

  test("至少包含 local-default", async () => {
    const { status, body } = await callRoute(routes, "GET", "/team-harnesses");
    expect(status).toBe(200);
    const result = body as { harnesses: Array<{ id: string; kind: string }> };
    expect(result.harnesses.length).toBeGreaterThan(0);
    expect(result.harnesses.some((h) => h.id === "local-default")).toBe(true);
  });

  test("每个 harness 包含必要字段", async () => {
    const { body } = await callRoute(routes, "GET", "/team-harnesses");
    const harnesses = (body as { harnesses: Array<Record<string, unknown>> }).harnesses;
    for (const h of harnesses) {
      expect(typeof h.id).toBe("string");
      expect(typeof h.kind).toBe("string");
      expect(typeof h.name).toBe("string");
    }
  });
});

describe("POST /team-harnesses — 注册 Harness", () => {
  let routes: Route[];
  beforeEach(() => {
    routes = buildRoutes();
  });

  test("happy path: 注册本地 harness", async () => {
    const { status, body } = await callRoute(routes, "POST", "/team-harnesses", {
      id: "custom-local",
      kind: "local",
      name: "Custom Local",
      description: "My custom harness",
    });
    expect(status).toBe(201);
    const result = body as { harness: { id: string; kind: string; name: string } };
    expect(result.harness.id).toBe("custom-local");
    expect(result.harness.kind).toBe("local");
    expect(result.harness.name).toBe("Custom Local");
  });

  test("happy path: 注册 SSH harness", async () => {
    const { status, body } = await callRoute(routes, "POST", "/team-harnesses", {
      id: "remote-ssh",
      kind: "ssh",
      name: "Remote Server",
      ssh: { host: "10.0.0.1", port: 22, username: "deploy" },
    });
    expect(status).toBe(201);
    const result = body as { harness: { id: string; kind: string; ssh: { host: string; port: number; username: string } } };
    expect(result.harness.kind).toBe("ssh");
    expect(result.harness.ssh.host).toBe("10.0.0.1");
    expect(result.harness.ssh.port).toBe(22);
    expect(result.harness.ssh.username).toBe("deploy");
  });

  test("happy path: 注册 cloud harness", async () => {
    const { status, body } = await callRoute(routes, "POST", "/team-harnesses", {
      id: "cloud-prod",
      kind: "cloud",
      name: "Production Cloud",
      cloud: { endpoint: "https://api.example.com", region: "us-east-1" },
    });
    expect(status).toBe(201);
    const result = body as { harness: { id: string; kind: string; cloud: { endpoint: string; region: string } } };
    expect(result.harness.kind).toBe("cloud");
    expect(result.harness.cloud.endpoint).toBe("https://api.example.com");
    expect(result.harness.cloud.region).toBe("us-east-1");
  });

  test("不指定 id 自动生成", async () => {
    const { body } = await callRoute(routes, "POST", "/team-harnesses", {
      kind: "local",
      name: "Auto ID",
    });
    const result = body as { harness: { id: string } };
    expect(result.harness.id.length).toBeGreaterThan(0);
  });

  test("不指定 name 默认为 Custom Harness", async () => {
    const { body } = await callRoute(routes, "POST", "/team-harnesses", {
      id: "no-name",
    });
    const result = body as { harness: { name: string } };
    expect(result.harness.name).toBe("Custom Harness");
  });

  test("body 无效返回 400", async () => {
    const { status } = await callRoute(routes, "POST", "/team-harnesses", "bad");
    expect(status).toBe(400);
  });

  test("注册后可通过列表查到", async () => {
    await callRoute(routes, "POST", "/team-harnesses", {
      id: "findable",
      name: "Findable Harness",
    });
    const { body } = await callRoute(routes, "GET", "/team-harnesses");
    const harnesses = (body as { harnesses: Array<{ id: string }> }).harnesses;
    expect(harnesses.some((h) => h.id === "findable")).toBe(true);
  });
});

describe("POST /team-harnesses/:id/health — Harness 健康检查", () => {
  let routes: Route[];
  beforeEach(() => {
    routes = buildRoutes();
  });

  test("local-default 返回健康状态", async () => {
    const { status, body } = await callRoute(routes, "POST", "/team-harnesses/local-default/health");
    expect(status).toBe(200);
    const result = body as { harnessId: string; health: Record<string, unknown> };
    expect(result.harnessId).toBe("local-default");
    expect(typeof result.health).toBe("object");
  });
});

// ─── run-simple edge cases ─────────────────────────────────────────

describe("POST /teams/run-simple — 额外边界条件", () => {
  test("prompt 含多行文本正常处理", async () => {
    const routes = buildRoutes({ detectAgents: availableAgents, executePlan: fakeAllCompleted });
    const { status, body } = await callRoute(routes, "POST", "/teams/run-simple", {
      prompt: "Line 1\nLine 2\nLine 3",
    });
    expect(status).toBe(200);
    const result = body as { status: string; subtaskResults: unknown[] };
    expect(result.status).toBe("completed");
    expect(result.subtaskResults.length).toBeGreaterThan(0);
  });

  test("prompt 含 unicode 正常处理", async () => {
    const routes = buildRoutes({ detectAgents: availableAgents, executePlan: fakeAllCompleted });
    const { status, body } = await callRoute(routes, "POST", "/teams/run-simple", {
      prompt: "实现飞书机器人 🤖",
    });
    expect(status).toBe(200);
    const result = body as { status: string };
    expect(result.status).toBe("completed");
  });

  test("prompt 为超长字符串不崩溃", async () => {
    const routes = buildRoutes({ detectAgents: availableAgents, executePlan: fakeAllCompleted });
    const longPrompt = "A".repeat(10_000);
    const { status } = await callRoute(routes, "POST", "/teams/run-simple", {
      prompt: longPrompt,
    });
    expect(status).toBe(200);
  });

  test("body 完全缺失返回 400", async () => {
    const routes = buildRoutes();
    const { status } = await callRoute(routes, "POST", "/teams/run-simple", {});
    expect(status).toBe(400);
  });

  test("body 是数组而不是对象返回 400", async () => {
    const routes = buildRoutes();
    const { status } = await callRoute(routes, "POST", "/teams/run-simple", [1, 2, 3]);
    expect(status).toBe(400);
  });

  test("多 agent 场景：balanced 策略分配 specialist + reviewer 到子任务", async () => {
    const threeAgents = async (): Promise<AgentDetectResult[]> => [
      { agentId: "opencode", available: true, binaryPath: "/bin/opencode", version: "1.0", confidence: 0.95 },
      { agentId: "kimi", available: true, binaryPath: "/bin/kimi", version: "2.0", confidence: 0.9 },
      { agentId: "claude", available: true, binaryPath: "/bin/claude", version: "1.0", confidence: 0.85 },
    ];
    const routes = buildRoutes({ detectAgents: threeAgents, executePlan: fakeAllCompleted });
    const { status, body } = await callRoute(routes, "POST", "/teams/run-simple", {
      prompt: "复杂任务",
    });
    expect(status).toBe(200);
    const result = body as { subtaskResults: Array<{ agentId: string; prompt: string }> };
    // balanced 策略: specialist(implement) + reviewer(review)，primary 不在 subtasks 中
    const agentIds = result.subtaskResults.map((s) => s.agentId);
    expect(agentIds).toContain("kimi");
    expect(agentIds).toContain("claude");
    expect(result.subtaskResults.some((s) => s.prompt.includes("Implement"))).toBe(true);
    expect(result.subtaskResults.some((s) => s.prompt.includes("Review"))).toBe(true);
  });

  test("只有一个 agent 时仍然可以执行", async () => {
    const oneAgent = async (): Promise<AgentDetectResult[]> => [
      { agentId: "solo", available: true, binaryPath: "/bin/solo", version: "1.0", confidence: 0.9 },
    ];
    const routes = buildRoutes({ detectAgents: oneAgent, executePlan: fakeAllCompleted });
    const { status, body } = await callRoute(routes, "POST", "/teams/run-simple", {
      prompt: "简单任务",
    });
    expect(status).toBe(200);
    const result = body as { subtaskResults: Array<{ agentId: string }> };
    expect(result.subtaskResults.some((s) => s.agentId === "solo")).toBe(true);
  });

  test("执行器抛异常时路由未捕获，异常传播（不静默吞掉）", async () => {
    const throwingExecutor: RunSimpleExecutor = async () => {
      throw new Error("executor crashed");
    };
    const routes = buildRoutes({ detectAgents: availableAgents, executePlan: throwingExecutor });
    // run-simple 没有 try/catch 包裹 runner，异常直接传播
    await expect(
      callRoute(routes, "POST", "/teams/run-simple", { prompt: "会崩溃的任务" }),
    ).rejects.toThrow();
  });
});
