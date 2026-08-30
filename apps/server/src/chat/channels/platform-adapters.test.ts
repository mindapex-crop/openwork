/**
 * 平台适配器单测 — 企微 / 飞书 / 钉钉 / Slack
 *
 * 用固定样例 JSON 覆盖：
 * - 入站回调解析（各自格式 → 统一 ChatMessage，含 @mention 识别）
 * - 非文本/忽略事件 → null
 * - 出站序列化（统一 → 平台 webhook 格式）
 * - create*ChatChannel 工厂（hooks 正确接线）
 */
import { describe, expect, test } from "bun:test";
import type { ChatMessage } from "../types.js";
import { createWecomChatChannel, extractWecomMentions, parseWecomInbound, serializeWecomOutbound } from "./wecom-chat-channel.js";
import { createFeishuChatChannel, extractFeishuMentions, parseFeishuInbound, serializeFeishuOutbound } from "./feishu-chat-channel.js";
import { createDingtalkChatChannel, extractDingtalkMentions, parseDingtalkInbound, serializeDingtalkOutbound } from "./dingtalk-chat-channel.js";
import { createSlackChatChannel, extractSlackMentions, parseSlackInbound, serializeSlackOutbound } from "./slack-chat-channel.js";

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

describe("企业微信 wecom", () => {
  const WECOM_TEXT_SAMPLE = {
    ToUserName: "ww1234567890",
    FromUserName: "zhangsan",
    CreateTime: 1348831860,
    MsgType: "text",
    Content: "@bot 帮我整理周报",
    MsgId: "1234567890123456789",
    AgentID: 1,
  };

  test("解析文本回调为统一 ChatMessage", () => {
    const message = parseWecomInbound(WECOM_TEXT_SAMPLE);
    expect(message).not.toBeNull();
    expect(message!.id).toBe("1234567890123456789");
    expect(message!.conversationId).toBe("ww1234567890");
    expect(message!.sender).toBe("zhangsan");
    expect(message!.role).toBe("user");
    expect(message!.text).toBe("@bot 帮我整理周报");
    expect(message!.mentions).toContain("bot");
    expect(message!.timestamp).toBe(1348831860000);
  });

  test("@all 识别", () => {
    expect(extractWecomMentions("@all 通知所有人")).toContain("all");
    expect(extractWecomMentions("没有艾特")).toEqual([]);
  });

  test("非文本消息返回 null（忽略图片/文件等）", () => {
    expect(parseWecomInbound({ ...WECOM_TEXT_SAMPLE, MsgType: "image" })).toBeNull();
    expect(parseWecomInbound({ foo: "bar" })).toBeNull();
    expect(parseWecomInbound(null)).toBeNull();
  });

  test("出站序列化为企微机器人 webhook 格式", () => {
    expect(serializeWecomOutbound(makeMessage({ text: "你好" }))).toEqual({
      msgtype: "text",
      text: { content: "你好" },
    });
    const withMentions = serializeWecomOutbound(makeMessage({ text: "hi", mentions: ["bot", "dev"] }));
    expect(withMentions).toEqual({
      msgtype: "text",
      text: { content: "hi", mentioned_list: ["bot", "dev"] },
    });
    const atAll = serializeWecomOutbound(makeMessage({ text: "hi", mentions: ["all"] }));
    expect(atAll).toEqual({ msgtype: "text", text: { content: "hi", mentioned_list: ["@all"] } });
  });

  test("createWecomChatChannel 接线 hooks（send 发出平台格式）", async () => {
    let body: unknown;
    const fetchImpl = async (_url: string, init?: RequestInit) => {
      body = JSON.parse(init!.body as string);
      return new Response("{}", { status: 200 });
    };
    const channel = createWecomChatChannel({ webhookUrl: "https://qyapi.weixin.qq.com/hook", fetchImpl: fetchImpl as typeof fetch });
    expect(channel.channelId).toBe("wecom");
    await channel.send(makeMessage({ text: "出站" }));
    expect(body).toEqual({ msgtype: "text", text: { content: "出站" } });
  });
});

describe("飞书 feishu", () => {
  const FEISHU_TEXT_SAMPLE = {
    schema: "2.0",
    header: {
      event_id: "evt_123",
      event_type: "im.message.receive_v1",
      create_time: "1609295409",
      token: "token",
      app_id: "cli_xxx",
    },
    event: {
      message: {
        message_id: "om_123",
        chat_id: "oc_123",
        chat_type: "group",
        message_type: "text",
        content: '{"text":"<at user_id=\\"ou_abc\\"></at> 帮我写代码"}',
        create_time: "1609295409000",
      },
      sender: {
        sender_id: { open_id: "ou_abc", union_id: "on_abc", user_id: "u_abc" },
        sender_type: "user",
      },
    },
  };

  test("解析 im.message.receive_v1 文本事件", () => {
    const message = parseFeishuInbound(FEISHU_TEXT_SAMPLE);
    expect(message).not.toBeNull();
    expect(message!.id).toBe("om_123");
    expect(message!.conversationId).toBe("oc_123");
    expect(message!.sender).toBe("ou_abc");
    expect(message!.text).toContain("帮我写代码");
    expect(message!.mentions).toContain("ou_abc");
    expect(message!.timestamp).toBe(1609295409000);
  });

  test("非 receive / 非文本事件返回 null", () => {
    expect(
      parseFeishuInbound({ ...FEISHU_TEXT_SAMPLE, header: { ...FEISHU_TEXT_SAMPLE.header, event_type: "im.message.read_v1" } }),
    ).toBeNull();
    expect(
      parseFeishuInbound({
        ...FEISHU_TEXT_SAMPLE,
        event: { ...FEISHU_TEXT_SAMPLE.event, message: { ...FEISHU_TEXT_SAMPLE.event.message, message_type: "image" } },
      }),
    ).toBeNull();
    expect(parseFeishuInbound({ type: "url_verification", challenge: "ch" })).toBeNull();
  });

  test("at 用户解析（user_id 属性 + @语法）", () => {
    expect(extractFeishuMentions('<at user_id="ou_abc"></at> hello')).toContain("ou_abc");
    expect(extractFeishuMentions("普通消息")).toEqual([]);
  });

  test("出站序列化为飞书机器人 webhook 格式", () => {
    expect(serializeFeishuOutbound(makeMessage({ text: "收到" }))).toEqual({
      msg_type: "text",
      content: { text: "收到" },
    });
  });

  test("createFeishuChatChannel 接线 hooks", async () => {
    let body: unknown;
    const fetchImpl = async (_url: string, init?: RequestInit) => {
      body = JSON.parse(init!.body as string);
      return new Response("{}", { status: 200 });
    };
    const channel = createFeishuChatChannel({ webhookUrl: "https://open.feishu.cn/hook", fetchImpl: fetchImpl as typeof fetch });
    expect(channel.channelId).toBe("feishu");
    await channel.send(makeMessage({ text: "飞书消息" }));
    expect(body).toEqual({ msg_type: "text", content: { text: "飞书消息" } });
  });
});

describe("钉钉 dingtalk", () => {
  const DINGTALK_TEXT_SAMPLE = {
    senderNick: "张三",
    isAdmin: true,
    text: { content: "@机器人 你好" },
    msgtype: "text",
    msgId: "msg_123",
    conversationId: "cid_123",
    senderId: "zhangsan",
    conversationType: "2",
    isInAtList: true,
  };

  test("解析文本回调为统一 ChatMessage", () => {
    const message = parseDingtalkInbound(DINGTALK_TEXT_SAMPLE);
    expect(message).not.toBeNull();
    expect(message!.id).toBe("msg_123");
    expect(message!.conversationId).toBe("cid_123");
    expect(message!.sender).toBe("zhangsan");
    expect(message!.text).toBe("@机器人 你好");
    expect(message!.role).toBe("user");
  });

  test("@机器人（中文昵称）识别", () => {
    expect(extractDingtalkMentions("@机器人 你好")).toContain("机器人");
    expect(extractDingtalkMentions("@all 所有人")).toContain("all");
    expect(extractDingtalkMentions("没有艾特")).toEqual([]);
  });

  test("非文本消息返回 null", () => {
    expect(parseDingtalkInbound({ ...DINGTALK_TEXT_SAMPLE, msgtype: "picture" })).toBeNull();
    expect(parseDingtalkInbound({ foo: 1 })).toBeNull();
  });

  test("出站序列化为钉钉机器人 webhook 格式", () => {
    expect(serializeDingtalkOutbound(makeMessage({ text: "钉钉消息" }))).toEqual({
      msgtype: "text",
      text: { content: "钉钉消息" },
    });
    const atAll = serializeDingtalkOutbound(makeMessage({ text: "hi", mentions: ["all"] }));
    expect(atAll).toEqual({ msgtype: "text", text: { content: "hi", at: { isAtAll: true } } });
  });

  test("createDingtalkChatChannel 接线 hooks", async () => {
    let body: unknown;
    const fetchImpl = async (_url: string, init?: RequestInit) => {
      body = JSON.parse(init!.body as string);
      return new Response("{}", { status: 200 });
    };
    const channel = createDingtalkChatChannel({ webhookUrl: "https://oapi.dingtalk.com/hook", fetchImpl: fetchImpl as typeof fetch });
    expect(channel.channelId).toBe("dingtalk");
    await channel.send(makeMessage({ text: "钉钉" }));
    expect(body).toEqual({ msgtype: "text", text: { content: "钉钉" } });
  });
});

describe("Slack", () => {
  const SLACK_EVENT_SAMPLE = {
    token: "xxx",
    team_id: "T123",
    api_app_id: "A123",
    type: "event_callback",
    event: {
      type: "message",
      channel: "C123",
      user: "U456",
      text: "<@U0LAN0Z89> deploy staging",
      ts: "1358878755.000001",
      team: "T123",
      channel_type: "channel",
    },
  };

  test("解析 Events API message 事件", () => {
    const message = parseSlackInbound(SLACK_EVENT_SAMPLE);
    expect(message).not.toBeNull();
    expect(message!.id).toBe("C123-1358878755.000001");
    expect(message!.conversationId).toBe("C123");
    expect(message!.sender).toBe("U456");
    expect(message!.text).toBe("<@U0LAN0Z89> deploy staging");
    expect(message!.mentions).toContain("U0LAN0Z89");
    expect(message!.timestamp).toBe(1358878755000);
  });

  test("<@Uxxx> mention 解析", () => {
    expect(extractSlackMentions("<@U0LAN0Z89> hi <@U999>")).toEqual(["U0LAN0Z89", "U999"]);
    expect(extractSlackMentions("plain text")).toEqual([]);
  });

  test("bot 消息 / 非 message 事件 / url_verification 返回 null", () => {
    expect(parseSlackInbound({ ...SLACK_EVENT_SAMPLE, event: { ...SLACK_EVENT_SAMPLE.event, bot_id: "B123" } })).toBeNull();
    expect(parseSlackInbound({ type: "event_callback", event: { type: "reaction_added" } })).toBeNull();
    expect(parseSlackInbound({ type: "url_verification", challenge: "ch" })).toBeNull();
    expect(parseSlackInbound({ type: "event_callback", event: { type: "message", subtype: "message_changed" } })).toBeNull();
  });

  test("出站序列化为 Incoming Webhook 格式", () => {
    expect(serializeSlackOutbound(makeMessage({ text: "slack 消息" }))).toEqual({
      text: "slack 消息",
      mrkdwn: true,
    });
  });

  test("createSlackChatChannel 接线 hooks", async () => {
    let body: unknown;
    const fetchImpl = async (_url: string, init?: RequestInit) => {
      body = JSON.parse(init!.body as string);
      return new Response("ok", { status: 200 });
    };
    const channel = createSlackChatChannel({ webhookUrl: "https://hooks.slack.com/T123", fetchImpl: fetchImpl as typeof fetch });
    expect(channel.channelId).toBe("slack");
    await channel.send(makeMessage({ text: "hello" }));
    expect(body).toEqual({ text: "hello", mrkdwn: true });
  });
});
