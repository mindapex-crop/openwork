/**
 * 飞书通道适配器（openspec-chat-bridge.md 阶段四）
 *
 * 入站：飞书事件订阅 JSON（im.message.receive_v1 文本消息）→ 统一 ChatMessage
 * 出站：统一 ChatMessage → 群机器人 webhook 格式
 *   { "msg_type": "text", "content": { "text": "..." } }
 *
 * @mention：content 文本中的 <at user_id="ou_xxx"></at> 与 @xxx
 */

import type { ChatMessage } from "../types.js";
import { HttpChatChannel, type HttpChatChannelOptions } from "./http-chat-channel.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** 识别文本中的飞书 at 语法与 @mention */
export function extractFeishuMentions(text: string): string[] {
  const mentions = new Set<string>();
  const atUserRegex = /<at\s+user_id="([^"]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = atUserRegex.exec(text)) !== null) {
    mentions.add(match[1]!);
  }
  const atRegex = /@([\p{L}\p{N}_-]+)/gu;
  while ((match = atRegex.exec(text)) !== null) {
    mentions.add(match[1]!);
  }
  return [...mentions];
}

/** 解析飞书 im.message.receive_v1 文本事件 → 统一 ChatMessage；其他事件返回 null */
export function parseFeishuInbound(body: unknown): ChatMessage | null {
  if (!isRecord(body)) return null;
  const header = isRecord(body.header) ? body.header : null;
  if (!header || header.event_type !== "im.message.receive_v1") return null;
  const event = isRecord(body.event) ? body.event : null;
  if (!event) return null;
  const message = isRecord(event.message) ? event.message : null;
  if (!message || message.message_type !== "text") return null;

  const messageId = readString(message.message_id);
  const chatId = readString(message.chat_id);
  if (!messageId || !chatId) return null;

  const sender = isRecord(event.sender) ? event.sender : null;
  const senderId = isRecord(sender?.sender_id) ? sender.sender_id : null;
  const openId = readString(senderId?.open_id);

  const contentRaw = readString(message.content);
  let text = "";
  try {
    const content = JSON.parse(contentRaw) as unknown;
    text = isRecord(content) ? readString(content.text) : "";
  } catch {
    text = contentRaw;
  }

  const createTime = Number(message.create_time);
  return {
    id: messageId,
    conversationId: chatId,
    sender: openId || "feishu-user",
    role: "user",
    text,
    mentions: extractFeishuMentions(text),
    timestamp: Number.isFinite(createTime) && createTime > 0 ? createTime : Date.now(),
  };
}

/** 统一 ChatMessage → 飞书群机器人 webhook JSON */
export function serializeFeishuOutbound(message: ChatMessage): unknown {
  return {
    msg_type: "text",
    content: { text: message.text },
  };
}

export function createFeishuChatChannel(options: Omit<HttpChatChannelOptions, "channelId" | "hooks"> = {}): HttpChatChannel {
  return new HttpChatChannel({
    channelId: "feishu",
    webhookUrl: options.webhookUrl,
    token: options.token,
    fetchImpl: options.fetchImpl,
    hooks: {
      parseInbound: parseFeishuInbound,
      serializeOutbound: serializeFeishuOutbound,
    },
  });
}
