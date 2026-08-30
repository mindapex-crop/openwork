import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ApiError } from "../errors.js";
import type { Actor, ServerConfig } from "../types.js";
import { matchRoute, type Route } from "./registry.js";
import { registerDeviceRoutes } from "./devices.js";

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
    workspaces: [{ id: "ws_devices", name: "Workspace", path: root, preset: "starter", workspaceType: "local" }],
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
  const root = await mkdtemp(join(tmpdir(), "openwork-devices-routes-"));
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
  registerDeviceRoutes({
    routes,
    config,
    jsonResponse,
    readJsonBody,
    ensureWritable: (serverConfig) => {
      if (serverConfig.readOnly) throw new Error("read-only");
    },
    requireClientScope: (_ctx, required) => {
      if (required === "owner") {
        throw new ApiError(403, "insufficient_scope", "owner scope required");
      }
    },
  });
  return routes;
}

function buildHarnessWithOwner(config: ServerConfig) {
  const routes: Route[] = [];
  const jsonResponse = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
  const readJsonBody = async (request: Request): Promise<Record<string, unknown>> => {
    const json = await request.json();
    return json as Record<string, unknown>;
  };
  registerDeviceRoutes({
    routes,
    config,
    jsonResponse,
    readJsonBody,
    ensureWritable: (serverConfig) => {
      if (serverConfig.readOnly) throw new Error("read-only");
    },
    requireClientScope: (_ctx, _required) => {},
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

describe("device routes — multi-device remote control", () => {
  test("POST pair-code 生成 6 位配对码（owner scope）", async () => {
    const root = await tempRoot();
    process.env.OPENWORK_RUNTIME_DB = join(root, "runtime.sqlite");
    const config = makeConfig(root);
    const routes = buildHarnessWithOwner(config);

    const result = await callRoute(config, routes, "POST", "/api/devices/pair-code");
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ expiresInSeconds: 60 });
    const pairCode = (result.body as { pairCode: string }).pairCode;
    expect(pairCode).toHaveLength(6);
    expect(pairCode).toMatch(/^[A-Z2-9]{6}$/);
  });

  test("POST pair-code 非 owner scope → 403", async () => {
    const root = await tempRoot();
    process.env.OPENWORK_RUNTIME_DB = join(root, "runtime.sqlite");
    const config = makeConfig(root);
    const routes = buildHarness(config);

    const result = await callRoute(config, routes, "POST", "/api/devices/pair-code");
    expect(result.status).toBe(403);
  });

  test("完整配对流程：生成配对码 → 移动端配对 → 列出设备 → 心跳 → 控制 → 解绑", async () => {
    const root = await tempRoot();
    process.env.OPENWORK_RUNTIME_DB = join(root, "runtime.sqlite");
    const config = makeConfig(root);
    const routes = buildHarnessWithOwner(config);

    const pairCodeResp = await callRoute(config, routes, "POST", "/api/devices/pair-code");
    const pairCode = (pairCodeResp.body as { pairCode: string }).pairCode;

    const pairResp = await callRoute(config, routes, "POST", "/api/devices/pair", {
      pairCode,
      name: "iPhone 15",
      platform: "ios",
    });
    expect(pairResp.status).toBe(200);
    const pairResult = pairResp.body as { deviceId: string; deviceToken: string };
    expect(pairResult.deviceId).toMatch(/^dev_/);
    expect(pairResult.deviceToken).toMatch(/^owd_/);
    const deviceId = pairResult.deviceId;

    const listResp = await callRoute(config, routes, "GET", "/api/devices");
    expect(listResp.status).toBe(200);
    const devices = (listResp.body as { devices: unknown[] }).devices;
    expect(devices).toHaveLength(1);
    expect(devices[0]).toMatchObject({ deviceId, name: "iPhone 15", platform: "ios", active: true });

    const heartbeatResp = await callRoute(config, routes, "POST", `/api/devices/${deviceId}/heartbeat`, {
      remoteControlActive: true,
    });
    expect(heartbeatResp.status).toBe(200);

    const controlResp = await callRoute(config, routes, "POST", `/api/devices/${deviceId}/control`, {
      command: "lock",
      note: "remote lock from mobile",
    });
    expect(controlResp.status).toBe(200);
    const controlRecord = controlResp.body as { commandId: string; command: string; status: string };
    expect(controlRecord.command).toBe("lock");
    expect(controlRecord.status).toBe("pending");
    const commandId = controlRecord.commandId;

    const pendingResp = await callRoute(config, routes, "GET", `/api/devices/${deviceId}/control`);
    expect(pendingResp.status).toBe(200);
    const pending = pendingResp.body as { command: { commandId: string; command: string } | null };
    expect(pending.command).toMatchObject({ commandId, command: "lock" });

    const ackResp = await callRoute(config, routes, "POST", `/api/devices/${deviceId}/control/ack`, {
      commandId,
      status: "executed",
    });
    expect(ackResp.status).toBe(200);

    const pendingAfterAck = await callRoute(config, routes, "GET", `/api/devices/${deviceId}/control`);
    const pendingBody = pendingAfterAck.body as { command: unknown };
    expect(pendingBody.command).toBeNull();

    const revokeResp = await callRoute(config, routes, "DELETE", `/api/devices/${deviceId}`);
    expect(revokeResp.status).toBe(200);
    expect(revokeResp.body).toMatchObject({ revoked: true, deviceId });

    const listAfterRevoke = await callRoute(config, routes, "GET", "/api/devices");
    const devicesAfter = (listAfterRevoke.body as { devices: unknown[] }).devices;
    expect(devicesAfter).toHaveLength(0);
  });

  test("POST pair 错误配对码 → 400 pair_code_mismatch", async () => {
    const root = await tempRoot();
    process.env.OPENWORK_RUNTIME_DB = join(root, "runtime.sqlite");
    const config = makeConfig(root);
    const routes = buildHarnessWithOwner(config);

    await callRoute(config, routes, "POST", "/api/devices/pair-code");

    const result = await callRoute(config, routes, "POST", "/api/devices/pair", {
      pairCode: "WRONG0",
      name: "Test",
      platform: "ios",
    });
    expect(result.status).toBe(400);
    expect(result.body).toMatchObject({ code: "pair_code_mismatch" });
  });

  test("POST pair 无配对码 → 400 pair_code_expired_or_invalid", async () => {
    const root = await tempRoot();
    process.env.OPENWORK_RUNTIME_DB = join(root, "runtime.sqlite");
    const config = makeConfig(root);
    const routes = buildHarnessWithOwner(config);

    const result = await callRoute(config, routes, "POST", "/api/devices/pair", {
      pairCode: "AAAAAA",
      name: "Test",
      platform: "ios",
    });
    expect(result.status).toBe(400);
    expect(result.body).toMatchObject({ code: "pair_code_expired_or_invalid" });
  });

  test("POST control 无效指令 → 400 invalid_command", async () => {
    const root = await tempRoot();
    process.env.OPENWORK_RUNTIME_DB = join(root, "runtime.sqlite");
    const config = makeConfig(root);
    const routes = buildHarnessWithOwner(config);

    const pairCodeResp = await callRoute(config, routes, "POST", "/api/devices/pair-code");
    const pairCode = (pairCodeResp.body as { pairCode: string }).pairCode;
    const pairResp = await callRoute(config, routes, "POST", "/api/devices/pair", {
      pairCode,
      name: "Test",
      platform: "android",
    });
    const deviceId = (pairResp.body as { deviceId: string }).deviceId;

    const result = await callRoute(config, routes, "POST", `/api/devices/${deviceId}/control`, {
      command: "invalid_cmd",
    });
    expect(result.status).toBe(400);
    expect(result.body).toMatchObject({ code: "invalid_command" });
  });

  test("DELETE 不存在的设备 → 404", async () => {
    const root = await tempRoot();
    process.env.OPENWORK_RUNTIME_DB = join(root, "runtime.sqlite");
    const config = makeConfig(root);
    const routes = buildHarnessWithOwner(config);

    const result = await callRoute(config, routes, "DELETE", "/api/devices/dev_nonexistent");
    expect(result.status).toBe(404);
  });

  test("POST heartbeat 不存在的设备 → 404", async () => {
    const root = await tempRoot();
    process.env.OPENWORK_RUNTIME_DB = join(root, "runtime.sqlite");
    const config = makeConfig(root);
    const routes = buildHarnessWithOwner(config);

    const result = await callRoute(config, routes, "POST", "/api/devices/dev_nonexistent/heartbeat");
    expect(result.status).toBe(404);
  });

  test("POST control/ack 不存在的指令 → 404", async () => {
    const root = await tempRoot();
    process.env.OPENWORK_RUNTIME_DB = join(root, "runtime.sqlite");
    const config = makeConfig(root);
    const routes = buildHarnessWithOwner(config);

    const result = await callRoute(config, routes, "POST", "/api/devices/dev_x/control/ack", {
      commandId: "cmd_nonexistent",
      status: "executed",
    });
    expect(result.status).toBe(404);
  });
});