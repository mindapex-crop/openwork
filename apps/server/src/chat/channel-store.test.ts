/**
 * channel-store 测试 — sqlite 持久化 IM 通道配置
 */
import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ServerConfig } from "../types.js";
import { createChatChannelStore, type ChatChannelConfig } from "./channel-store.js";

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

function serverConfig(root: string): ServerConfig {
  const config: ServerConfig = {
    host: "127.0.0.1",
    port: 0,
    token: "token",
    hostToken: "host-token",
    approval: { mode: "auto", timeoutMs: 0 },
    corsOrigins: [],
    workspaces: [{ id: "ws_store", name: "Test", path: root, preset: "starter", workspaceType: "local" }],
    authorizedRoots: [root],
    readOnly: false,
    startedAt: Date.now(),
    tokenSource: "generated",
    hostTokenSource: "generated",
    logFormat: "pretty",
    logRequests: false,
  };
  config.configPath = join(root, "server.json");
  return config;
}

async function tempConfig(): Promise<ServerConfig> {
  const root = await mkdtemp(join(tmpdir(), "openwork-channel-store-"));
  roots.push(root);
  process.env.OPENWORK_RUNTIME_DB = join(root, "runtime.sqlite");
  return serverConfig(root);
}

const SAMPLE: ChatChannelConfig = {
  channelId: "wecom",
  webhookUrl: "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=abc",
  token: "secret-token",
  enabled: true,
  updatedAt: 1_700_000_000_000,
};

describe("chat channel store", () => {
  test("starts empty", async () => {
    const store = createChatChannelStore(await tempConfig());
    expect(await store.list()).toEqual([]);
    expect(await store.get("wecom")).toBeUndefined();
  });

  test("saves and reads back a channel config", async () => {
    const store = createChatChannelStore(await tempConfig());
    await store.save({ ...SAMPLE, updatedAt: 0 });
    const saved = await store.get("wecom");
    expect(saved).toBeDefined();
    expect(saved!.channelId).toBe("wecom");
    expect(saved!.webhookUrl).toBe(SAMPLE.webhookUrl);
    expect(saved!.token).toBe(SAMPLE.token);
    expect(saved!.enabled).toBe(true);
    expect(typeof saved!.updatedAt).toBe("number");
  });

  test("upsert overwrites an existing channel", async () => {
    const store = createChatChannelStore(await tempConfig());
    await store.save({ ...SAMPLE, updatedAt: 0 });
    await store.save({ ...SAMPLE, webhookUrl: "https://new.example.com/hook", enabled: false, updatedAt: 0 });
    const saved = await store.get("wecom");
    expect(saved!.webhookUrl).toBe("https://new.example.com/hook");
    expect(saved!.enabled).toBe(false);
    expect((await store.list()).length).toBe(1);
  });

  test("saves multiple independent channels", async () => {
    const store = createChatChannelStore(await tempConfig());
    await store.save({ ...SAMPLE, channelId: "wecom", updatedAt: 0 });
    await store.save({ ...SAMPLE, channelId: "feishu", webhookUrl: "https://open.feishu.cn/hook", updatedAt: 0 });
    await store.save({ ...SAMPLE, channelId: "slack", webhookUrl: "https://hooks.slack.com/T", updatedAt: 0 });
    const all = await store.list();
    expect(all.map((c) => c.channelId).sort()).toEqual(["feishu", "slack", "wecom"]);
  });

  test("delete removes a channel and reports whether it existed", async () => {
    const store = createChatChannelStore(await tempConfig());
    await store.save({ ...SAMPLE, updatedAt: 0 });
    expect(await store.delete("wecom")).toBe(true);
    expect(await store.get("wecom")).toBeUndefined();
    expect(await store.delete("wecom")).toBe(false);
  });

  test("persists across store instances (same db file)", async () => {
    const config = await tempConfig();
    const storeA = createChatChannelStore(config);
    await storeA.save({ ...SAMPLE, updatedAt: 0 });

    const storeB = createChatChannelStore(config);
    const saved = await storeB.get("wecom");
    expect(saved?.webhookUrl).toBe(SAMPLE.webhookUrl);
    expect(saved?.enabled).toBe(true);
  });
});
