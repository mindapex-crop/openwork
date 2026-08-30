import type { SessionMessage, SessionPart } from "../types";

/** 从 part 中提取文本（opencode part.type === "text"） */
export function partText(part: SessionPart): string {
  if (part.type === "text" && typeof part.text === "string") return part.text;
  return "";
}

/** 提取一条消息的完整文本（拼接所有文本 part） */
export function extractMessageText(message: SessionMessage): string {
  return message.parts.map(partText).filter(Boolean).join("\n");
}

/** 从消息列表构造"最后一条消息文本"，用于会话列表摘要 */
export function lastMessageText(messages: SessionMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const text = extractMessageText(messages[i] ?? { info: { id: "", sessionID: "", role: "" }, parts: [] }).trim();
    if (text) return text;
  }
  return "";
}

export function isUserMessage(message: SessionMessage): boolean {
  return message.info.role === "user";
}

/** 相对时间（分钟/小时/天），用于列表排序与展示 */
export function formatRelativeTime(timestamp: number | undefined, now: number = Date.now()): string {
  if (!timestamp || !Number.isFinite(timestamp)) return "";
  const diffMs = now - timestamp;
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "刚刚";
  if (diffMin < 60) return `${diffMin} 分钟前`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} 小时前`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays} 天前`;
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** 会话最新活动时间（updated ?? created） */
export function sessionActivityTime(session: { time?: { updated?: number; created?: number } }): number | undefined {
  return session.time?.updated ?? session.time?.created;
}
