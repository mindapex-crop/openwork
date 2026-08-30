import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ApiError } from "../errors.js";
import type { Actor, ServerConfig } from "../types.js";
import { matchRoute, type Route } from "./registry.js";
import { registerAutomationRoutes } from "./automations.js";

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
    workspaces: [{ id: "ws_automations", name: "Workspace", path: root, preset: "starter", workspaceType: "local" }],
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
  const root = await mkdtemp(join(tmpdir(), "openwork-automations-routes-"));
  ROOTS.push(root);
  process.env.OPENWORK_RUNTIME_DB = join(root, "runtime.sqlite");
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
  registerAutomationRoutes({
    routes,
    config,
    jsonResponse,
    readJsonBody,
    ensureWritable: (serverConfig) => {
      if (serverConfig.readOnly) throw new Error("read-only");
    },
    requireClientScope: (_ctx, _required) => {},
    resolveWorkspace: async (_c, id) => ({ id, name: "ws", path: config.workspaces[0]!.path, preset: "starter", workspaceType: "local" }),
  });
  return routes;
}

async function callRoute(
  config: ServerConfig,
  routes: Route[],
  method: string,
  path: string,
  body?: unknown,
  actor: Actor = { type: "remote", tokenHash: "hash", scope: "collaborator" },
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

describe("automation routes", () => {
  test("GET /api/automations returns empty list initially", async () => {
    const root = await tempRoot();
    const config = makeConfig(root);
    const routes = buildHarness(config);
    const { status, body } = await callRoute(config, routes, "GET", "/api/automations");
    expect(status).toBe(200);
    expect((body as { items: unknown[] }).items).toEqual([]);
  });

  test("POST /api/automations creates an automation", async () => {
    const root = await tempRoot();
    const config = makeConfig(root);
    const routes = buildHarness(config);
    const { status, body } = await callRoute(config, routes, "POST", "/api/automations", {
      name: "Weekly Review",
      description: "Friday code review",
      trigger: "cron 0 18 * * 5",
    });
    expect(status).toBe(201);
    const record = body as { id: string; name: string; enabled: number };
    expect(record.name).toBe("Weekly Review");
    expect(record.enabled).toBe(1);
  });

  test("GET /api/automations returns created automation", async () => {
    const root = await tempRoot();
    const config = makeConfig(root);
    const routes = buildHarness(config);
    await callRoute(config, routes, "POST", "/api/automations", { name: "Auto 1" });
    const { status, body } = await callRoute(config, routes, "GET", "/api/automations");
    expect(status).toBe(200);
    expect((body as { items: unknown[] }).items).toHaveLength(1);
  });

  test("POST /api/automations/:id/toggle toggles enabled", async () => {
    const root = await tempRoot();
    const config = makeConfig(root);
    const routes = buildHarness(config);
    const createRes = await callRoute(config, routes, "POST", "/api/automations", { name: "Toggle Me" });
    const id = (createRes.body as { id: string }).id;
    const { status, body } = await callRoute(config, routes, "POST", `/api/automations/${id}/toggle`, { enabled: false });
    expect(status).toBe(200);
    expect((body as { enabled: number }).enabled).toBe(0);
  });

  test("DELETE /api/automations/:id removes automation", async () => {
    const root = await tempRoot();
    const config = makeConfig(root);
    const routes = buildHarness(config);
    const createRes = await callRoute(config, routes, "POST", "/api/automations", { name: "Delete Me" });
    const id = (createRes.body as { id: string }).id;
    const { status } = await callRoute(config, routes, "DELETE", `/api/automations/${id}`);
    expect(status).toBe(200);
    const listRes = await callRoute(config, routes, "GET", "/api/automations");
    expect((listRes.body as { items: unknown[] }).items).toHaveLength(0);
  });

  test("POST /api/automations rejects empty name", async () => {
    const root = await tempRoot();
    const config = makeConfig(root);
    const routes = buildHarness(config);
    const { status, body } = await callRoute(config, routes, "POST", "/api/automations", { name: "" });
    expect(status).toBe(400);
    expect((body as { code: string }).code).toBe("invalid_name");
  });

  test("POST /api/automations/from-description creates from NL", async () => {
    const root = await tempRoot();
    const config = makeConfig(root);
    const routes = buildHarness(config);
    const { status, body } = await callRoute(config, routes, "POST", "/api/automations/from-description", {
      description: "每天检查代码质量",
    });
    expect(status).toBe(201);
    const record = body as { name: string; trigger: string };
    expect(record.trigger).toBe("daily");
    expect(record.name).toBeTruthy();
  });

  test("POST /api/automations/:id/run executes and records run", async () => {
    const root = await tempRoot();
    const config = makeConfig(root);
    const routes = buildHarness(config);
    const createRes = await callRoute(config, routes, "POST", "/api/automations", { name: "Run Me" });
    const id = (createRes.body as { id: string }).id;
    const { status, body } = await callRoute(config, routes, "POST", `/api/automations/${id}/run`);
    expect(status).toBe(200);
    expect((body as { status: string }).status).toBe("succeeded");
  });

  test("POST /api/automations/:id/test returns test result without recording", async () => {
    const root = await tempRoot();
    const config = makeConfig(root);
    const routes = buildHarness(config);
    const createRes = await callRoute(config, routes, "POST", "/api/automations", { name: "Test Me" });
    const id = (createRes.body as { id: string }).id;
    const { status, body } = await callRoute(config, routes, "POST", `/api/automations/${id}/test`);
    expect(status).toBe(200);
    const result = body as { ok: boolean; status: string; result: string };
    expect(result.ok).toBe(true);
    expect(result.status).toBe("succeeded");
    expect(result.result).toContain("Test Me");
  });

  test("GET /api/automations/:id/runs lists run history", async () => {
    const root = await tempRoot();
    const config = makeConfig(root);
    const routes = buildHarness(config);
    const createRes = await callRoute(config, routes, "POST", "/api/automations", { name: "History Test" });
    const id = (createRes.body as { id: string }).id;
    await callRoute(config, routes, "POST", `/api/automations/${id}/run`);
    await callRoute(config, routes, "POST", `/api/automations/${id}/run`);
    const { status, body } = await callRoute(config, routes, "GET", `/api/automations/${id}/runs`);
    expect(status).toBe(200);
    expect((body as { items: unknown[] }).items).toHaveLength(2);
  });

  test("POST /api/automations/:id/run returns 404 for unknown automation", async () => {
    const root = await tempRoot();
    const config = makeConfig(root);
    const routes = buildHarness(config);
    const { status } = await callRoute(config, routes, "POST", "/api/automations/nonexistent/run");
    expect(status).toBe(404);
  });
});