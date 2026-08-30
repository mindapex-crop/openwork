import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ApiError } from "../errors.js";
import type { Actor, ServerConfig, WorkspaceInfo } from "../types.js";
import { matchRoute, type Route } from "./registry.js";
import { registerRelaySyncRoutes } from "./relay-sync.js";

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

const WORKSPACE_ID = "ws_relay_route";

function makeConfig(root: string): ServerConfig {
  return {
    host: "127.0.0.1",
    port: 0,
    token: "owt_test_token",
    hostToken: "owt_host_token",
    approval: { mode: "auto", timeoutMs: 0 },
    corsOrigins: ["*"],
    workspaces: [{ id: WORKSPACE_ID, name: "Workspace", path: root, preset: "starter", workspaceType: "local" }],
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
  const root = await mkdtemp(join(tmpdir(), "openwork-relay-routes-"));
  ROOTS.push(root);
  return root;
}

function fakeOpencodeClient(snapshot: {
  session: { id: string; title?: string | null; directory?: string | null };
  messages: Array<{
    info: { id: string; role: string; parentID?: string | null; time?: { created?: number } };
    parts: Array<Record<string, unknown>>;
  }>;
}) {
  return {
    session: {
      get: async () => ({ data: snapshot.session }),
      messages: async () => ({ data: snapshot.messages }),
      todo: async () => ({ data: [] }),
      status: async () => ({ data: { [snapshot.session.id]: { type: "idle" } } }),
    },
  };
}

const unwrap = <T, E>(result: { data?: T; error?: E }, _path: string): NonNullable<T> => {
  if (result.data === undefined) throw new Error("fake result has no data");
  return result.data as NonNullable<T>;
};

function buildHarness(config: ServerConfig, snapshot: {
  session: { id: string; title?: string | null; directory?: string | null };
  messages: Array<{
    info: { id: string; role: string; parentID?: string | null; time?: { created?: number } };
    parts: Array<Record<string, unknown>>;
  }>;
}) {
  const routes: Route[] = [];
  const jsonResponse = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
  const readJsonBody = async (request: Request): Promise<Record<string, unknown>> => {
    const json = await request.json();
    return json as Record<string, unknown>;
  };
  registerRelaySyncRoutes({
    routes,
    config,
    jsonResponse,
    readJsonBody,
    ensureWritable: (serverConfig) => {
      if (serverConfig.readOnly) throw new Error("read-only");
    },
    requireClientScope: (_ctx, _required) => {},
    parseOptionalNonNegativeInteger: (value, name) => {
      if (value === null) return undefined;
      const parsed = Number.parseInt(value, 10);
      if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`${name} must be a non-negative integer`);
      return parsed;
    },
    createWorkspaceOpencodeClient: () => fakeOpencodeClient(snapshot) as never,
    resolveWorkspace: async (_serverConfig, id) => ({ id, name: "Workspace", path: _serverConfig.workspaces[0]?.path ?? "", preset: "starter", workspaceType: "local" }) as WorkspaceInfo,
    unwrapOpencodeResult: unwrap,
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
  // 与 server.ts 的 fetch 一致：handler 抛出的 ApiError 转 JSON 错误响应。
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

const MESSAGES = [
  {
    info: { id: "msg_1", role: "user", time: { created: 100 } },
    parts: [{ id: "prt_1", type: "text", text: "hello" }],
  },
  {
    info: { id: "msg_2", role: "assistant", parentID: "msg_1", time: { created: 200 } },
    parts: [{ id: "prt_2", type: "text", text: "hi" }],
  },
];

describe("relay-sync REST routes", () => {
  test("GET status for an unknown thread reports zeros", async () => {
    const root = await tempRoot();
    process.env.OPENWORK_RUNTIME_DB = join(root, "runtime.sqlite");
    const config = makeConfig(root);
    const routes = buildHarness(config, { session: { id: "ses_1" }, messages: MESSAGES });

    const result = await callRoute(config, routes, "GET", "/api/relay-sync/ses_1/status");
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      threadId: "ses_1",
      localVersion: 0,
      remoteVersion: 0,
      pendingCount: 0,
      relayEventCount: 0,
    });
  });

  test("GET snapshot generates a versioned snapshot with pending outgoing entries", async () => {
    const root = await tempRoot();
    process.env.OPENWORK_RUNTIME_DB = join(root, "runtime.sqlite");
    const config = makeConfig(root);
    const routes = buildHarness(config, { session: { id: "ses_1" }, messages: MESSAGES });

    const snapshot = await callRoute(config, routes, "GET", "/api/relay-sync/ses_1/snapshot");
    expect(snapshot.status).toBe(200);
    expect(snapshot.body).toMatchObject({
      threadId: "ses_1",
      version: 2,
      source: "local",
      messages: [
        { id: "msg_1", text: "hello" },
        { id: "msg_2", text: "hi" },
      ],
    });

    const status = await callRoute(config, routes, "GET", "/api/relay-sync/ses_1/status");
    expect(status.body).toMatchObject({ localVersion: 2, pendingCount: 2 });
  });

  test("POST snapshot applies remote turns and GET changes returns them", async () => {
    const root = await tempRoot();
    process.env.OPENWORK_RUNTIME_DB = join(root, "runtime.sqlite");
    const config = makeConfig(root);
    const routes = buildHarness(config, { session: { id: "ses_1" }, messages: MESSAGES });

    // 本地先生成基线（msg_1/msg_2 进入 outgoing pending）。
    await callRoute(config, routes, "GET", "/api/relay-sync/ses_1/snapshot");

    const applied = await callRoute(config, routes, "POST", "/api/relay-sync/ses_1/snapshot", {
      threadId: "ses_1",
      version: 3,
      messages: [
        { id: "msg_1", role: "user", createdAt: 100, text: "hello", reasoning: "", toolCalls: [] },
        { id: "msg_2", role: "assistant", createdAt: 200, text: "hi", reasoning: "", toolCalls: [] },
        { id: "msg_3", role: "user", createdAt: 300, text: "remote follow up", reasoning: "", toolCalls: [] },
      ],
    });
    expect(applied.status).toBe(200);
    expect(applied.body).toMatchObject({ accepted: true, merged: true, addedCount: 1, version: 3, remoteVersion: 3 });

    const changes = await callRoute(config, routes, "GET", "/api/relay-sync/ses_1/changes?from=0");
    expect(changes.status).toBe(200);
    expect(changes.body).toMatchObject({
      threadId: "ses_1",
      fromVersion: 0,
      items: [
        { version: 1, kind: "turn", direction: "outgoing", state: "pending" },
        { version: 2, kind: "turn", direction: "outgoing", state: "pending" },
        { version: 3, kind: "turn", direction: "incoming", state: "applied", message: { id: "msg_3" } },
      ],
    });

    const since2 = await callRoute(config, routes, "GET", "/api/relay-sync/ses_1/changes?from=2");
    expect(since2.body).toMatchObject({ items: [{ version: 3, message: { id: "msg_3" } }] });
  });

  test("POST snapshot rejects a stale version with 409", async () => {
    const root = await tempRoot();
    process.env.OPENWORK_RUNTIME_DB = join(root, "runtime.sqlite");
    const config = makeConfig(root);
    const routes = buildHarness(config, { session: { id: "ses_1" }, messages: MESSAGES });

    await callRoute(config, routes, "POST", "/api/relay-sync/ses_1/snapshot", {
      threadId: "ses_1",
      version: 5,
      messages: [{ id: "msg_1", role: "user", createdAt: 100, text: "hello", reasoning: "", toolCalls: [] }],
    });

    const stale = await callRoute(config, routes, "POST", "/api/relay-sync/ses_1/snapshot", {
      threadId: "ses_1",
      version: 2,
      messages: [
        { id: "msg_1", role: "user", createdAt: 100, text: "hello", reasoning: "", toolCalls: [] },
        { id: "msg_9", role: "user", createdAt: 900, text: "unknown turn", reasoning: "", toolCalls: [] },
      ],
    });
    expect(stale.status).toBe(409);
    expect(stale.body).toMatchObject({ accepted: false, staleConflict: true, code: "relay_sync_stale_snapshot" });
  });

  test("POST relay records a relay event", async () => {
    const root = await tempRoot();
    process.env.OPENWORK_RUNTIME_DB = join(root, "runtime.sqlite");
    const config = makeConfig(root);
    const routes = buildHarness(config, { session: { id: "ses_1" }, messages: MESSAGES });

    const relayed = await callRoute(config, routes, "POST", "/api/relay-sync/ses_1/relay", { note: "cloud handoff" });
    expect(relayed.status).toBe(200);
    expect(relayed.body).toMatchObject({ threadId: "ses_1", version: 1, note: "cloud handoff" });

    const status = await callRoute(config, routes, "GET", "/api/relay-sync/ses_1/status");
    expect(status.body).toMatchObject({ relayEventCount: 1, localVersion: 1 });
  });

  test("POST snapshot rejects an invalid payload with 400", async () => {
    const root = await tempRoot();
    process.env.OPENWORK_RUNTIME_DB = join(root, "runtime.sqlite");
    const config = makeConfig(root);
    const routes = buildHarness(config, { session: { id: "ses_1" }, messages: MESSAGES });

    const result = await callRoute(config, routes, "POST", "/api/relay-sync/ses_1/snapshot", {
      threadId: "ses_1",
      version: -1,
      messages: [],
    });
    expect(result.status).toBe(400);
  });
});
