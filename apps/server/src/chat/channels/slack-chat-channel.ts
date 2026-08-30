/**
 * Slack 通道适配器（openspec-chat-bridge.md 阶段四）
 *
 * 入站：Events API JSON（event_callback / event.type=message）→ 统一 ChatMessage
 * 出站：统一 ChatMessage → Incoming Webhook 格式 { "text": "...", "mrkdwn": true }
 *
 * @mention：<@U0LAN0Z89> 语法
 */

import type { ChatMessage } from "../types.js";
import { HttpChatChannel, type HttpChatChannelOptions } from "./http-chat-channel.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** 识别 <@Uxxx> mention */
export function extractSlackMentions(text: string): string[] {
  const mentions: string[] = [];
  const regex = /<@([A-Za-z0-9]+)>/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    mentions.push(match[1]!);
  }
  return mentions;
}

/** 解析 Slack Events API message 事件 → 统一 ChatMessage；bot/子类型/非 message 事件返回 null */
export function parseSlackInbound(body: unknown): ChatMessage | null {
  if (!isRecord(body) || body.type !== "event_callback") return null;
  const event = isRecord(body.event) ? body.event : null;
  if (!event || event.type !== "message") return null;
  // 跳过子类型（message_changed / message_deleted ...）与 bot 消息，防止回环
  if (event.subtype !== undefined) return null;
  if (event.bot_id !== undefined) return null;

  const channel = readString(event.channel);
  const user = readString(event.user);
  const text = readString(event.text);
  const ts = readString(event.ts);
  if (!channel || !text || !ts) return null;

  const timestamp = Math.trunc(Number.parseFloat(ts) * 1000);
  return {
    id: `${channel}-${ts}`,
    conversationId: channel,
    sender: user || "slack-user",
    role: "user",
    text,
    mentions: extractSlackMentions(text),
    timestamp: Number.isFinite(timestamp) ? timestamp : Date.now(),
  };
}

/** 统一 ChatMessage → Slack Incoming Webhook JSON */
export function serializeSlackOutbound(message: ChatMessage): unknown {
  return {
    text: message.text,
    mrkdwn: true,
  };
}

export function createSlackChatChannel(options: Omit<HttpChatChannelOptions, "channelId" | "hooks"> = {}): HttpChatChannel {
  return new HttpChatChannel({
    channelId: "slack",
    webhookUrl: options.webhookUrl,
    token: options.token,
    fetchImpl: options.fetchImpl,
    hooks: {
      parseInbound: parseSlackInbound,
      serializeOutbound: serializeSlackOutbound,
    },
  });
}
