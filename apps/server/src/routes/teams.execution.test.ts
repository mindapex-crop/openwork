/**
 * 真实执行器（executeCollabPlan）的 fan-out 事件映射测试
 *
 * 只替换 agent-team 内核的两个入口，分解、落盘、路由与终态快照全部走真实代码：
 * - 失败子任务的 error 文本必须同时出现在实时快照与终态快照
 *   （曾因终态只读 finalText 把失败原因整个丢掉，UI 上只剩一个 failed）
 * - 超长 error 与成功输出一律截断后再落盘
 */
import { beforeAll, describe, expect, mock, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ApprovalService } from "../approvals.js";
import type { ReloadEventStore } from "../events.js";
import type { TokenService } from "../tokens.js";
import type { ServerConfig } from "../types.js";
import type { AgentDetectResult } from "../agent-sidecar/types.js";
import type {
  AgentTeamConfig,
  AgentTeamHandle,
  FanOutEvent,
  FanOutInput,
} from "../agent-team/types.js";
import { matchRoute, type RequestContext, type Route } from "./registry.js";

const STOPPED_AGENT = "kimi";
const FIRST_OUTPUT = "已经实现完毕";
/** 上一次「运行中」快照：由 fake 内核在 subtask-failed 之后读回 */
let liveRowsAfterFailure: SnapshotRow[] = [];
let fakeError = "";
let fakeTeamId = "";
let storePath = "";

type SnapshotRow = { subtaskId: string; status: string; outputTail?: string };
type RunResponse = {
  teamId: string;
  taskId: string;
  status: string;
  subtaskResults: Array<{ agentId: string; status: string; outputTail?: string; subtaskId: string }>;
};

async function* fakeFanOut(_team: unknown, input: FanOutInput): AsyncGenerator<FanOutEvent> {
  const failed = input.assignments.find((a) => a.agentId === STOPPED_AGENT);
  const results: Array<{ subtaskId: string; agentId: string; finalText: string | null; error?: string }> = [];

  for (const assignment of input.assignments) {
    if (assignment === failed) continue;
    yield { kind: "subtask-assigned", fanOutId: input.fanOutId, subtaskId: assignment.subtaskId, agentId: assignment.agentId };
    yield {
      kind: "subtask-completed",
      fanOutId: input.fanOutId,
      subtaskId: assignment.subtaskId,
      agentId: assignment.agentId,
      finalText: FIRST_OUTPUT,
    };
    results.push({ subtaskId: assignment.subtaskId, agentId: assignment.agentId, finalText: FIRST_OUTPUT });
  }

  if (failed) {
    yield { kind: "subtask-assigned", fanOutId: input.fanOutId, subtaskId: failed.subtaskId, agentId: failed.agentId };
    yield {
      kind: "subtask-failed",
      fanOutId: input.fanOutId,
      subtaskId: failed.subtaskId,
      agentId: failed.agentId,
      error: fakeError,
    };
    // 此刻路由的 onProgress 已同步写盘，读回来的就是运行中快照
    liveRowsAfterFailure = await readTaskRows();
    results.push({ subtaskId: failed.subtaskId, agentId: failed.agentId, finalText: null, error: fakeError });
  }

  yield { kind: "fanout-completed", fanOutId: input.fanOutId, results };
}

mock.module("../agent-team/index.js", () => ({
  createAgentTeam: async (config: AgentTeamConfig): Promise<AgentTeamHandle> => {
    fakeTeamId = config.teamId;
    return { stop: async () => {} } as AgentTeamHandle;
  },
  fanOutTask: (team: unknown, input: FanOutInput) => fakeFanOut(team, input),
}));

const { registerTeamRoutes } = await import("./teams.js");

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

async function callRoute(routes: Route[], method: string, path: string, body?: unknown): Promise<unknown> {
  const route = matchRoute(routes, method, path);
  if (!route) throw new Error(`${method} ${path} not matched`);
  const request = new Request(`http://localhost${path}`, {
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    headers: { "content-type": "application/json" },
  });
  const ctx: RequestContext = {
    request,
    url: new URL(request.url),
    params: route.params,
    config: {} as ServerConfig,
    approvals: {} as ApprovalService,
    reloadEvents: {} as ReloadEventStore,
    tokens: {} as TokenService,
  };
  const response = await route.handler(ctx);
  return response.json();
}

function buildRoutes(): Route[] {
  const routes: Route[] = [];
  // 不注入 executePlan：让 /teams/:id/run 走真实的 executeCollabPlan
  registerTeamRoutes({
    routes,
    jsonResponse,
    readJsonBody: (request) => request.json(),
    detectAgents: availableAgents,
    teamStorePath: storePath,
  });
  return routes;
}

const memberSpecs = [
  { agentId: "opencode", role: "primary" },
  { agentId: STOPPED_AGENT, role: "specialist" },
  { agentId: "claude-code", role: "reviewer" },
];

const availableAgents = async (): Promise<AgentDetectResult[]> =>
  memberSpecs.map((m) => ({
    agentId: m.agentId,
    available: true,
    binaryPath: `/usr/bin/${m.agentId}`,
    version: "1.0",
    confidence: 0.9,
  }));

async function createTeam(routes: Route[]): Promise<string> {
  const body = (await callRoute(routes, "POST", "/teams", { name: "exec-team", members: memberSpecs })) as {
    team: { id: string };
  };
  return body.team.id;
}

/** 读取当前任务快照（fake 内核在运行中调用时读到的即实时状态） */
async function readTaskRows(): Promise<SnapshotRow[]> {
  const body = (await callRoute(buildRoutes(), "GET", `/teams/${fakeTeamId}/tasks`)) as {
    tasks: Array<{ subtasks: SnapshotRow[] }>;
  };
  const latest = body.tasks[body.tasks.length - 1];
  return latest?.subtasks ?? [];
}

async function runTeam(error: string): Promise<RunResponse> {
  fakeError = error;
  liveRowsAfterFailure = [];
  const routes = buildRoutes();
  const teamId = await createTeam(routes);
  const body = (await callRoute(routes, "POST", `/teams/${teamId}/run`, {
    taskPrompt: "实现登录功能并补充测试",
  })) as RunResponse;
  expect(body.teamId).toBe(teamId);
  return body;
}

function snapshotRow(rows: SnapshotRow[], subtaskId: string | undefined): SnapshotRow {
  const row = rows.find((r) => r.subtaskId === subtaskId);
  if (!row) throw new Error(`snapshot is missing subtask ${subtaskId ?? "<none>"}`);
  return row;
}

beforeAll(async () => {
  storePath = join(await mkdtemp(join(tmpdir(), "teams-exec-")), "teams.sqlite");
});

describe("executeCollabPlan 的 fan-out 事件映射", () => {
  test("失败子任务的 error 文本保留在实时快照与终态快照", async () => {
    const error = "agent 启动失败：ENOENT /usr/bin/kimi";
    const result = await runTeam(error);

    expect(result.status).toBe("partial");
    const failed = result.subtaskResults.find((s) => s.status === "failed");
    expect(failed?.agentId).toBe(STOPPED_AGENT);
    expect(failed?.outputTail).toBe(error);
    expect(result.subtaskResults.find((s) => s.status === "completed")?.outputTail).toBe(FIRST_OUTPUT);

    const live = snapshotRow(liveRowsAfterFailure, failed?.subtaskId);
    expect(live.status).toBe("failed");
    expect(live.outputTail).toBe(error);

    const rows = await readTaskRows();
    expect(snapshotRow(rows, failed?.subtaskId).outputTail).toBe(error);
    expect(rows.find((r) => r.status === "completed")?.outputTail).toBe(FIRST_OUTPUT);
  });

  test("超长 error 在实时与终态快照里都已截断", async () => {
    const longError = `启动失败 ${"x".repeat(2_500)}`;
    const result = await runTeam(longError);
    const failed = result.subtaskResults.find((s) => s.status === "failed");
    const expected = `…${longError.slice(-2_000)}`;

    expect(failed?.outputTail).toBe(expected);
    expect(snapshotRow(liveRowsAfterFailure, failed?.subtaskId).outputTail).toBe(expected);
    expect(snapshotRow(await readTaskRows(), failed?.subtaskId).outputTail).toBe(expected);
  });
});
