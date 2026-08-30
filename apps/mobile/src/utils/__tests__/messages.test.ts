import {
  extractMessageText,
  lastMessageText,
  isUserMessage,
  formatRelativeTime,
  sessionActivityTime,
} from "../messages";
import type { SessionMessage, SessionPart } from "../../types";

function msg(role: string, parts: Array<Partial<SessionPart> & { type?: string; text?: string }>): SessionMessage {
  return {
    info: { id: `m-${Math.random()}`, sessionID: "s1", role, time: { created: 1_700_000_000_000 } },
    parts: parts.map((p, i) => ({
      id: `p-${i}`,
      messageID: `m-${i}`,
      sessionID: "s1",
      type: "text",
      text: "",
      ...p,
    })),
  };
}

describe("extractMessageText", () => {
  it("拼接所有 text part", () => {
    const message = msg("assistant", [
      { type: "text", text: "第一段" },
      { type: "tool", text: "工具内容不应出现" },
      { type: "text", text: "第二段" },
    ]);
    expect(extractMessageText(message)).toBe("第一段\n第二段");
  });

  it("无文本 part 时返回空串", () => {
    expect(extractMessageText(msg("assistant", [{ type: "reasoning", text: "思考" }]))).toBe("");
  });
});

describe("lastMessageText", () => {
  it("返回最后一条有文本的消息", () => {
    const messages = [
      msg("user", [{ text: "你好" }]),
      msg("assistant", [{ type: "tool" }]),
      msg("assistant", [{ text: "收到" }]),
    ];
    expect(lastMessageText(messages)).toBe("收到");
  });

  it("全部无文本时返回空串", () => {
    expect(lastMessageText([msg("assistant", [{ type: "tool" }])])).toBe("");
  });

  it("空列表返回空串", () => {
    expect(lastMessageText([])).toBe("");
  });
});

describe("isUserMessage", () => {
  it("识别 user 与 assistant", () => {
    expect(isUserMessage(msg("user", []))).toBe(true);
    expect(isUserMessage(msg("assistant", []))).toBe(false);
  });
});

describe("formatRelativeTime", () => {
  const now = 1_700_000_000_000;
  it("分钟/小时/天格式", () => {
    expect(formatRelativeTime(now - 30_000, now)).toBe("刚刚");
    expect(formatRelativeTime(now - 5 * 60_000, now)).toBe("5 分钟前");
    expect(formatRelativeTime(now - 3 * 3_600_000, now)).toBe("3 小时前");
    expect(formatRelativeTime(now - 2 * 86_400_000, now)).toBe("2 天前");
  });

  it("30 天以上显示日期", () => {
    const old = new Date("2026-01-05T10:00:00Z").getTime();
    const result = formatRelativeTime(old, new Date("2026-08-25T10:00:00Z").getTime());
    expect(result).toBe("2026-01-05");
  });

  it("非法时间返回空串", () => {
    expect(formatRelativeTime(undefined, now)).toBe("");
    expect(formatRelativeTime(Number.NaN, now)).toBe("");
  });
});

describe("sessionActivityTime", () => {
  it("优先 updated，其次 created", () => {
    expect(sessionActivityTime({ time: { updated: 2, created: 1 } })).toBe(2);
    expect(sessionActivityTime({ time: { created: 1 } })).toBe(1);
    expect(sessionActivityTime({})).toBeUndefined();
  });
});
