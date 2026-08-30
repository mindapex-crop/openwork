/**
 * 钉钉通道适配器（openspec-chat-bridge.md 阶段四）
 *
 * 入站：钉钉机器人回调 JSON（msgtype=text）→ 统一 ChatMessage
 * 出站：统一 ChatMessage → 自定义机器人 webhook 格式
 *   { "msgtype": "text", "text": { "content": "...", "at": { "isAtAll": true } } }
 *
 * @mention：文本中的 @机器人（中文昵称）/ @all；钉钉回调的 isInAtList 也作为辅助信号
 */

import type { ChatMessage } from "../types.js";
import { HttpChatChannel, type HttpChatChannelOptions } from "./http-chat-channel.js";

interface DingtalkTextPayload {
  senderNick?: unknown;
  text?: unknown;
  msgtype?: unknown;
  msgId?: unknown;
  conversationId?: unknown;
  senderId?: unknown;
  isInAtList?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** 识别文本中的 @mention（支持中文昵称与 @all） */
export function extractDingtalkMentions(text: string): string[] {
  const mentions = new Set<string>();
  const regex = /@([\p{L}\p{N}_-]+)/gu;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    mentions.add(match[1]!);
  }
  return [...mentions];
}

/** 解析钉钉文本回调 → 统一 ChatMessage；非文本/无效事件返回 null */
export function parseDingtalkInbound(body: unknown): ChatMessage | null {
  if (!isRecord(body)) return null;
  const payload = body as DingtalkTextPayload;
  if (payload.msgtype !== "text") return null;
  const text = isRecord(payload.text) ? readString(payload.text.content) : "";
  const msgId = readString(payload.msgId);
  const conversationId = readString(payload.conversationId);
  const sender = readString(payload.senderId) || readString(payload.senderNick);
  if (!msgId || !conversationId || !sender || !text) return null;

  const mentions = extractDingtalkMentions(text);
  // 钉钉回调通过 isInAtList 声明是否 @ 了机器人；文本无 @ 但被 @ 时补一个占位 mention
  if (mentions.length === 0 && payload.isInAtList === true) {
    mentions.push("bot");
  }
  return {
    id: msgId,
    conversationId,
    sender,
    role: "user",
    text,
    mentions,
    timestamp: Date.now(),
  };
}

/** 统一 ChatMessage → 钉钉自定义机器人 webhook JSON */
export function serializeDingtalkOutbound(message: ChatMessage): unknown {
  const atAll = message.mentions.includes("all");
  return {
    msgtype: "text",
    text: {
      content: message.text,
      ...(atAll ? { at: { isAtAll: true } } : {}),
    },
  };
}

export function createDingtalkChatChannel(options: Omit<HttpChatChannelOptions, "channelId" | "hooks"> = {}): HttpChatChannel {
  return new HttpChatChannel({
    channelId: "dingtalk",
    webhookUrl: options.webhookUrl,
    token: options.token,
    fetchImpl: options.fetchImpl,
    hooks: {
      parseInbound: parseDingtalkInbound,
      serializeOutbound: serializeDingtalkOutbound,
    },
  });
}
