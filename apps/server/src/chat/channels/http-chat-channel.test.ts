/**
 * http-chat-channel 测试 — 通用 HTTP 通道基座
 *
 * 覆盖：
 * - send：POST JSON 到 webhookUrl（可注入 fetchImpl 捕获出站 payload）
 * - pushInbound：解析平台 JSON → 统一 ChatMessage 并入队（receive 可取回）
 * - 平台 hooks：parseInbound / serializeOutbound 由调用方注入
 * - testConnection：连通性探测（成功 / 非 2xx / 网络错误）
 */
import { describe, expect, test } from "bun:test";
import { HttpChatChannel } from "./http-chat-channel.js";
import type { ChatMessage } from "../types.js";

function makeMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: "msg-1",
    conversationId: "conv-1",
    sender: "user",
    role: "user",
    text: "hello",
    mentions: [],
    timestamp: 1_700_000_000_000,
    ...overrides,
  };
}

describe("HttpChatChannel.send", () => {
  test("POSTs the serialized payload as JSON to the webhook url", async () => {
    let capturedUrl = "";
    let capturedInit: RequestInit | undefined;
    const fetchImpl = async (url: string, init?: RequestInit) => {
      capturedUrl = url;
      capturedInit = init;
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    };

    const channel = new HttpChatChannel({
      channelId: "slack",
      webhookUrl: "https://hooks.slack.com/T123",
      fetchImpl: fetchImpl as unknown as typeof fetch,
      hooks: {
        serializeOutbound: (message) => ({ text: message.text }),
      },
    });

    await channel.send(makeMessage());
    expect(capturedUrl).toBe("https://hooks.slack.com/T123");
    expect(capturedInit?.method).toBe("POST");
    expect(JSON.parse(capturedInit!.body as string)).toEqual({ text: "hello" });
  });

  test("uses default text serialization when no hook is provided", async () => {
    let body: unknown;
    const fetchImpl = async (_url: string, init?: RequestInit) => {
      body = JSON.parse(init!.body as string);
      return new Response("{}", { status: 200 });
    };
    const channel = new HttpChatChannel({
      channelId: "wecom",
      webhookUrl: "https://qyapi.weixin.qq.com/hook",
      fetchImpl: fetchImpl as typeof fetch,
    });
    await channel.send(makeMessage({ text: "hi" }));
    expect(body).toEqual({ msgtype: "text", text: { content: "hi" } });
  });

  test("throws a descriptive error when the webhook is not configured", async () => {
    const channel = new HttpChatChannel({ channelId: "slack" });
    await expect(channel.send(makeMessage())).rejects.toThrow(/webhook/i);
  });
});

describe("HttpChatChannel inbound", () => {
  test("pushInbound parses via the platform hook and enqueues for receive()", async () => {
    const channel = new HttpChatChannel({
      channelId: "slack",
      hooks: {
        parseInbound: (body) => {
          if (typeof body !== "object" || body === null) return null;
          const record = body as Record<string, unknown>;
          const event = record.event as Record<string, unknown> | undefined;
          if (!event || typeof event.text !== "string") return null;
          return {
            id: `evt-${String(event.ts ?? "x")}`,
            conversationId: String(event.channel),
            sender: String(event.user),
            role: "user",
            text: event.text,
            mentions: [],
            timestamp: 1_700_000_000_000,
          };
        },
      },
    });

    const parsed = channel.pushInbound({
      type: "event_callback",
      event: { type: "message", channel: "C1", user: "U1", text: "hello", ts: "1.2" },
    });
    expect(parsed).not.toBeNull();
    expect(parsed!.text).toBe("hello");
    expect(parsed!.conversationId).toBe("C1");

    const received: ChatMessage[] = [];
    for await (const msg of channel.receive()) {
      received.push(msg);
      break;
    }
    expect(received[0]!.id).toBe("evt-1.2");
  });

  test("pushInbound returns null and does not enqueue for ignored events", async () => {
    const channel = new HttpChatChannel({
      channelId: "feishu",
      hooks: { parseInbound: () => null },
    });
    expect(channel.pushInbound({ schema: "2.0" })).toBeNull();
    // receive() 无消息时永不产出：用竞速验证 100ms 内无消息
    const iterator = channel.receive()[Symbol.asyncIterator]();
    const first = await Promise.race([
      iterator.next().then((r) => (r.done ? "__done" : r.value)),
      new Promise<"__timeout">((resolve) => setTimeout(() => resolve("__timeout"), 100)),
    ]);
    expect(first).toBe("__timeout");
  });

  test("receive filters by conversationId", async () => {
    const channel = new HttpChatChannel({
      channelId: "wecom",
      hooks: {
        parseInbound: (body) => {
          const record = body as Record<string, unknown>;
          return {
            id: String(record.MsgId),
            conversationId: String(record.ToUserName),
            sender: String(record.FromUserName),
            role: "user",
            text: String(record.Content),
            mentions: [],
            timestamp: 1_700_000_000_000,
          };
        },
      },
    });
    channel.pushInbound({ MsgId: "1", ToUserName: "conv-a", FromUserName: "u1", Content: "a" });
    channel.pushInbound({ MsgId: "2", ToUserName: "conv-b", FromUserName: "u2", Content: "b" });

    const ids: string[] = [];
    for await (const msg of channel.receive("conv-b")) {
      ids.push(msg.id);
      if (ids.length >= 1) break;
    }
    expect(ids).toEqual(["2"]);
  });
});

describe("HttpChatChannel.testConnection", () => {
  test("returns ok for a 2xx response", async () => {
    const fetchImpl = async () => new Response(JSON.stringify({ ok: true }), { status: 200 });
    const channel = new HttpChatChannel({
      channelId: "dingtalk",
      webhookUrl: "https://oapi.dingtalk.com/hook",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const result = await channel.testConnection();
    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
  });

  test("reports failure with status for non-2xx responses", async () => {
    const fetchImpl = async () => new Response("forbidden", { status: 403 });
    const channel = new HttpChatChannel({
      channelId: "wecom",
      webhookUrl: "https://qyapi.weixin.qq.com/hook",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const result = await channel.testConnection();
    expect(result.ok).toBe(false);
    expect(result.status).toBe(403);
  });

  test("reports failure for network errors", async () => {
    const fetchImpl = async () => {
      throw new Error("ECONNREFUSED");
    };
    const channel = new HttpChatChannel({
      channelId: "slack",
      webhookUrl: "https://hooks.slack.com/T123",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const result = await channel.testConnection();
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/ECONNREFUSED/);
  });
});

describe("HttpChatChannel config", () => {
  test("setWebhook updates the outbound url and token", async () => {
    let capturedUrl = "";
    const fetchImpl = async (url: string) => {
      capturedUrl = url;
      return new Response("{}", { status: 200 });
    };
    const channel = new HttpChatChannel({
      channelId: "slack",
      webhookUrl: "https://old.example.com/hook",
      fetchImpl: fetchImpl as typeof fetch,
    });
    channel.setWebhook("https://new.example.com/hook", "tok-1");
    await channel.send(makeMessage());
    expect(capturedUrl).toBe("https://new.example.com/hook");
    expect(channel.getWebhookUrl()).toBe("https://new.example.com/hook");
  });
});
