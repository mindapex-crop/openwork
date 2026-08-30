/**
 * 企业微信通道适配器（openspec-chat-bridge.md 阶段四）
 *
 * 入站：企微回调 JSON（文本消息）→ 统一 ChatMessage
 * 出站：统一 ChatMessage → 群机器人 webhook 格式
 *   { "msgtype": "text", "text": { "content": "...", "mentioned_list": ["@all"] } }
 *
 * @mention：文本中的 @xxx / @all；出站 mentioned_list 用 ["@all"] 表示全员
 */

import type { ChatMessage } from "../types.js";
import { HttpChatChannel, type HttpChatChannelOptions } from "./http-chat-channel.js";

interface WecomTextPayload {
  ToUserName?: unknown;
  FromUserName?: unknown;
  CreateTime?: unknown;
  MsgType?: unknown;
  Content?: unknown;
  MsgId?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** 识别文本中的 @mention（支持中文昵称与 @all） */
export function extractWecomMentions(text: string): string[] {
  const mentions = new Set<string>();
  const regex = /@([\p{L}\p{N}_-]+)/gu;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const name = match[1]!;
    if (name === "all") mentions.add("all");
    else mentions.add(name);
  }
  return [...mentions];
}

/** 解析企微文本回调 → 统一 ChatMessage；非文本/无效事件返回 null */
export function parseWecomInbound(body: unknown): ChatMessage | null {
  if (!isRecord(body)) return null;
  const payload = body as WecomTextPayload;
  if (payload.MsgType !== "text") return null;
  const msgId = readString(payload.MsgId);
  const toUser = readString(payload.ToUserName);
  const fromUser = readString(payload.FromUserName);
  const text = readString(payload.Content);
  if (!msgId || !toUser || !fromUser) return null;
  const createTime = typeof payload.CreateTime === "number" ? payload.CreateTime : Number(payload.CreateTime);
  return {
    id: msgId,
    conversationId: toUser,
    sender: fromUser,
    role: "user",
    text,
    mentions: extractWecomMentions(text),
    timestamp: Number.isFinite(createTime) ? createTime * 1000 : Date.now(),
  };
}

/** 统一 ChatMessage → 企微群机器人 webhook JSON */
export function serializeWecomOutbound(message: ChatMessage): unknown {
  const mentionedList = message.mentions.length > 0
    ? message.mentions.map((id) => (id === "all" ? "@all" : id))
    : undefined;
  return {
    msgtype: "text",
    text: {
      content: message.text,
      ...(mentionedList ? { mentioned_list: mentionedList } : {}),
    },
  };
}

export function createWecomChatChannel(options: Omit<HttpChatChannelOptions, "channelId" | "hooks"> = {}): HttpChatChannel {
  return new HttpChatChannel({
    channelId: "wecom",
    webhookUrl: options.webhookUrl,
    token: options.token,
    fetchImpl: options.fetchImpl,
    hooks: {
      parseInbound: parseWecomInbound,
      serializeOutbound: serializeWecomOutbound,
    },
  });
}
