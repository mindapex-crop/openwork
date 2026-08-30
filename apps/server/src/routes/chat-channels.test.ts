/**
 * chat-channels 路由测试
 *
 * 覆盖管理 API（GET/POST/PUT/DELETE /api/chat-channels、连通性测试）
 * 与入站回调 POST /chat/webhook/:channel（解析 → relay 驱动 agent）。
 */
import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createChatChannelStore } from "../chat/channel-store.js";
import type { ChatRelayService } from "../chat/chat-relay.js";
import { createSlackChatChannel } from "../chat/channels/slack-chat-channel.js";
import { createWecomChatChannel } from "../chat/channels/wecom-chat-channel.js";
import { matchRoute, type RequestContext, type Route } from "./registry.js";
import { registerChatChannelsRoutes } from "./chat-channels.js";
import type { ServerConfig } from "../types.js";

const roots: string[] = [];
const previousRuntimeDb = process.env.OPENWORK_RUNTIME_DB;

afterEach(async () => {
  while (roots.length) {
    const root = roots.pop();
    if (root) await rm(root, { recursive: true, force: true });
  }
  if (previousRuntimeDb === undefined) delete process.env.OPENWORK_RUNTIME_DB;
  else process.env.OPENWORK_RUNTIME_DB = previousRuntimeDb;
});

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  return request.json() as Promise<Record<string, unknown>>;
}

type FakeRelay = Pick<ChatRelayService, "route"> & { calls: Array<{ channelId: string; text: string }> };

function fakeRelay(): FakeRelay {
  const calls: Array<{ channelId: string; text: string }> = [];
  return {
    calls,
    route: async (channel, message) => {
      calls.push({ channelId: channel.channelId, text: message.text });
      return { agentId: "opencode", reply: "done", handedOff: false, eventCount: 1 };
    },
  };
}

async function setup() {
  const root = await mkdtemp(join(tmpdir(), "openwork-chat-channels-route-"));
  roots.push(root);
  process.env.OPENWORK_RUNTIME_DB = join(root, "runtime.sqlite");
  const config: ServerConfig = {
    host: "127.0.0.1",
    port: 0,
    token: "token",
    hostToken: "host-token",
    approval: { mode: "auto", timeoutMs: 0 },
    corsOrigins: [],
    workspaces: [{ id: "ws", name: "Test", path: root, preset: "starter", workspaceType: "local" }],
    authorizedRoots: [root],
    readOnly: false,
    startedAt: Date.now(),
    tokenSource: "generated",
    hostTokenSource: "generated",
    logFormat: "pretty",
    logRequests: false,
  };
  config.configPath = join(root, "server.json");
  const store = createChatChannelStore(config);

  const routes: Route[] = [];
  const slack = createSlackChatChannel({ webhookUrl: "https://hooks.slack.com/T123", fetchImpl: (async () => new Response("ok", { status: 200 })) as unknown as typeof fetch });
  const wecom = createWecomChatChannel();
  const channels: Record<string, ReturnType<typeof createSlackChatChannel>> = { slack, wecom };
  const relay = fakeRelay();

  registerChatChannelsRoutes({
    routes,
    store,
    channels: channels as Record<string, import("../chat/types.js").ChatChannelAdapter>,
    relay,
    jsonResponse,
    readJsonBody,
  });
  return { routes, store, channels, relay };
}

function makeCtx(request: Request, params: Record<string, string> = {}): RequestContext {
  return {
    request,
    url: new URL(request.url, "http://localhost"),
    params,
    config: {} as ServerConfig,
    approvals: {} as never,
    reloadEvents: {} as never,
    tokens: {} as never,
  };
}

async function call(routes: Route[], method: string, path: string, body?: unknown) {
  const route = matchRoute(routes, method, path);
  if (!route) throw new Error(`route ${method} ${path} not found`);
  const request = new Request(`http://localhost${path}`, {
    method,
    headers: { "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const response = await route.handler(makeCtx(request, route.params));
  return { status: response.status, body: await response.json() };
}

describe("GET /api/chat-channels", () => {
  test("returns an empty list initially", async () => {
    const { routes } = await setup();
    const { status, body } = await call(routes, "GET", "/api/chat-channels");
    expect(status).toBe(200);
    expect(body).toEqual({ channels: [] });
  });

  test("returns saved channel configs", async () => {
    const { routes } = await setup();
    await call(routes, "POST", "/api/chat-channels", {
      channelId: "slack",
      webhookUrl: "https://hooks.slack.com/T123",
    });
    const { body } = await call(routes, "GET", "/api/chat-channels");
    const channels = (body as { channels: Array<Record<string, unknown>> }).channels;
    expect(channels.length).toBe(1);
    expect(channels[0]!.channelId).toBe("slack");
    expect(channels[0]!.webhookUrl).toBe("https://hooks.slack.com/T123");
    expect(channels[0]!.enabled).toBe(true);
  });
});

describe("POST /api/chat-channels", () => {
  test("saves a config, enables it, and syncs the registered channel webhook", async () => {
    const { routes, channels } = await setup();
    const { status, body } = await call(routes, "POST", "/api/chat-channels", {
      channelId: "slack",
      webhookUrl: "https://hooks.slack.com/T123",
      token: "tok-1",
    });
    expect(status).toBe(201);
    expect((body as { channel: { channelId: string; enabled: boolean } }).channel.channelId).toBe("slack");
    expect((body as { channel: { enabled: boolean } }).channel.enabled).toBe(true);
    expect(channels.slack.getWebhookUrl()).toBe("https://hooks.slack.com/T123");
  });

  test("rejects missing or invalid webhookUrl", async () => {
    const { routes } = await setup();
    const missing = await call(routes, "POST", "/api/chat-channels", { channelId: "slack" });
    expect(missing.status).toBe(400);
    const invalid = await call(routes, "POST", "/api/chat-channels", { channelId: "slack", webhookUrl: "not-a-url" });
    expect(invalid.status).toBe(400);
  });
});

describe("PUT /api/chat-channels/:channelId", () => {
  test("updates webhook and preserves enabled when omitted", async () => {
    const { routes } = await setup();
    await call(routes, "POST", "/api/chat-channels", {
      channelId: "slack",
      webhookUrl: "https://hooks.slack.com/T123",
    });
    const { status, body } = await call(routes, "PUT", "/api/chat-channels/slack", {
      webhookUrl: "https://hooks.slack.com/T456",
      token: "tok-2",
    });
    expect(status).toBe(200);
    const channel = (body as { channel: { webhookUrl: string; token: string; enabled: boolean } }).channel;
    expect(channel.webhookUrl).toBe("https://hooks.slack.com/T456");
    expect(channel.token).toBe("tok-2");
    expect(channel.enabled).toBe(true);
  });

  test("disables via enabled:false", async () => {
    const { routes } = await setup();
    await call(routes, "POST", "/api/chat-channels", {
      channelId: "slack",
      webhookUrl: "https://hooks.slack.com/T123",
    });
    const { body } = await call(routes, "PUT", "/api/chat-channels/slack", { enabled: false });
    expect((body as { channel: { enabled: boolean } }).channel.enabled).toBe(false);
  });

  test("returns 404 for an unknown channel", async () => {
    const { routes } = await setup();
    const { status } = await call(routes, "PUT", "/api/chat-channels/feishu", { webhookUrl: "https://x.com/h" });
    expect(status).toBe(404);
  });
});

describe("DELETE /api/chat-channels/:channelId", () => {
  test("removes the config and clears the registered channel webhook", async () => {
    const { routes, channels } = await setup();
    await call(routes, "POST", "/api/chat-channels", {
      channelId: "slack",
      webhookUrl: "https://hooks.slack.com/T123",
    });
    const { status, body } = await call(routes, "DELETE", "/api/chat-channels/slack");
    expect(status).toBe(200);
    expect((body as { deleted: boolean }).deleted).toBe(true);
    expect(channels.slack.getWebhookUrl()).toBe("");
    const after = await call(routes, "GET", "/api/chat-channels");
    expect((after.body as { channels: unknown[] }).channels).toEqual([]);
  });
});

describe("POST /api/chat-channels/:channelId/test", () => {
  test("reports ok when the webhook answers 2xx", async () => {
    const { routes } = await setup();
    await call(routes, "POST", "/api/chat-channels", {
      channelId: "slack",
      webhookUrl: "https://hooks.slack.com/T123",
    });
    const { status, body } = await call(routes, "POST", "/api/chat-channels/slack/test");
    expect(status).toBe(200);
    expect((body as { ok: boolean }).ok).toBe(true);
  });

  test("returns 404 when the channel is not configured", async () => {
    const { routes } = await setup();
    const { status } = await call(routes, "POST", "/api/chat-channels/wecom/test");
    expect(status).toBe(404);
  });
});

describe("POST /chat/webhook/:channel (入站回调)", () => {
  const SLACK_EVENT = {
    type: "event_callback",
    event: { type: "message", channel: "C1", user: "U1", text: "<@U0LAN0Z89> deploy", ts: "1358878755.000001" },
  };

  test("parses platform payload, drives relay, and returns the route result", async () => {
    const { routes, relay } = await setup();
    const { status, body } = await call(routes, "POST", "/chat/webhook/slack", SLACK_EVENT);
    expect(status).toBe(200);
    expect((body as { ok: boolean }).ok).toBe(true);
    expect((body as { result: { agentId: string } }).result.agentId).toBe("opencode");
    expect(relay.calls).toEqual([{ channelId: "slack", text: "<@U0LAN0Z89> deploy" }]);
  });

  test("ignored events answer ok but do not drive relay", async () => {
    const { routes, relay } = await setup();
    const { status, body } = await call(routes, "POST", "/chat/webhook/slack", {
      type: "event_callback",
      event: { type: "reaction_added" },
    });
    expect(status).toBe(200);
    expect((body as { ignored: boolean }).ignored).toBe(true);
    expect(relay.calls).toEqual([]);
  });

  test("echoes url_verification challenge for handshakes", async () => {
    const { routes } = await setup();
    const { status, body } = await call(routes, "POST", "/chat/webhook/slack", {
      type: "url_verification",
      challenge: "ch-abc",
    });
    expect(status).toBe(200);
    expect(body).toEqual({ challenge: "ch-abc" });
  });

  test("unknown channel returns 404", async () => {
    const { routes } = await setup();
    const { status } = await call(routes, "POST", "/chat/webhook/discord", SLACK_EVENT);
    expect(status).toBe(404);
  });
});
