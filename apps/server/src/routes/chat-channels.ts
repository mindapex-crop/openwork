/**
 * IM 通道管理 API + 入站回调路由（openspec-chat-bridge.md 阶段四）
 *
 * 管理 API（auth=client，由前端设置页调用）：
 *   GET    /api/chat-channels                → 列出全部通道配置
 *   POST   /api/chat-channels                → 保存/连接（webhookUrl + token + enabled=true）
 *   PUT    /api/chat-channels/:channelId     → 更新配置（webhookUrl/token/enabled 可选合并）
 *   DELETE /api/chat-channels/:channelId     → 断开并删除配置
 *   POST   /api/chat-channels/:channelId/test → 连通性测试（向 webhook 发探测消息）
 *
 * 入站回调（auth=none，供 IM 平台 webhook 推送）：
 *   POST   /chat/webhook/:channel            → 平台 JSON → 适配器解析 → relay 驱动 agent
 *   Slack / 飞书 url_verification：body 含 challenge 时原样回显
 */

import type { ChatChannelAdapter } from "../chat/types.js";
import type { ChatRelayService } from "../chat/chat-relay.js";
import type { ChatChannelStore, ChatChannelConfig } from "../chat/channel-store.js";
import { HttpChatChannel, isHttpChatChannel } from "../chat/channels/http-chat-channel.js";
import { addRoute, type Route } from "./registry.js";

export interface RegisterChatChannelsRoutesOptions {
  routes: Route[];
  store: ChatChannelStore;
  /** 已注册的通道实例（含 in-memory 与各平台 HttpChatChannel） */
  channels: Record<string, ChatChannelAdapter>;
  relay: Pick<ChatRelayService, "route">;
  jsonResponse: (data: unknown, status?: number) => Response;
  readJsonBody: (request: Request) => Promise<Record<string, unknown>>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidWebhookUrl(value: string): boolean {
  return /^https?:\/\/\S+$/i.test(value);
}

/** 解析管理 API 的通道配置 payload；不合法返回 null */
function parseChannelConfigPayload(body: unknown): {
  channelId: string;
  webhookUrl: string;
  token?: string;
  enabled?: boolean;
} | null {
  if (!isRecord(body)) return null;
  const channelId = typeof body.channelId === "string" ? body.channelId.trim() : "";
  const webhookUrl = typeof body.webhookUrl === "string" ? body.webhookUrl.trim() : "";
  if (!channelId || !webhookUrl || !isValidWebhookUrl(webhookUrl)) return null;
  const token = typeof body.token === "string" && body.token.trim() ? body.token.trim() : undefined;
  const enabled = body.enabled === undefined ? undefined : body.enabled === true;
  return { channelId, webhookUrl, token, enabled };
}

/** 把已保存的配置同步到已注册的 HttpChatChannel 实例（出站/测试用同一 webhook） */
function syncChannelWebhook(channels: Record<string, ChatChannelAdapter>, config: ChatChannelConfig): void {
  const channel = channels[config.channelId];
  if (channel instanceof HttpChatChannel) {
    channel.setWebhook(config.webhookUrl, config.token);
  }
}

export function registerChatChannelsRoutes(options: RegisterChatChannelsRoutesOptions): void {
  const { routes, store, channels, relay, jsonResponse, readJsonBody } = options;

  // ---- 管理 API ----

  addRoute(routes, "GET", "/api/chat-channels", "client", async () => {
    return jsonResponse({ channels: await store.list() });
  });

  addRoute(routes, "POST", "/api/chat-channels", "client", async (ctx) => {
    const parsed = parseChannelConfigPayload(await readJsonBody(ctx.request));
    if (!parsed) {
      return jsonResponse({ error: "channelId and a valid http(s) webhookUrl are required" }, 400);
    }
    const config = await store.save({
      channelId: parsed.channelId,
      webhookUrl: parsed.webhookUrl,
      ...(parsed.token ? { token: parsed.token } : {}),
      enabled: parsed.enabled ?? true,
      updatedAt: Date.now(),
    });
    syncChannelWebhook(channels, config);
    return jsonResponse({ channel: config }, 201);
  });

  addRoute(routes, "PUT", "/api/chat-channels/:channelId", "client", async (ctx) => {
    const channelId = ctx.params.channelId ?? "";
    const existing = await store.get(channelId);
    if (!existing) {
      return jsonResponse({ error: `channel '${channelId}' is not configured` }, 404);
    }
    const body = await readJsonBody(ctx.request);
    if (!isRecord(body)) return jsonResponse({ error: "invalid_json" }, 400);

    const webhookUrl = typeof body.webhookUrl === "string" ? body.webhookUrl.trim() : "";
    if (webhookUrl && !isValidWebhookUrl(webhookUrl)) {
      return jsonResponse({ error: "webhookUrl must be a valid http(s) url" }, 400);
    }
    const token = typeof body.token === "string" && body.token.trim() ? body.token.trim() : undefined;
    const enabled = body.enabled === undefined ? undefined : body.enabled === true;

    const config = await store.save({
      channelId,
      webhookUrl: webhookUrl || existing.webhookUrl,
      token,
      enabled: enabled ?? existing.enabled,
      updatedAt: Date.now(),
    });
    syncChannelWebhook(channels, config);
    return jsonResponse({ channel: config });
  });

  addRoute(routes, "DELETE", "/api/chat-channels/:channelId", "client", async (ctx) => {
    const channelId = ctx.params.channelId ?? "";
    const deleted = await store.delete(channelId);
    const channel = channels[channelId];
    if (channel instanceof HttpChatChannel) {
      channel.setWebhook("");
    }
    return jsonResponse({ ok: true, channelId, deleted });
  });

  addRoute(routes, "POST", "/api/chat-channels/:channelId/test", "client", async (ctx) => {
    const channelId = ctx.params.channelId ?? "";
    const config = await store.get(channelId);
    if (!config || !config.webhookUrl) {
      return jsonResponse({ error: `channel '${channelId}' is not configured` }, 404);
    }
    const channel = channels[channelId];
    if (!(channel instanceof HttpChatChannel)) {
      return jsonResponse({ error: `channel '${channelId}' does not support connectivity test` }, 400);
    }
    return jsonResponse({ channelId, ...(await channel.testConnection()) });
  });

  // ---- 入站回调 ----

  addRoute(routes, "POST", "/chat/webhook/:channel", "none", async (ctx) => {
    const channelId = ctx.params.channel ?? "";
    let raw: unknown;
    try {
      raw = await ctx.request.json();
    } catch {
      return jsonResponse({ error: "invalid_json" }, 400);
    }

    // Slack / 飞书 url_verification 握手：原样回显 challenge
    if (isRecord(raw) && typeof raw.challenge === "string") {
      return jsonResponse({ challenge: raw.challenge });
    }

    const channel = channels[channelId];
    if (!isHttpChatChannel(channel)) {
      return jsonResponse({ error: `unknown channel '${channelId}'` }, 404);
    }
    const message = channel.pushInbound(raw);
    if (!message) {
      // 事件被适配器忽略（非文本/验证事件等）→ 正常应答但不驱动 agent
      return jsonResponse({ ok: true, ignored: true });
    }
    const result = await relay.route(channel, message);
    return jsonResponse({ ok: true, result: result ?? null });
  });
}
