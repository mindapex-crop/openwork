/**
 * HttpChatChannel — 通用 HTTP 聊天通道基座（openspec-chat-bridge.md 阶段四）
 *
 * 通过 outbound webhook 发送消息（标准 Node fetch，不引新依赖）；
 * 入站回调由平台 webhook 路由调用 pushInbound(rawBody) 解析并入队。
 * 平台差异（JSON 解析 / 出站格式 / @mention）由调用方注入 hooks：
 * - wecom / feishu / dingtalk / slack 各自在适配器中提供 parse/serialize
 *
 * 不变量：
 * I1: send 无 webhookUrl 时 fail-fast（抛错，绝不静默）
 * I2: receive() 每条消息只消费一次（游标去重，同 InMemoryChatChannel）
 * I3: pushInbound 返回 null 表示事件被忽略（不入队、不驱动 relay）
 */

import type { ChatChannelAdapter, ChatMessage, ChatSendOptions } from "../types.js";

export interface HttpChatChannelHooks {
  /** 平台原始 JSON → 统一 ChatMessage；返回 null 表示忽略该事件 */
  parseInbound?: (body: unknown) => ChatMessage | null;
  /** 统一 ChatMessage → 平台 webhook JSON */
  serializeOutbound?: (message: ChatMessage) => unknown;
  /** 连通性探测 payload（默认发送一条 text 探测消息） */
  testPayload?: () => unknown;
}

export interface HttpChatChannelOptions {
  channelId: string;
  webhookUrl?: string;
  token?: string;
  /** 可注入的 fetch（测试用）；默认 globalThis.fetch */
  fetchImpl?: typeof fetch;
  hooks?: HttpChatChannelHooks;
}

export type TestConnectionResult = {
  ok: boolean;
  status?: number;
  body?: string;
  error?: string;
};

/** 默认出站格式：通用 text 消息（与企微机器人 webhook 兼容） */
export function defaultSerializeOutbound(message: ChatMessage): unknown {
  return {
    msgtype: "text",
    text: { content: message.text },
  };
}

export class HttpChatChannel implements ChatChannelAdapter {
  readonly channelId: string;
  private webhookUrl: string;
  private token: string;
  private readonly fetchImpl: typeof fetch;
  private readonly parseInbound: (body: unknown) => ChatMessage | null;
  private readonly serializeOutbound: (message: ChatMessage) => unknown;
  private readonly testPayload: () => unknown;

  private readonly queue: ChatMessage[] = [];
  private readonly listeners = new Set<(msg: ChatMessage) => void>();

  constructor(options: HttpChatChannelOptions) {
    this.channelId = options.channelId;
    this.webhookUrl = (options.webhookUrl ?? "").trim();
    this.token = (options.token ?? "").trim();
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
    this.parseInbound = options.hooks?.parseInbound ?? (() => null);
    this.serializeOutbound = options.hooks?.serializeOutbound ?? defaultSerializeOutbound;
    this.testPayload = options.hooks?.testPayload ?? (() => defaultSerializeOutbound({
      id: `probe-${Date.now()}`,
      conversationId: "probe",
      sender: "openwork",
      role: "system",
      text: "OpenWork connectivity probe",
      mentions: [],
      timestamp: Date.now(),
    }));
  }

  /** 更新出站配置（管理 API 保存后调用） */
  setWebhook(webhookUrl: string, token?: string): void {
    this.webhookUrl = webhookUrl.trim();
    if (token !== undefined) this.token = token.trim();
  }

  getWebhookUrl(): string {
    return this.webhookUrl;
  }

  /** I1: 发送消息到平台 webhook */
  async send(message: ChatMessage, _options?: ChatSendOptions): Promise<void> {
    if (!this.webhookUrl) {
      throw new Error(`[http-chat-channel:${this.channelId}] webhook url is not configured`);
    }
    const payload = this.serializeOutbound(message);
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    const response = await this.fetchImpl(this.webhookUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`[http-chat-channel:${this.channelId}] webhook send failed: HTTP ${response.status} ${body.slice(0, 200)}`);
    }
  }

  /**
   * 入站回调入口：解析平台 JSON → 统一 ChatMessage，入队供 receive() 消费。
   * 返回解析后的消息；事件被忽略时返回 null。
   */
  pushInbound(rawBody: unknown): ChatMessage | null {
    const message = this.parseInbound(rawBody);
    if (!message) return null;
    this.queue.push(message);
    for (const listener of this.listeners) listener(message);
    return message;
  }

  /** I2: 拉取模式消费入站消息（游标去重） */
  async *receive(conversationId?: string): AsyncIterable<ChatMessage> {
    let cursor = 0;
    const wakeups: Array<() => void> = [];
    const listener = () => {
      for (const wake of [...wakeups]) wake();
    };
    this.listeners.add(listener);
    try {
      while (true) {
        if (cursor < this.queue.length) {
          const msg = this.queue[cursor++]!;
          if (!conversationId || msg.conversationId === conversationId) yield msg;
          continue;
        }
        await new Promise<void>((resolve) => {
          wakeups.push(resolve);
          setTimeout(() => {
            const index = wakeups.indexOf(resolve);
            if (index >= 0) wakeups.splice(index, 1);
            resolve();
          }, 50);
        });
      }
    } finally {
      this.listeners.delete(listener);
    }
  }

  /** 连通性探测：向 webhook 发送测试 payload，报告结果 */
  async testConnection(): Promise<TestConnectionResult> {
    if (!this.webhookUrl) {
      return { ok: false, error: "webhook url is not configured" };
    }
    try {
      const payload = this.testPayload();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (this.token) headers.Authorization = `Bearer ${this.token}`;
      const response = await this.fetchImpl(this.webhookUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
      const body = await response.text().catch(() => "");
      if (!response.ok) {
        return { ok: false, status: response.status, body, error: `HTTP ${response.status}` };
      }
      return { ok: true, status: response.status, body };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
}

/** 供入站路由识别 HttpChatChannel 实例 */
export function isHttpChatChannel(channel: unknown): channel is HttpChatChannel {
  return channel instanceof HttpChatChannel;
}
