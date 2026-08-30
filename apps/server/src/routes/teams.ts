/**
 * Team 路由 - Agent Team 管理与执行
 *
 * GET    /teams                            → 列出所有 team
 * POST   /teams                            → 创建新 team
 * GET    /teams/:id                        → 获取 team 详情
 * PUT    /teams/:id                        → 更新 team 配置
 * DELETE /teams/:id                        → 删除 team
 * POST   /teams/:id/members                → 添加成员
 * DELETE /teams/:id/members/:agentId       → 移除成员
 * POST   /teams/run-simple                 → 一键协作（自动探测 agent + 建团队 + 执行）
 * POST   /teams/:id/run                    → 运行 team 任务（分解 + 执行）
 * POST   /teams/:id/decompose              → 仅分解任务（不执行）
 * GET    /teams/:id/tasks                  → 列出 team 任务历史
 * GET    /team-strategies                  → 列出可用策略
 * GET    /team-harnesses                   → 列出可用 harness 环境
 * POST   /team-harnesses                   → 注册新 harness
 * POST   /team-harnesses/:id/health        → 检查 harness 健康状态
 */

import { addRoute, type Route } from "./registry.js";
import { detectAllAgents } from "../agent-sidecar/detect.js";
import type { AgentDetectResult } from "../agent-sidecar/types.js";
import { createAdapterForAgent } from "../agent-sidecar/index.js";
import {
  createAgentTeam,
  fanOutTask,
  type AgentTeamConfig,
  type MemberRole,
} from "../agent-team/index.js";
import { getGlobalHarnessManager, type HarnessDefinition } from "../agent-team/harness-environment.js";
import {
  getStrategyConfig,
  listStrategies,
  assessTaskComplexity,
  buildTeamConfigFromStrategy,
  type TeamStrategyId,
} from "../agent-team/team-strategies.js";
import { TeamStore, defaultTeamStorePath, type StoredTeam } from "./team-store.js";

export interface RegisterTeamRoutesOptions {
  routes: Route[];
  jsonResponse: (data: unknown, status?: number) => Response;
  readJsonBody: (request: Request) => Promise<unknown>;
  createTeamClient?: () => unknown;
  /** 本机可用 agent 探测（默认 detectAllAgents，测试可注入 mock） */
  detectAgents?: () => Promise<AgentDetectResult[]>;
  /** 一键协作执行依赖（默认真实并行执行，测试可注入假实现，避免真实 spawn agent） */
  executePlan?: RunSimpleExecutor;
  /** 团队持久化 sqlite 路径（测试可注入临时路径，缺省 OPENWORK_TEAMS_DB 或配置目录 teams.sqlite） */
  teamStorePath?: string;
}

/** run-simple 单个子任务的执行结果（面向普通用户的简化结构） */
export interface CollabSubtaskResult {
  subtaskId: string;
  agentId: string;
  prompt: string;
  status: "completed" | "failed";
  outputTail?: string;
}

/** 执行过程中单个子任务的实时状态（终态之前也会落盘，供轮询查看） */
export interface CollabSubtaskProgress {
  subtaskId: string;
  status: "running" | "completed" | "failed";
  outputTail?: string;
}

/** run-simple 执行计划的输入 */
export interface RunSimpleExecutionInput {
  teamId: string;
  taskId: string;
  prompt: string;
  subtasks: Array<{ subtaskId: string; agentId: string; prompt: string; dependencies: string[] }>;
  memberSpecs: Array<{ agentId: string; role?: string }>;
  /** 子任务状态变化回调：路由据此实时落盘，GET /teams/:id/tasks 才轮询得到进度 */
  onProgress?: (progress: CollabSubtaskProgress) => void;
}

/** run-simple 执行计划的输出 */
export interface RunSimpleExecutionResult {
  status: "completed" | "failed" | "partial";
  subtaskResults: CollabSubtaskResult[];
  message: string;
}

/** 一键协作执行函数签名（可注入，便于测试不真实 spawn agent） */
export type RunSimpleExecutor = (plan: RunSimpleExecutionInput) => Promise<RunSimpleExecutionResult>;

export { type StoredTeam } from "./team-store.js";

/** 执行中实时回写的任务快照（与持久化契约同源，含可选 outputTail） */
type LiveTaskResult = NonNullable<StoredTeam["lastTaskResult"]>;

function generateTeamId(): string {
  return `team_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

/** 本机没有任何可用 CLI agent 时的统一提示（执行路径都依赖已安装的 agent） */
const NO_AGENT_AVAILABLE_HINT =
  "未检测到可用的 agent。请先安装任意支持的 CLI agent（如 opencode、kimi、claude-code、codex）后再试。";

const MEMBER_ROLES: readonly MemberRole[] = [
  "primary",
  "reviewer",
  "fallback",
  "specialist",
  "observer",
  "synthesizer",
];

/** StoredTeam 里的 role 是自由字符串，交给内核前先收窄 */
function toMemberRole(role: string | undefined): MemberRole | undefined {
  return MEMBER_ROLES.find((candidate) => candidate === role);
}

export function registerTeamRoutes(options: RegisterTeamRoutesOptions): void {
  const { routes, jsonResponse, readJsonBody, detectAgents, executePlan } = options;

  // 团队持久化：sqlite（按路径缓存连接，同路径复用）
  function getTeamStore(): Promise<TeamStore> {
    return TeamStore.getOrOpen(options.teamStorePath ?? defaultTeamStorePath());
  }

  /**
   * 真实执行一条团队任务：分解 → 落盘 running → 执行期间按子任务实时回写 →
   * 折叠终态。run-simple 与 /teams/:id/run 共用这一条路径，两者的响应 shape 因此一致。
   */
  async function runTask(
    store: TeamStore,
    team: StoredTeam,
    strategyId: TeamStrategyId,
    taskPrompt: string,
    memberSpecs: Array<{ agentId: string; role?: string }>,
  ): Promise<RunSimpleExecutionResult & { taskId: string }> {
    const subtasks = generateDecomposition(taskPrompt, memberSpecs, strategyId);
    const taskId = `task_${Date.now().toString(36)}`;
    const live: LiveTaskResult = {
      taskId,
      subtasks: subtasks.map((s) => ({
        subtaskId: s.subtaskId,
        agentId: s.agentId,
        prompt: s.prompt,
        status: "pending",
      })),
      completedAt: Date.now(),
    };

    team.status = "running";
    team.updatedAt = Date.now();
    team.lastTaskResult = live;
    store.set(team);

    const runner = executePlan ?? executeCollabPlan;
    const result = await runner({
      teamId: team.id,
      taskId,
      prompt: taskPrompt,
      subtasks,
      memberSpecs,
      onProgress: (progress) => {
        const row = live.subtasks.find((s) => s.subtaskId === progress.subtaskId);
        if (!row) return;
        row.status = progress.status;
        if (progress.outputTail) row.outputTail = progress.outputTail;
        team.updatedAt = Date.now();
        store.set(team);
      },
    });

    // 任一子任务失败不应使整体 500：失败情况已折叠进 subtaskResults + status
    team.status = result.status === "failed" ? "failed" : "completed";
    team.updatedAt = Date.now();
    team.lastTaskResult = {
      taskId,
      subtasks: result.subtaskResults.map((s) => ({
        subtaskId: s.subtaskId,
        agentId: s.agentId,
        prompt: s.prompt,
        status: s.status,
        ...(s.outputTail ? { outputTail: s.outputTail } : {}),
      })),
      completedAt: Date.now(),
    };
    store.set(team);

    return { ...result, taskId };
  }

  // ============ Team CRUD ============

  addRoute(routes, "GET", "/teams", "client", async () => {
    const store = await getTeamStore();
    const teams = store.list().map((t) => ({
      id: t.id,
      name: t.name,
      strategy: t.strategy,
      memberCount: t.memberSpecs.length,
      harnessId: t.harnessId,
      status: t.status,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    }));
    return jsonResponse({ teams });
  });

  addRoute(routes, "POST", "/teams", "client", async (ctx) => {
    const body = await readJsonBody(ctx.request);
    if (!body || typeof body !== "object") {
      return jsonResponse({ error: "invalid body" }, 400);
    }

    const { name, strategy, members, harnessId } = body as {
      name?: string;
      strategy?: TeamStrategyId;
      members?: Array<{ agentId: string; role?: string }>;
      harnessId?: string;
    };

    if (!name || !name.trim()) {
      return jsonResponse({ error: "team name is required" }, 400);
    }
    if (!members || members.length === 0) {
      return jsonResponse({ error: "at least one team member is required" }, 400);
    }

    const harnessManager = getGlobalHarnessManager();
    const resolvedHarnessId = harnessId ?? "local-default";
    if (!harnessManager.getHarness(resolvedHarnessId)) {
      return jsonResponse({ error: `harness '${resolvedHarnessId}' not found` }, 400);
    }

    const teamId = generateTeamId();
    const strategyId: TeamStrategyId = strategy ?? "balanced";

    const team: StoredTeam = {
      id: teamId,
      name: name.trim(),
      strategy: strategyId,
      memberSpecs: members.map((m) => ({
        agentId: m.agentId,
        role: m.role ?? "specialist",
      })),
      harnessId: resolvedHarnessId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: "idle",
    };

    const store = await getTeamStore();
    store.set(team);
    return jsonResponse({ team: serializeTeam(team) }, 201);
  });

  addRoute(routes, "GET", "/teams/:id", "client", async (ctx) => {
    const teamId = ctx.params.id;
    const store = await getTeamStore();
    const team = store.get(teamId);
    if (!team) {
      return jsonResponse({ error: "team not found" }, 404);
    }
    return jsonResponse({ team: serializeTeam(team) });
  });

  addRoute(routes, "PUT", "/teams/:id", "client", async (ctx) => {
    const teamId = ctx.params.id;
    const store = await getTeamStore();
    const team = store.get(teamId);
    if (!team) {
      return jsonResponse({ error: "team not found" }, 404);
    }

    const body = await readJsonBody(ctx.request);
    if (!body || typeof body !== "object") {
      return jsonResponse({ error: "invalid body" }, 400);
    }

    const updates = body as {
      name?: string;
      strategy?: TeamStrategyId;
      members?: Array<{ agentId: string; role?: string }>;
      harnessId?: string;
    };

    if (updates.name !== undefined) {
      team.name = updates.name.trim();
    }
    if (updates.strategy !== undefined) {
      team.strategy = updates.strategy;
    }
    if (updates.members !== undefined) {
      team.memberSpecs = updates.members.map((m) => ({
        agentId: m.agentId,
        role: m.role ?? "specialist",
      }));
    }
    if (updates.harnessId !== undefined) {
      team.harnessId = updates.harnessId;
    }
    team.updatedAt = Date.now();

    store.set(team);
    return jsonResponse({ team: serializeTeam(team) });
  });

  addRoute(routes, "DELETE", "/teams/:id", "client", async (ctx) => {
    const teamId = ctx.params.id;
    const store = await getTeamStore();
    const removed = store.delete(teamId);
    if (!removed) {
      return jsonResponse({ error: "team not found" }, 404);
    }
    return jsonResponse({ ok: true });
  });

  // ============ Team Member Management ============

  addRoute(routes, "POST", "/teams/:id/members", "client", async (ctx) => {
    const teamId = ctx.params.id;
    const store = await getTeamStore();
    const team = store.get(teamId);
    if (!team) {
      return jsonResponse({ error: "team not found" }, 404);
    }

    const body = await readJsonBody(ctx.request);
    if (!body || typeof body !== "object") {
      return jsonResponse({ error: "invalid body" }, 400);
    }

    const { agentId, role } = body as { agentId?: string; role?: string };
    if (!agentId) {
      return jsonResponse({ error: "agentId is required" }, 400);
    }

    if (team.memberSpecs.some((m) => m.agentId === agentId)) {
      return jsonResponse({ error: `agent '${agentId}' is already a member` }, 409);
    }

    team.memberSpecs.push({ agentId, role: role ?? "specialist" });
    team.updatedAt = Date.now();

    store.set(team);
    return jsonResponse({ team: serializeTeam(team) }, 201);
  });

  addRoute(routes, "DELETE", "/teams/:id/members/:agentId", "client", async (ctx) => {
    const teamId = ctx.params.id;
    const agentId = ctx.params.agentId;
    const store = await getTeamStore();
    const team = store.get(teamId);
    if (!team) {
      return jsonResponse({ error: "team not found" }, 404);
    }

    const idx = team.memberSpecs.findIndex((m) => m.agentId === agentId);
    if (idx === -1) {
      return jsonResponse({ error: `agent '${agentId}' is not a member` }, 404);
    }

    team.memberSpecs.splice(idx, 1);
    team.updatedAt = Date.now();

    store.set(team);
    return jsonResponse({ team: serializeTeam(team) });
  });

  // ============ 一键协作（简化用户入口，隐藏 CLI/agent/harness 概念）============

  addRoute(routes, "POST", "/teams/run-simple", "client", async (ctx) => {
    const body = await readJsonBody(ctx.request);
    if (!body || typeof body !== "object") {
      return jsonResponse({ error: "invalid body" }, 400);
    }

    const { prompt } = body as { prompt?: string };
    if (!prompt || !prompt.trim()) {
      return jsonResponse({ error: "prompt is required" }, 400);
    }

    // 探测本机已装且可用的 agent（默认 detectAllAgents，测试可注入 mock）
    const detect = detectAgents ?? detectAllAgents;
    const available = (await detect()).filter((r) => r.available);

    if (available.length === 0) {
      return jsonResponse({ error: "no_agent_available", hint: NO_AGENT_AVAILABLE_HINT }, 400);
    }

    // 自动分配角色：主力 + 若干 specialist/reviewer
    const memberSpecs: Array<{ agentId: string; role: "primary" | "specialist" | "reviewer" }> =
      available.map((a, i) => ({
        agentId: a.agentId,
        role: i === 0 ? "primary" : i === 1 ? "specialist" : i === 2 ? "reviewer" : "specialist",
      }));

    const teamId = generateTeamId();
    const strategyId: TeamStrategyId = "balanced";
    const team: StoredTeam = {
      id: teamId,
      name: "任务 自动团队",
      strategy: strategyId,
      memberSpecs,
      harnessId: "local-default",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: "idle",
    };
    const store = await getTeamStore();
    store.set(team);

    const result = await runTask(store, team, strategyId, prompt.trim(), memberSpecs);

    return jsonResponse({
      teamId,
      taskId: result.taskId,
      strategy: strategyId,
      status: result.status,
      subtaskResults: result.subtaskResults,
      message: result.message,
    });
  });

  // ============ Team Task Execution ============

  addRoute(routes, "POST", "/teams/:id/decompose", "client", async (ctx) => {
    const teamId = ctx.params.id;
    const store = await getTeamStore();
    const team = store.get(teamId);
    if (!team) {
      return jsonResponse({ error: "team not found" }, 404);
    }

    const body = await readJsonBody(ctx.request);
    if (!body || typeof body !== "object") {
      return jsonResponse({ error: "invalid body" }, 400);
    }

    const { taskPrompt, forceStrategy } = body as {
      taskPrompt?: string;
      forceStrategy?: TeamStrategyId;
    };

    if (!taskPrompt || !taskPrompt.trim()) {
      return jsonResponse({ error: "taskPrompt is required" }, 400);
    }

    const strategyId = forceStrategy ?? team.strategy;
    const complexity = assessTaskComplexity(taskPrompt);
    const strategy = getStrategyConfig(strategyId);

    const decomposition = {
      taskId: `task_${Date.now().toString(36)}`,
      complexity,
      strategy: strategyId,
      strategyMeta: strategy.meta,
      suggestedApproach: strategy.relayStrategy?.kind ?? "direct",
      // 基于策略和成员信息生成的预分解结果
      subtasks: generateDecomposition(taskPrompt, team.memberSpecs, strategyId),
    };

    return jsonResponse({ decomposition });
  });

  addRoute(routes, "POST", "/teams/:id/run", "client", async (ctx) => {
    const teamId = ctx.params.id;
    const store = await getTeamStore();
    const team = store.get(teamId);
    if (!team) {
      return jsonResponse({ error: "team not found" }, 404);
    }

    const body = await readJsonBody(ctx.request);
    if (!body || typeof body !== "object") {
      return jsonResponse({ error: "invalid body" }, 400);
    }

    const { taskPrompt, forceStrategy, dryRun } = body as {
      taskPrompt?: string;
      forceStrategy?: TeamStrategyId;
      dryRun?: boolean;
    };

    if (!taskPrompt || !taskPrompt.trim()) {
      return jsonResponse({ error: "taskPrompt is required" }, 400);
    }

    const strategyId = forceStrategy ?? team.strategy;
    const complexity = assessTaskComplexity(taskPrompt);

    if (dryRun) {
      return jsonResponse({
        taskId: `task_${Date.now().toString(36)}`,
        dryRun: true,
        strategy: strategyId,
        complexity,
        subtasks: generateDecomposition(taskPrompt, team.memberSpecs, strategyId),
      });
    }

    // 真实执行依赖本机已安装且可用的 CLI agent：团队里至少要有一个可用成员
    const detect = detectAgents ?? detectAllAgents;
    const usable = (await detect()).filter((r) => r.available);
    const usableAgentIds = new Set(usable.map((r) => r.agentId));
    const runnableSpecs = team.memberSpecs.filter((m) => usableAgentIds.has(m.agentId));
    if (runnableSpecs.length === 0) {
      return jsonResponse({ error: "no_agent_available", hint: NO_AGENT_AVAILABLE_HINT }, 400);
    }

    const result = await runTask(store, team, strategyId, taskPrompt.trim(), runnableSpecs);

    return jsonResponse({
      teamId,
      taskId: result.taskId,
      strategy: strategyId,
      status: result.status,
      subtaskResults: result.subtaskResults,
      message: result.message,
    });
  });

  addRoute(routes, "GET", "/teams/:id/tasks", "client", async (ctx) => {
    const teamId = ctx.params.id;
    const store = await getTeamStore();
    const team = store.get(teamId);
    if (!team) {
      return jsonResponse({ error: "team not found" }, 404);
    }

    return jsonResponse({
      tasks: team.lastTaskResult ? [team.lastTaskResult] : [],
    });
  });

  // ============ Strategy Routes ============

  addRoute(routes, "GET", "/team-strategies", "client", async () => {
    const strategies = listStrategies().map((s) => ({
      id: s.id,
      name: s.meta.name,
      description: s.meta.description,
      complexity: s.meta.complexity,
      costLevel: s.meta.costLevel,
      qualityLevel: s.meta.qualityLevel,
      maxSubtasks: s.maxSubtasks,
      enableReviewLoop: s.enableReviewLoop,
    }));
    return jsonResponse({ strategies });
  });

  addRoute(routes, "GET", "/team-strategies/:id", "client", async (ctx) => {
    try {
      const strategy = getStrategyConfig(ctx.params.id as TeamStrategyId);
      return jsonResponse({
        id: strategy.id,
        name: strategy.meta.name,
        description: strategy.meta.description,
        meta: strategy.meta,
        supervisor: {
          providerID: strategy.supervisor.providerID,
          modelID: strategy.supervisor.modelID,
          maxSubtasks: strategy.supervisor.maxSubtasks,
          enableReviewLoop: strategy.supervisor.enableReviewLoop,
        },
        dispatchPolicy: strategy.dispatchPolicy,
        relayStrategy: strategy.relayStrategy,
        roleModelOverrides: strategy.roleModelOverrides,
      });
    } catch {
      return jsonResponse({ error: "strategy not found" }, 404);
    }
  });

  // ============ Harness Routes ============

  addRoute(routes, "GET", "/team-harnesses", "client", async () => {
    const harnessManager = getGlobalHarnessManager();
    const harnesses = harnessManager.listHarnesses().map(serializeHarness);
    return jsonResponse({ harnesses });
  });

  addRoute(routes, "POST", "/team-harnesses", "client", async (ctx) => {
    const body = await readJsonBody(ctx.request);
    if (!body || typeof body !== "object") {
      return jsonResponse({ error: "invalid body" }, 400);
    }

    const harnessManager = getGlobalHarnessManager();
    const harness = buildHarnessFromBody(body as Record<string, unknown>);
    harnessManager.registerHarness(harness);

    return jsonResponse({ harness: serializeHarness(harness) }, 201);
  });

  addRoute(routes, "POST", "/team-harnesses/:id/health", "client", async (ctx) => {
    const harnessManager = getGlobalHarnessManager();
    const health = await harnessManager.checkHealth(ctx.params.id);
    return jsonResponse({ harnessId: ctx.params.id, health });
  });
}

// ============ 辅助函数 ============

function serializeTeam(team: StoredTeam) {
  return {
    id: team.id,
    name: team.name,
    strategy: team.strategy,
    memberSpecs: team.memberSpecs,
    harnessId: team.harnessId,
    createdAt: team.createdAt,
    updatedAt: team.updatedAt,
    status: team.status,
    lastTaskResult: team.lastTaskResult ?? null,
  };
}

function serializeHarness(h: HarnessDefinition) {
  return {
    id: h.id,
    kind: h.kind,
    name: h.name,
    description: h.description,
    capabilities: h.capabilities,
    rootPath: h.rootPath,
    health: h.health ?? null,
    ...(h.sshConfig ? { ssh: { host: h.sshConfig.host, port: h.sshConfig.port, username: h.sshConfig.username } } : {}),
    ...(h.cloudConfig ? { cloud: { endpoint: h.cloudConfig.endpoint, region: h.cloudConfig.region } } : {}),
  };
}

function buildHarnessFromBody(body: Record<string, unknown>): HarnessDefinition {
  const kind = (body.kind as string) ?? "local";
  const id = (body.id as string) ?? `custom-${Date.now().toString(36)}`;
  const name = (body.name as string) ?? "Custom Harness";

  const base: HarnessDefinition = {
    id,
    kind: kind as HarnessDefinition["kind"],
    name,
    description: (body.description as string) ?? "Custom harness",
    capabilities: {
      pty: true,
      acp: true,
      http: true,
      mcp: false,
      gpu: false,
      docker: false,
      maxConcurrentAgents: 4,
    },
  };

  if (kind === "ssh" && body.ssh && typeof body.ssh === "object") {
    const ssh = body.ssh as Record<string, unknown>;
    base.sshConfig = {
      host: (ssh.host as string) ?? "localhost",
      port: (ssh.port as number) ?? 22,
      username: (ssh.username as string) ?? "root",
      privateKeyPath: ssh.privateKeyPath as string | undefined,
      jumpHost: ssh.jumpHost as string | undefined,
    };
    base.capabilities.maxConcurrentAgents = 8;
  }

  if (kind === "cloud" && body.cloud && typeof body.cloud === "object") {
    const cloud = body.cloud as Record<string, unknown>;
    base.cloudConfig = {
      endpoint: (cloud.endpoint as string) ?? "https://api.openworklabs.com",
      authToken: cloud.authToken as string | undefined,
      region: cloud.region as string | undefined,
    };
    base.capabilities.gpu = true;
    base.capabilities.mcp = true;
    base.capabilities.maxConcurrentAgents = 16;
  }

  return base;
}

/** 生成任务分解（简化版，实际应由 LLM Supervisor 执行） */
function generateDecomposition(
  taskPrompt: string,
  members: Array<{ agentId: string; role?: string }>,
  strategyId: TeamStrategyId,
): Array<{ subtaskId: string; agentId: string; prompt: string; dependencies: string[] }> {
  const primary = members.find((m) => m.role === "primary") ?? members[0];
  const specialist = members.find((m) => m.role === "specialist") ?? primary;
  const reviewer = members.find((m) => m.role === "reviewer");
  const fallback = members.find((m) => m.role === "fallback");

  const base = Date.now().toString(36);

  switch (strategyId) {
    case "conservative":
      return [
        {
          subtaskId: `sub_${base}_1`,
          agentId: primary?.agentId ?? "default",
          prompt: taskPrompt,
          dependencies: [],
        },
      ];

    case "balanced": {
      const result: Array<{ subtaskId: string; agentId: string; prompt: string; dependencies: string[] }> = [];
      result.push({
        subtaskId: `sub_${base}_1`,
        agentId: specialist?.agentId ?? primary?.agentId ?? "default",
        prompt: `Implement the following task:\n\n${taskPrompt}`,
        dependencies: [],
      });
      if (reviewer) {
        result.push({
          subtaskId: `sub_${base}_2`,
          agentId: reviewer.agentId,
          prompt: `Review the implementation for:\n\n${taskPrompt}\n\nCheck for correctness, edge cases, and code quality.`,
          dependencies: [`sub_${base}_1`],
        });
      }
      return result;
    }

    case "aggressive": {
      const result: Array<{ subtaskId: string; agentId: string; prompt: string; dependencies: string[] }> = [];
      result.push({
        subtaskId: `sub_${base}_1`,
        agentId: primary?.agentId ?? "default",
        prompt: `Analyze and plan the implementation for:\n\n${taskPrompt}`,
        dependencies: [],
      });
      result.push({
        subtaskId: `sub_${base}_2`,
        agentId: specialist?.agentId ?? "default",
        prompt: `Implement the core logic for:\n\n${taskPrompt}`,
        dependencies: [`sub_${base}_1`],
      });
      if (reviewer) {
        result.push({
          subtaskId: `sub_${base}_3`,
          agentId: reviewer.agentId,
          prompt: `Review implementation of:\n\n${taskPrompt}\n\nVerify correctness, suggest improvements.`,
          dependencies: [`sub_${base}_2`],
        });
      }
      if (fallback) {
        result.push({
          subtaskId: `sub_${base}_4`,
          agentId: fallback.agentId,
          prompt: `Write tests and documentation for:\n\n${taskPrompt}`,
          dependencies: [`sub_${base}_2`],
        });
      }
      return result;
    }

    default:
      return [
        {
          subtaskId: `sub_${base}_1`,
          agentId: primary?.agentId ?? "default",
          prompt: taskPrompt,
          dependencies: [],
        },
      ];
  }
}

/**
 * run-simple 默认的真实执行器：复用 agent-team 内核（fan-out 并行执行各子任务）。
 *
 * 容错：任一只子任务执行失败不会使整体抛出/500，而是标记为 failed，
 * 最终 status 折叠为 completed / partial / failed。
 */
async function executeCollabPlan(plan: RunSimpleExecutionInput): Promise<RunSimpleExecutionResult> {
  const harness = getGlobalHarnessManager().getHarness("local-default");
  const cwd = harness?.rootPath ?? process.cwd();

  const config: AgentTeamConfig = {
    teamId: plan.teamId,
    members: plan.memberSpecs.map((m) => ({
      agentId: m.agentId,
      adapter: createAdapterForAgent(m.agentId),
      role: toMemberRole(m.role),
    })),
    dispatchPolicy: { kind: "round-robin" },
    eagerStart: false,
    worktreeIsolation: false,
    useProcessPool: false,
    startupTimeoutMs: 30_000,
  };

  const team = await createAgentTeam(config, { cwd });

  const subtaskResults: CollabSubtaskResult[] = [];
  let syncError: string | undefined;

  try {
    for await (const ev of fanOutTask(team, {
      fanOutId: plan.taskId,
      cwd,
      defaultTimeoutMs: 60_000,
      assignments: plan.subtasks.map((s) => ({
        subtaskId: s.subtaskId,
        agentId: s.agentId,
        prompt: s.prompt,
        dependencies: s.dependencies,
      })),
    })) {
      if (ev.kind === "subtask-assigned") {
        plan.onProgress?.({ subtaskId: ev.subtaskId, status: "running" });
      }
      if (ev.kind === "subtask-completed") {
        plan.onProgress?.({
          subtaskId: ev.subtaskId,
          status: "completed",
          ...(ev.finalText ? { outputTail: outputTail(ev.finalText) } : {}),
        });
      }
      if (ev.kind === "subtask-failed") {
        plan.onProgress?.({ subtaskId: ev.subtaskId, status: "failed", outputTail: outputTail(ev.error) });
      }
      if (ev.kind === "fanout-completed") {
        for (const r of ev.results) {
          const prompt = plan.subtasks.find((s) => s.subtaskId === r.subtaskId)?.prompt ?? "";
          const tail = r.finalText ?? r.error;
          subtaskResults.push({
            subtaskId: r.subtaskId,
            agentId: r.agentId,
            prompt,
            status: r.error ? "failed" : "completed",
            ...(tail ? { outputTail: outputTail(tail) } : {}),
          });
        }
      }
    }
  } catch (err) {
    syncError = err instanceof Error ? err.message : String(err);
  } finally {
    await team.stop().catch(() => {});
  }

  // 兜底：任何未被汇报的子任务一律记为 failed（不因单个 agent 异常导致整体 500）
  for (const s of plan.subtasks) {
    if (!subtaskResults.some((r) => r.subtaskId === s.subtaskId)) {
      subtaskResults.push({
        subtaskId: s.subtaskId,
        agentId: s.agentId,
        prompt: s.prompt,
        status: "failed",
        ...(syncError ? { outputTail: syncError } : {}),
      });
    }
  }

  // 保持子任务顺序与计划一致
  const byKey = new Map<string, CollabSubtaskResult>();
  for (const r of subtaskResults) byKey.set(r.subtaskId, r);
  const ordered: CollabSubtaskResult[] = [];
  for (const s of plan.subtasks) {
    const r = byKey.get(s.subtaskId);
    if (r) ordered.push(r);
  }

  const completed = ordered.filter((r) => r.status === "completed").length;
  const failed = ordered.filter((r) => r.status === "failed").length;
  const status: RunSimpleExecutionResult["status"] =
    failed === 0 ? "completed" : completed === 0 ? "failed" : "partial";

  const message =
    failed === 0
      ? `Task completed: ${completed} subtask(s) succeeded.`
      : completed === 0
        ? `Task failed: ${failed} subtask(s) all failed.`
        : `Task partially completed: ${completed} succeeded, ${failed} failed.`;

  return { status, subtaskResults: ordered, message };
}

/** 截取输出尾部（避免把过长的 agent 输出完整塞回响应） */
function outputTail(text: string, max = 2000): string {
  if (text.length <= max) return text;
  return `…${text.slice(-max)}`;
}