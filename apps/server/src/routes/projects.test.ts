import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ApiError } from "../errors.js";
import type { Actor, ServerConfig } from "../types.js";
import { matchRoute, type Route } from "./registry.js";
import { registerProjectRoutes } from "./projects.js";

const ROOTS: string[] = [];
const previousRuntimeDb = process.env.OPENWORK_RUNTIME_DB;

afterEach(async () => {
  while (ROOTS.length) {
    const root = ROOTS.pop();
    if (root) await rm(root, { recursive: true, force: true });
  }
  if (previousRuntimeDb === undefined) delete process.env.OPENWORK_RUNTIME_DB;
  else process.env.OPENWORK_RUNTIME_DB = previousRuntimeDb;
});

function makeConfig(root: string): ServerConfig {
  return {
    host: "127.0.0.1",
    port: 0,
    token: "owt_test_token",
    hostToken: "owt_host_token",
    approval: { mode: "auto", timeoutMs: 0 },
    corsOrigins: ["*"],
    workspaces: [{ id: "ws_proj", name: "Workspace", path: root, preset: "starter", workspaceType: "local" }],
    authorizedRoots: [root],
    readOnly: false,
    startedAt: Date.now(),
    tokenSource: "cli",
    hostTokenSource: "cli",
    logFormat: "pretty",
    logRequests: false,
    configPath: join(root, "server.json"),
  };
}

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "openwork-projects-routes-"));
  ROOTS.push(root);
  return root;
}

function buildHarness(config: ServerConfig) {
  const routes: Route[] = [];
  const jsonResponse = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
  const readJsonBody = async (request: Request): Promise<Record<string, unknown>> => {
    const json = await request.json();
    return json as Record<string, unknown>;
  };
  registerProjectRoutes({
    routes,
    config,
    jsonResponse,
    readJsonBody,
    ensureWritable: (serverConfig) => {
      if (serverConfig.readOnly) throw new Error("read-only");
    },
    requireClientScope: (_ctx, _required) => {},
    resolveWorkspace: async (_serverConfig, id) => ({
      id,
      name: "Workspace",
      path: _serverConfig.workspaces[0]?.path ?? "",
      preset: "starter",
      workspaceType: "local",
    }),
  });
  return routes;
}

async function callRoute(
  config: ServerConfig,
  routes: Route[],
  method: string,
  path: string,
  body?: unknown,
  actor: Actor = { type: "remote", tokenHash: "hash", scope: "owner" },
): Promise<{ status: number; body: unknown }> {
  const url = new URL(`http://127.0.0.1${path}`);
  const matched = matchRoute(routes, method, url.pathname);
  if (!matched) throw new Error(`No route for ${method} ${path}`);
  const request = new Request(url, {
    method,
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let response: Response;
  try {
    response = await matched.handler({
      request,
      url,
      params: matched.params,
      config,
      approvals: {} as never,
      reloadEvents: {} as never,
      tokens: {} as never,
      actor,
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return { status: error.status, body: { code: error.code, message: error.message } };
    }
    throw error;
  }
  const text = await response.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  return { status: response.status, body: parsed };
}

describe("project routes — templates + invites + capacity", () => {
  test("模板 CRUD 完整流程", async () => {
    const root = await tempRoot();
    process.env.OPENWORK_RUNTIME_DB = join(root, "runtime.sqlite");
    const config = makeConfig(root);
    const routes = buildHarness(config);

    const createResp = await callRoute(config, routes, "POST", "/api/projects/templates", {
      name: "Web 应用模板",
      description: "前端 + 后端 + 测试",
      category: "web",
      icon: "globe",
      plans: [
        {
          title: "前端开发",
          description: "UI 实现",
          tasks: [
            { title: "搭建项目", status: "todo", priority: "high" },
            { title: "实现首页", status: "todo", priority: "medium" },
          ],
        },
      ],
    });
    expect(createResp.status).toBe(200);
    const template = createResp.body as { templateId: string };
    expect(template.templateId).toMatch(/^tpl_/);
    const templateId = template.templateId;

    const listResp = await callRoute(config, routes, "GET", "/api/projects/templates");
    expect(listResp.status).toBe(200);
    expect((listResp.body as { templates: unknown[] }).templates).toHaveLength(1);

    const getResp = await callRoute(config, routes, "GET", `/api/projects/templates/${templateId}`);
    expect(getResp.status).toBe(200);
    expect(getResp.body).toMatchObject({ name: "Web 应用模板", category: "web" });

    const updateResp = await callRoute(config, routes, "PUT", `/api/projects/templates/${templateId}`, {
      name: "全栈模板",
      description: "更新描述",
      category: "fullstack",
      icon: "layers",
      plans: [],
    });
    expect(updateResp.status).toBe(200);
    expect(updateResp.body).toMatchObject({ name: "全栈模板", category: "fullstack" });

    const deleteResp = await callRoute(config, routes, "DELETE", `/api/projects/templates/${templateId}`);
    expect(deleteResp.status).toBe(200);
    expect(deleteResp.body).toMatchObject({ deleted: true });

    const listAfterDelete = await callRoute(config, routes, "GET", "/api/projects/templates");
    expect((listAfterDelete.body as { templates: unknown[] }).templates).toHaveLength(0);
  });

  test("邀请审批完整流程：创建邀请 → 审批 → 加入 → 列出成员", async () => {
    const root = await tempRoot();
    process.env.OPENWORK_RUNTIME_DB = join(root, "runtime.sqlite");
    const config = makeConfig(root);
    const routes = buildHarness(config);

    const inviteResp = await callRoute(config, routes, "POST", "/api/projects/invites", {
      projectId: "proj_1",
      email: "user@example.com",
      invitedBy: "admin",
    });
    expect(inviteResp.status).toBe(200);
    const invite = inviteResp.body as { inviteId: string; inviteCode: string; status: string };
    expect(invite.inviteCode).toHaveLength(8);
    expect(invite.status).toBe("pending");
    const inviteId = invite.inviteId;
    const inviteCode = invite.inviteCode;

    const listInvitesResp = await callRoute(config, routes, "GET", "/api/projects/proj_1/invites");
    expect(listInvitesResp.status).toBe(200);
    expect((listInvitesResp.body as { invites: unknown[] }).invites).toHaveLength(1);

    const approveResp = await callRoute(config, routes, "POST", `/api/projects/invites/${inviteId}/approve`, {
      resolvedBy: "admin",
    });
    expect(approveResp.status).toBe(200);
    expect(approveResp.body).toMatchObject({ status: "approved" });

    const joinResp = await callRoute(config, routes, "POST", "/api/projects/join", {
      inviteCode,
      userId: "user_1",
      name: "张三",
    });
    expect(joinResp.status).toBe(200);
    expect(joinResp.body).toMatchObject({ userId: "user_1", name: "张三", role: "member" });

    const membersResp = await callRoute(config, routes, "GET", "/api/projects/proj_1/members");
    expect(membersResp.status).toBe(200);
    expect((membersResp.body as { members: unknown[] }).members).toHaveLength(1);

    const removeResp = await callRoute(config, routes, "DELETE", "/api/projects/proj_1/members/user_1");
    expect(removeResp.status).toBe(200);
    expect(removeResp.body).toMatchObject({ removed: true });

    const membersAfterRemove = await callRoute(config, routes, "GET", "/api/projects/proj_1/members");
    expect((membersAfterRemove.body as { members: unknown[] }).members).toHaveLength(0);
  });

  test("未审批邀请无法加入 → 400 invite_not_approved", async () => {
    const root = await tempRoot();
    process.env.OPENWORK_RUNTIME_DB = join(root, "runtime.sqlite");
    const config = makeConfig(root);
    const routes = buildHarness(config);

    const inviteResp = await callRoute(config, routes, "POST", "/api/projects/invites", {
      projectId: "proj_1",
      invitedBy: "admin",
    });
    const inviteCode = (inviteResp.body as { inviteCode: string }).inviteCode;

    const joinResp = await callRoute(config, routes, "POST", "/api/projects/join", {
      inviteCode,
      userId: "user_1",
      name: "Test",
    });
    expect(joinResp.status).toBe(400);
    expect(joinResp.body).toMatchObject({ code: "invite_not_approved" });
  });

  test("拒绝邀请 → status rejected", async () => {
    const root = await tempRoot();
    process.env.OPENWORK_RUNTIME_DB = join(root, "runtime.sqlite");
    const config = makeConfig(root);
    const routes = buildHarness(config);

    const inviteResp = await callRoute(config, routes, "POST", "/api/projects/invites", {
      projectId: "proj_1",
      invitedBy: "admin",
    });
    const inviteId = (inviteResp.body as { inviteId: string }).inviteId;

    const rejectResp = await callRoute(config, routes, "POST", `/api/projects/invites/${inviteId}/reject`, {
      resolvedBy: "admin",
    });
    expect(rejectResp.status).toBe(200);
    expect(rejectResp.body).toMatchObject({ status: "rejected" });
  });

  test("容量计算：返回 5GB 上限与已用空间", async () => {
    const root = await tempRoot();
    process.env.OPENWORK_RUNTIME_DB = join(root, "runtime.sqlite");
    const config = makeConfig(root);
    const routes = buildHarness(config);

    await mkdir(join(root, "src"));
    await writeFile(join(root, "src", "index.ts"), "export const x = 1;\n");
    await writeFile(join(root, "README.md"), "# Test Project\n");

    const capacityResp = await callRoute(config, routes, "GET", "/api/projects/ws_proj/capacity");
    expect(capacityResp.status).toBe(200);
    const capacity = capacityResp.body as { used: number; total: number; percentage: number; totalLabel: string; usedLabel: string };
    expect(capacity.total).toBe(5 * 1024 * 1024 * 1024);
    expect(capacity.totalLabel).toBe("5 GB");
    expect(capacity.used).toBeGreaterThan(0);
    expect(capacity.percentage).toBeGreaterThanOrEqual(0);
    expect(capacity.percentage).toBeLessThan(1);
  });

  test("创建模板缺少名称 → 400 invalid_name", async () => {
    const root = await tempRoot();
    process.env.OPENWORK_RUNTIME_DB = join(root, "runtime.sqlite");
    const config = makeConfig(root);
    const routes = buildHarness(config);

    const resp = await callRoute(config, routes, "POST", "/api/projects/templates", {
      name: "",
      description: "",
      category: "",
      icon: "",
      plans: [],
    });
    expect(resp.status).toBe(400);
    expect(resp.body).toMatchObject({ code: "invalid_name" });
  });

  test("删除不存在的模板 → 404", async () => {
    const root = await tempRoot();
    process.env.OPENWORK_RUNTIME_DB = join(root, "runtime.sqlite");
    const config = makeConfig(root);
    const routes = buildHarness(config);

    const resp = await callRoute(config, routes, "DELETE", "/api/projects/templates/tpl_nonexistent");
    expect(resp.status).toBe(404);
  });

  test("移除不存在的成员 → 404", async () => {
    const root = await tempRoot();
    process.env.OPENWORK_RUNTIME_DB = join(root, "runtime.sqlite");
    const config = makeConfig(root);
    const routes = buildHarness(config);

    const resp = await callRoute(config, routes, "DELETE", "/api/projects/proj_1/members/user_nonexistent");
    expect(resp.status).toBe(404);
  });
});